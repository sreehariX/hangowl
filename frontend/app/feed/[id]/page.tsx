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
  const { isAuthenticated, userId, loading: authLoading } = useAuth();

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

  // After full data loads: scroll the focused post just below the sticky header
  // BEFORE the browser paints (useLayoutEffect) so users never see ancestor content
  // flash on screen. Ancestors are above the viewport — scroll up to see them.
  // This mirrors Twitter's thread navigation: focused tweet at top, context above.
  useLayoutEffect(() => {
    if (loading) return;
    if (ancestors.length === 0) {
      window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    const el = focusedPostRef.current;
    if (!el) return;
    // scrollIntoView with CSS scroll-margin-top handles the sticky header offset
    el.scrollIntoView({ block: "start", behavior: "instant" });
  }, [loading, ancestors.length]);

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

  // Realtime: new direct replies
  useEffect(() => {
    const channel = supabase.channel(`post-${postId}-replies`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts", filter: `parent_id=eq.${postId}` },
        (payload) => {
          const r = payload.new as Post;
          setReplies((prev) => prev.some((p) => p.id === r.id) ? prev : [...prev, r]);
          setPost((prev) => prev ? { ...prev, replies_count: prev.replies_count + 1 } : prev);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [postId]);

  function handleReplied() {
    setReplyTarget(null);
    refreshReplies();
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

  function handleSubReplyDeleted(subReplyId: string) {
    setSubReplies((prev) => prev.filter((s) => s.id !== subReplyId));
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

      {/* Ancestor chain — each connected to next with thread line */}
      {ancestors.map((ancestor) => (
        <PostCard
          key={ancestor.id}
          post={ancestor}
          liked={likedIds.has(ancestor.id)}
          currentUserId={userId}
          isAdmin={isAdmin}
          showThreadLine
        />
      ))}

      {/* Main (focused) post — seamless connects to ancestors above, showThreadLine connects to replies below */}
      <div ref={focusedPostRef} style={{ scrollMarginTop: 52 }}>
        <PostCard
          post={post}
          liked={likedIds.has(post.id)}
          currentUserId={userId}
          isAdmin={isAdmin}
          isDetail
          seamless={ancestors.length > 0}
          showThreadLine={sortedReplies.length > 0}
          onDeleted={handlePostDeleted}
          onReply={isAuthenticated ? () => setReplyTarget(post) : undefined}
        />
      </div>

      {/* Replies */}
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
          {sortedReplies.map((reply, replyIdx) => {
            const subs = subRepliesMap[reply.id] ?? [];
            return (
              <div key={reply.id}>
                <PostCard
                  post={reply}
                  liked={likedIds.has(reply.id)}
                  currentUserId={userId}
                  isAdmin={isAdmin}
                  seamless={replyIdx === 0}
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
                    onDeleted={() => handleSubReplyDeleted(sub.id)}
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
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 animate-fade-in"
            onClick={() => setReplyTarget(null)}
          />
          {/* Sheet */}
          <div className="fixed bottom-0 inset-x-0 z-50 animate-sheet-up">
            <div className="mx-auto max-w-lg bg-navy rounded-t-2xl border-t border-x border-border overflow-hidden">
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-9 h-1 rounded-full bg-border" />
              </div>
              {/* Cancel */}
              <div className="flex items-center px-4 py-2">
                <button
                  onClick={() => setReplyTarget(null)}
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
              <div className="px-4 pb-8">
                <ComposeBox
                  parentId={replyTarget.id}
                  placeholder="Post your reply"
                  onPosted={handleReplied}
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
