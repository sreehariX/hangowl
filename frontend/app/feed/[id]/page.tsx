"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { postCache } from "@/lib/post-cache";
import { supabase } from "@/lib/supabase";
import { Avatar } from "@/components/Avatar";
import { PostCard } from "@/components/PostCard";
import { ComposeBox } from "@/components/ComposeBox";
import type { Post } from "@/lib/types";

function PostSkeleton({ isDetail = false }: { isDetail?: boolean }) {
  return (
    <div className="px-4 py-3 border-b border-border">
      <div className="flex gap-3">
        <div className="skeleton w-10 h-10 rounded-full shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="skeleton h-2.5 w-20 rounded-full" />
          <div className="skeleton h-2.5 w-full rounded-full" />
          <div className={`skeleton h-2.5 rounded-full ${isDetail ? "w-2/3" : "w-4/5"}`} />
          {isDetail && <div className="skeleton h-2.5 w-1/2 rounded-full" />}
        </div>
      </div>
    </div>
  );
}

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.id as string;
  const { isAuthenticated, userId, personaName, loading: authLoading } = useAuth();

  // Seed from cache for instant display — avoids skeleton when navigating
  // to a reply that was already visible on screen.
  const [post, setPost] = useState<Post | null>(() => postCache.get(postId) ?? null);
  const [ancestors, setAncestors] = useState<Post[]>([]); // oldest → newest
  const [replies, setReplies] = useState<Post[]>([]);
  const [subReplies, setSubReplies] = useState<Post[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [replyTarget, setReplyTarget] = useState<Post | null>(null);
  const optimisticReplyIdRef = useRef<string | null>(null);
  // Maps post.id → stable render key so the optimistic→real swap doesn't remount the component
  const replyKeysRef = useRef<Map<string, string>>(new Map());
  const [isClosingReplySheet, setIsClosingReplySheet] = useState(false);
  const replySheetAfterClose = useRef<(() => void) | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  // Two-phase render: ancestors stay hidden until scroll is positioned to prevent
  // the flash where parent post/image briefly appears before scrolling to focused post.
  const [showAncestors, setShowAncestors] = useState(false);
  const focusedPostRef = useRef<HTMLDivElement>(null);

  const subRepliesMap = useMemo(() => {
    const map: Record<string, Post[]> = {};
    for (const sr of subReplies) {
      if (!sr.parent_id) continue;
      (map[sr.parent_id] ??= []).push(sr);
    }
    return map;
  }, [subReplies]);

  // Full fetch: post + replies + ancestors (initial load only)
  const fetchAll = useCallback(async () => {
    try {
      const data = await api.getPost(postId);
      // Seed cache so any reply visible here can be opened instantly next tap
      postCache.set(data.post.id, data.post);
      data.replies.forEach((r) => postCache.set(r.id, r));
      (data.sub_replies ?? []).forEach((r) => postCache.set(r.id, r));
      setPost(data.post);
      setReplies(data.replies);
      setSubReplies(data.sub_replies ?? []);

      // Walk up ancestor chain (up to 5 deep)
      const chain: Post[] = [];
      let cur = data.post;
      while (cur.parent_id && chain.length < 5) {
        try {
          const p = await api.getPost(cur.parent_id);
          postCache.set(p.post.id, p.post);
          chain.unshift(p.post);
          cur = p.post;
        } catch { break; }
      }
      setAncestors(chain);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [postId]);

  // Light refresh: only post + replies, no ancestor re-fetch (used after posting a reply)
  const refreshReplies = useCallback(async () => {
    try {
      const data = await api.getPost(postId);
      setPost(data.post);
      setReplies(data.replies);
      setSubReplies(data.sub_replies ?? []);
    } catch { /* silent */ }
  }, [postId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Track virtual keyboard height via Visual Viewport API so the reply sheet
  // stays above the keyboard on mobile.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardHeight(kb);
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  // Reset ancestor visibility when navigating between posts
  useEffect(() => { setShowAncestors(false); }, [postId]);

  // Two-phase scroll positioning — prevents ancestor content from flashing on screen.
  //
  // Phase 1: Data loads, ancestors exist but showAncestors=false → ancestors NOT in DOM.
  //          Scroll stays at 0 (focused post is at top). Then we flip showAncestors=true,
  //          which triggers a synchronous re-render inside useLayoutEffect.
  //
  // Phase 2: showAncestors=true → ancestors ARE in DOM (pushing focused post down).
  //          We immediately scroll to the focused post before the browser paints.
  //          User never sees the ancestor flash — they scroll UP to reveal context.
  useLayoutEffect(() => {
    if (loading) return;
    if (ancestors.length === 0) {
      window.scrollTo(0, 0);
      return;
    }
    if (!showAncestors) {
      // Phase 1: keep scroll at top, then inject ancestors into DOM
      window.scrollTo(0, 0);
      setShowAncestors(true);
      return;
    }
    // Phase 2: ancestors now in DOM — scroll focused post to just below sticky header
    const el = focusedPostRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.pageYOffset - 52;
    window.scrollTo(0, Math.max(0, top));
  }, [loading, ancestors.length, showAncestors]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    async function loadUserData() {
      try {
        const [likesData, adminData] = await Promise.all([
          api.getMyLikedPostIds(),
          api.checkAdmin().catch(() => ({ is_admin: false })),
        ]);
        if (active) {
          setLikedIds(new Set(likesData.post_ids));
          setIsAdmin(adminData.is_admin);
        }
      } catch { /* silent */ }
    }
    loadUserData();
    return () => { active = false; };
  }, [isAuthenticated]);

  const userIdRef = useRef(userId);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  // Realtime: new direct replies
  useEffect(() => {
    const channel = supabase.channel(`post-${postId}-replies`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts", filter: `parent_id=eq.${postId}` },
        (payload) => {
          const r = payload.new as Post;
          setReplies((prev) => prev.some((p) => p.id === r.id) ? prev : [...prev, r]);
          // Only update count for others' replies — ours was already incremented optimistically
          if (r.user_id !== userIdRef.current) {
            setPost((prev) => prev ? { ...prev, replies_count: prev.replies_count + 1 } : prev);
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [postId]);

  function closeReplySheet(afterClose?: () => void) {
    replySheetAfterClose.current = afterClose ?? null;
    setIsClosingReplySheet(true);
  }

  function handleSheetAnimationEnd(e: React.AnimationEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    if (isClosingReplySheet) {
      setReplyTarget(null);
      setIsClosingReplySheet(false);
      replySheetAfterClose.current?.();
      replySheetAfterClose.current = null;
    }
  }

  function handleOptimisticReply(content: string, imageUrl: string | null) {
    const tempId = `optimistic-${Date.now()}`;
    optimisticReplyIdRef.current = tempId;
    replyKeysRef.current.set(tempId, tempId);
    const optimistic: Post = {
      id: tempId,
      user_id: userId ?? "",
      content,
      image_url: imageUrl,
      parent_id: postId,
      likes_count: 0,
      replies_count: 0,
      views_count: 0,
      created_at: new Date().toISOString(),
      users: { persona_name: personaName ?? "You" },
    };
    setReplies((prev) => [...prev, optimistic]);
    setPost((prev) => prev ? { ...prev, replies_count: prev.replies_count + 1 } : prev);
  }

  function handleReplyFailed() {
    const optId = optimisticReplyIdRef.current;
    optimisticReplyIdRef.current = null;
    replyKeysRef.current.delete(optId ?? "");
    setReplies((prev) => prev.filter((r) => r.id !== optId));
    setPost((prev) => prev ? { ...prev, replies_count: Math.max(0, prev.replies_count - 1) } : prev);
  }

  function handleReplied(post: Post) {
    const optId = optimisticReplyIdRef.current;
    optimisticReplyIdRef.current = null;
    // Transfer the stable render key from the optimistic ID to the real post ID
    // so the key={...} in the list doesn't change → no unmount/remount flash
    const stableKey = replyKeysRef.current.get(optId ?? "") ?? post.id;
    replyKeysRef.current.delete(optId ?? "");
    replyKeysRef.current.set(post.id, stableKey);
    setReplies((prev) => prev.map((r) => r.id === optId ? post : r));
  }

  function handlePostDeleted() {
    const parent = ancestors[ancestors.length - 1];
    router.push(parent ? `/feed/${parent.id}` : "/");
  }

  function handleReplyDeleted(replyId: string) {
    setReplies((prev) => prev.filter((r) => r.id !== replyId));
    setSubReplies((prev) => prev.filter((s) => s.parent_id !== replyId));
    setPost((prev) => prev ? { ...prev, replies_count: Math.max(0, prev.replies_count - 1) } : prev);
  }

  function handleSubReplyDeleted(subReplyId: string, parentReplyId: string) {
    setSubReplies((prev) => prev.filter((s) => s.id !== subReplyId));
    setReplies((prev) => prev.map((r) =>
      r.id === parentReplyId
        ? { ...r, replies_count: Math.max(0, r.replies_count - 1) }
        : r
    ));
  }

  // Only show full skeleton when we have no post data at all (cold load / direct URL).
  // When navigating from a thread we already have the post in cache, so skip straight
  // to rendering the post and show reply skeletons in-place instead.
  if (!post && (loading || authLoading)) {
    return (
      <div className="mx-auto max-w-lg pb-24">
        <div className="sticky top-0 z-20 flex items-center gap-4 px-4 py-3 bg-navy/95 backdrop-blur-md border-b border-border">
          <button onClick={() => router.back()} className="text-text-muted hover:text-text-primary transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>
            </svg>
          </button>
          <span className="text-[15px] font-bold text-text-primary">Post</span>
        </div>
        <PostSkeleton />
        <PostSkeleton isDetail />
        <div className="border-b border-border" />
        <PostSkeleton />
        <PostSkeleton />
        <PostSkeleton />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-16 pb-24 md:pt-6">
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <p className="text-text-secondary mb-4">Post not found</p>
          <Link href="/" className="text-amber hover:text-amber-dark text-sm">Back to Feed</Link>
        </div>
      </div>
    );
  }

  const immediateParent = ancestors[ancestors.length - 1] ?? null;

  const sortedReplies = [...replies].sort((a, b) => {
    const aIsAuthor = a.user_id === post.user_id ? 1 : 0;
    const bIsAuthor = b.user_id === post.user_id ? 1 : 0;
    if (aIsAuthor !== bIsAuthor) return bIsAuthor - aIsAuthor;
    return b.likes_count - a.likes_count;
  });

  return (
    <div className="mx-auto max-w-lg pb-24">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 flex items-center gap-4 px-4 py-3 bg-navy/95 backdrop-blur-md border-b border-border">
        <button onClick={() => router.push(immediateParent ? `/feed/${immediateParent.id}` : "/")}
          className="text-text-muted hover:text-text-primary transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>
          </svg>
        </button>
        <span className="text-[15px] font-bold text-text-primary">Post</span>
      </div>

      {/* Ancestor chain — only rendered after scroll is positioned (Phase 2).
           This prevents parent post images/content from flashing on screen. */}
      {showAncestors && ancestors.map((ancestor) => (
        <PostCard
          key={ancestor.id}
          post={ancestor}
          liked={likedIds.has(ancestor.id)}
          currentUserId={userId}
          isAdmin={isAdmin}
          showThreadLine
        />
      ))}

      {/* Main (focused) post — seamless connects to ancestors above.
           NO showThreadLine: Twitter-style clean break between post and replies. */}
      <div ref={focusedPostRef}>
        <PostCard
          post={post}
          liked={likedIds.has(post.id)}
          currentUserId={userId}
          isAdmin={isAdmin}
          isDetail
          seamless={showAncestors && ancestors.length > 0}
          onDeleted={handlePostDeleted}
          onReply={isAuthenticated ? () => setReplyTarget(post) : undefined}
        />
      </div>

      {/* Replies — Twitter-style: each reply is an independent card with clean borders.
           No thread lines connecting replies to the focused post.
           Sub-replies (conversation chains) keep thread lines to their parent reply. */}
      {loading && replies.length === 0 ? (
        <div>
          <PostSkeleton />
          <PostSkeleton />
          <PostSkeleton />
        </div>
      ) : replies.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm text-text-muted">No replies yet. Be the first.</p>
        </div>
      ) : (
        <div>
          {sortedReplies.map((reply) => {
            const subs = subRepliesMap[reply.id] ?? [];
            const replyKey = replyKeysRef.current.get(reply.id) ?? reply.id;
            return (
              <div key={replyKey}>
                <PostCard
                  post={reply}
                  liked={likedIds.has(reply.id)}
                  currentUserId={userId}
                  isAdmin={isAdmin}
                  showThreadLine={subs.length > 0}
                  onDeleted={() => handleReplyDeleted(reply.id)}
                  onReply={isAuthenticated ? () => setReplyTarget(reply) : undefined}
                />
                {subs.map((sub, idx) => (
                  <PostCard
                    key={sub.id}
                    post={sub}
                    liked={likedIds.has(sub.id)}
                    currentUserId={userId}
                    isAdmin={isAdmin}
                    seamless
                    showThreadLine={idx < subs.length - 1}
                    onDeleted={() => handleSubReplyDeleted(sub.id, reply.id)}
                    onReply={isAuthenticated ? () => setReplyTarget(sub) : undefined}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Reply bottom sheet */}
      {replyTarget && (
        <>
          {/* Backdrop — must be above nav (z-50) */}
          <div
            className={`fixed inset-0 z-[55] bg-black/60 ${isClosingReplySheet ? "animate-fade-out" : "animate-fade-in"}`}
            onClick={() => closeReplySheet()}
          />
          {/* Sheet — must be above nav (z-50) */}
          <div
            className={`fixed inset-x-0 z-[60] ${isClosingReplySheet ? "animate-sheet-down" : "animate-sheet-up"}`}
            style={{
              bottom: isClosingReplySheet ? 0 : keyboardHeight,
              transition: isClosingReplySheet ? "none" : "bottom 0.15s ease-out",
            }}
            onAnimationEnd={handleSheetAnimationEnd}
          >
            <div className="mx-auto max-w-lg bg-navy rounded-t-2xl border-t border-x border-border overflow-hidden">
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-9 h-1 rounded-full bg-border" />
              </div>
              {/* Cancel */}
              <div className="flex items-center px-4 py-2">
                <button
                  onClick={() => closeReplySheet()}
                  className="text-sm text-text-muted hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
              </div>
              {/* Original post context */}
              <div className="px-4 pb-2 flex gap-3">
                <div className="flex flex-col items-center">
                  <Avatar name={replyTarget.users?.persona_name ?? "Anonymous"} size={36} />
                  <div className="w-0.5 flex-1 mt-1.5 min-h-[24px] rounded-full bg-border/60" />
                </div>
                <div className="flex-1 min-w-0 pb-3">
                  <p className="text-[13px] font-bold text-text-primary">
                    {replyTarget.users?.persona_name ?? "Anonymous"}
                  </p>
                  <p className="text-[14px] text-text-secondary mt-0.5 line-clamp-4 whitespace-pre-wrap break-words">
                    {replyTarget.content}
                  </p>
                </div>
              </div>
              {/* Compose */}
              <div className="px-4 pb-4">
                <ComposeBox
                  parentId={replyTarget.id}
                  placeholder="Post your reply"
                  onPostStart={() => closeReplySheet()}
                  onOptimisticPost={handleOptimisticReply}
                  onPosted={handleReplied}
                  onPostFailed={handleReplyFailed}
                  autoFocus
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
