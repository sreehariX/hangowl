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
import { PostCardSkeleton } from "@/components/Skeleton";
import { ArrowLeftIcon } from "@/components/icons";
import type { Post } from "@/lib/types";

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.id as string;
  const { isAuthenticated, userId, personaName, loading: authLoading } = useAuth();

  const [post, setPost] = useState<Post | null>(() => postCache.get(postId) ?? null);
  const [ancestors, setAncestors] = useState<Post[]>([]);
  const [replies, setReplies] = useState<Post[]>([]);
  const [subReplies, setSubReplies] = useState<Post[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [replyTarget, setReplyTarget] = useState<Post | null>(null);
  const optimisticReplyIdRef = useRef<string | null>(null);
  const replyKeysRef = useRef<Map<string, string>>(new Map());
  const [isClosingReplySheet, setIsClosingReplySheet] = useState(false);
  const replySheetAfterClose = useRef<(() => void) | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const focusedPostRef = useRef<HTMLDivElement>(null);
  const pinnedForPostRef = useRef<string | null>(null);

  const subRepliesMap = useMemo(() => {
    const map: Record<string, Post[]> = {};
    for (const sr of subReplies) {
      if (!sr.parent_id) continue;
      (map[sr.parent_id] ??= []).push(sr);
    }
    return map;
  }, [subReplies]);

  const fetchAll = useCallback(async () => {
    try {
      const data = await api.getPost(postId);
      postCache.set(data.post.id, data.post);
      data.replies.forEach((r) => postCache.set(r.id, r));
      (data.sub_replies ?? []).forEach((r) => postCache.set(r.id, r));
      setPost(data.post);
      setReplies(data.replies);
      setSubReplies(data.sub_replies ?? []);

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
    } catch (err) {
      // Don't swallow: a failed /feed/:id is why a post can render with
      // "No replies yet" when the DB has replies. Log so regressions like
      // this are visible in devtools instead of silent.
      console.error("Failed to load post:", err);
    }
    finally { setLoading(false); }
  }, [postId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

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

  useEffect(() => {
    pinnedForPostRef.current = null;
    window.scrollTo(0, 0);
  }, [postId]);

  // Pin the focused post to the top, even when ancestors are rendered above,
  // so the user never sees the thread "push down" what they clicked.
  // We run this in a layout effect before paint so there is no visible flicker.
  useLayoutEffect(() => {
    if (loading) return;
    if (pinnedForPostRef.current === postId) return;
    if (ancestors.length === 0) {
      window.scrollTo(0, 0);
      pinnedForPostRef.current = postId;
      return;
    }
    const el = focusedPostRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.pageYOffset - 44;
    window.scrollTo(0, Math.max(0, top));
    pinnedForPostRef.current = postId;
  }, [loading, ancestors, postId]);

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
      } catch {}
    }
    loadUserData();
    return () => { active = false; };
  }, [isAuthenticated]);

  const userIdRef = useRef(userId);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  useEffect(() => {
    const channel = supabase.channel(`post-${postId}-replies`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts", filter: `parent_id=eq.${postId}` },
        (payload) => {
          const r = payload.new as Post;
          if (optimisticReplyIdRef.current && r.user_id === userIdRef.current) return;
          setReplies((prev) => prev.some((p) => p.id === r.id) ? prev : [...prev, r]);
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

  function handleOptimisticReply(content: string, imageUrls: string[]) {
    const tempId = `optimistic-${Date.now()}`;
    optimisticReplyIdRef.current = tempId;
    replyKeysRef.current.set(tempId, tempId);
    const optimistic: Post = {
      id: tempId,
      user_id: userId ?? "",
      content,
      image_url: imageUrls[0] ?? null,
      image_urls: imageUrls,
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
    const stableKey = replyKeysRef.current.get(optId ?? "") ?? post.id;
    replyKeysRef.current.delete(optId ?? "");
    replyKeysRef.current.set(post.id, stableKey);
    setReplies((prev) => prev.map((r) => {
      if (r.id !== optId) return r;
      return { ...post, users: r.users };
    }));
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

  const Header = (
    <div className="top-bar">
      <button
        onClick={() =>
          router.push(
            ancestors.length > 0
              ? `/feed/${ancestors[ancestors.length - 1].id}`
              : "/",
          )
        }
        className="icon-btn"
        aria-label="Back"
      >
        <ArrowLeftIcon size={20} />
      </button>
      <span className="text-[17px] font-semibold text-text-primary">Post</span>
    </div>
  );

  if (!post && (loading || authLoading)) {
    return (
      <div className="app-shell pt-0">
        <div className="app-content">
          {Header}
          <PostCardSkeleton />
          <PostCardSkeleton />
          <PostCardSkeleton />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="app-shell pt-0">
        <div className="app-content">
          {Header}
          <div className="px-4 py-12 text-center">
            <p className="mb-4 text-body text-text-secondary">Post not found</p>
            <Link href="/" className="text-amber text-body">
              Back to feed
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const sortedReplies = [...replies].sort((a, b) => {
    const aIsAuthor = a.user_id === post.user_id ? 1 : 0;
    const bIsAuthor = b.user_id === post.user_id ? 1 : 0;
    if (aIsAuthor !== bIsAuthor) return bIsAuthor - aIsAuthor;
    return b.likes_count - a.likes_count;
  });

  return (
    <div className="app-shell pt-0">
      <div className="app-content">
        {Header}

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

        <div ref={focusedPostRef}>
          <PostCard
            post={post}
            liked={likedIds.has(post.id)}
            currentUserId={userId}
            isAdmin={isAdmin}
            isDetail
            seamless={ancestors.length > 0}
            onDeleted={handlePostDeleted}
            onReply={isAuthenticated ? () => setReplyTarget(post) : undefined}
          />
        </div>

        {loading && replies.length === 0 ? (
          <>
            <PostCardSkeleton />
            <PostCardSkeleton />
            <PostCardSkeleton />
          </>
        ) : replies.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-body text-text-tertiary">No replies yet. Be the first.</p>
          </div>
        ) : (
          sortedReplies.map((reply) => {
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
          })
        )}

        {replyTarget && (
          <>
            <div
              className={`fixed inset-0 z-[55] bg-black/60 ${isClosingReplySheet ? "animate-fade-out" : "animate-fade-in"}`}
              onClick={() => closeReplySheet()}
            />
            <div
              className={`fixed inset-x-0 z-[60] ${isClosingReplySheet ? "animate-sheet-down" : "animate-sheet-up"}`}
              style={{
                bottom: isClosingReplySheet ? 0 : keyboardHeight,
                transition: isClosingReplySheet ? "none" : "bottom 0.15s ease-out",
              }}
              onAnimationEnd={handleSheetAnimationEnd}
            >
              <div className="app-content overflow-hidden rounded-t-3xl border border-border bg-surface">
                <div className="flex justify-center pt-2 pb-1">
                  <div className="h-1 w-10 rounded-full bg-border" />
                </div>
                <div className="flex items-center px-4 py-2">
                  <button
                    onClick={() => closeReplySheet()}
                    className="text-body text-text-tertiary transition-colors hover:text-text-primary"
                  >
                    Cancel
                  </button>
                </div>
                <div className="flex gap-3 px-4 pb-2">
                  <div className="flex flex-col items-center">
                    <Avatar name={replyTarget.users?.persona_name ?? "Anonymous"} size={36} />
                    <div className="mt-1.5 min-h-[24px] w-px flex-1 bg-border" />
                  </div>
                  <div className="min-w-0 flex-1 pb-3">
                    <p className="text-body font-semibold text-text-primary">
                      {replyTarget.users?.persona_name ?? "Anonymous"}
                    </p>
                    <p className="mt-0.5 line-clamp-4 whitespace-pre-wrap break-words text-body text-text-secondary">
                      {replyTarget.content}
                    </p>
                  </div>
                </div>
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
    </div>
  );
}
