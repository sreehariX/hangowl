"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Avatar } from "@/components/Avatar";
import { PostCard } from "@/components/PostCard";
import { ComposeBox } from "@/components/ComposeBox";
import type { Post } from "@/lib/types";

interface ReplyTarget {
  id: string;
  name: string;
  content: string;
  isMainPost: boolean; // true = main post, false = a reply (so nav after posting)
}

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.id as string;
  const { isAuthenticated, userId, loading: authLoading } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [parentPost, setParentPost] = useState<Post | null>(null);
  const [replies, setReplies] = useState<Post[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);

  const fetchPost = useCallback(async () => {
    try {
      const data = await api.getPost(postId);
      setPost(data.post);
      setReplies(data.replies);
      // Fetch parent if this post is a reply
      if (data.post.parent_id) {
        api.getPost(data.post.parent_id)
          .then((p) => setParentPost(p.post))
          .catch(() => {});
      } else {
        setParentPost(null);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

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
      } catch {
        /* silent */
      }
    }
    loadUserData();
    return () => { active = false; };
  }, [isAuthenticated]);

  // Live replies for the main post
  useEffect(() => {
    const channel = supabase
      .channel(`post-${postId}-replies`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts", filter: `parent_id=eq.${postId}` },
        (payload) => {
          const newReply = payload.new as Post;
          setReplies((prev) => {
            if (prev.some((r) => r.id === newReply.id)) return prev;
            return [...prev, newReply];
          });
          setPost((prev) =>
            prev ? { ...prev, replies_count: prev.replies_count + 1 } : prev
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [postId]);

  function openReply(target: Post, isMainPost: boolean) {
    setReplyTarget({
      id: target.id,
      name: target.users?.persona_name ?? "Anonymous",
      content: target.content,
      isMainPost,
    });
  }

  function handleReplied() {
    const target = replyTarget;
    setReplyTarget(null);
    if (target && !target.isMainPost) {
      // Replied to a reply → navigate to that reply's thread so the user can see their new post
      router.push(`/feed/${target.id}`);
    } else {
      fetchPost();
    }
  }

  function handlePostDeleted() {
    if (parentPost) {
      router.push(`/feed/${parentPost.id}`);
    } else {
      router.push("/");
    }
  }

  function handleReplyDeleted(replyId: string) {
    setReplies((prev) => prev.filter((r) => r.id !== replyId));
    setPost((prev) =>
      prev ? { ...prev, replies_count: Math.max(0, prev.replies_count - 1) } : prev
    );
  }

  if (loading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-4 pb-24">
        <div className="h-6 w-6 border-2 border-text-muted/30 border-t-amber rounded-full animate-spin" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-16 pb-24 md:pt-6">
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <p className="text-text-secondary mb-4">Post not found</p>
          <Link href="/" className="text-amber hover:text-amber-dark text-sm">
            Back to Feed
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg pb-24">
      {/* Sticky header */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-border sticky top-0 bg-navy/95 backdrop-blur-md z-10">
        <button
          onClick={() => parentPost ? router.push(`/feed/${parentPost.id}`) : router.push("/")}
          className="text-text-muted transition-colors hover:text-text-primary"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
        </button>
        <span className="text-[15px] font-bold text-text-primary">Post</span>
      </div>

      {/* Parent post (thread context) with connector line */}
      {parentPost && (
        <PostCard
          post={parentPost}
          liked={likedIds.has(parentPost.id)}
          currentUserId={userId}
          isAdmin={isAdmin}
          showThreadLine
        />
      )}

      {/* Main post — detail view */}
      <PostCard
        post={post}
        liked={likedIds.has(post.id)}
        currentUserId={userId}
        isAdmin={isAdmin}
        isDetail
        onDeleted={handlePostDeleted}
        onReply={isAuthenticated ? () => openReply(post, true) : undefined}
      />

      {/* Replies section */}
      <div className="px-4 py-3 border-b border-border">
        <span className="text-[13px] font-semibold text-text-secondary">
          Replies ({post.replies_count})
        </span>
      </div>

      {replies.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-text-muted">No replies yet</p>
        </div>
      ) : (
        <div>
          {replies.map((reply) => (
            <PostCard
              key={reply.id}
              post={reply}
              liked={likedIds.has(reply.id)}
              currentUserId={userId}
              isAdmin={isAdmin}
              onDeleted={() => handleReplyDeleted(reply.id)}
              onReply={isAuthenticated ? () => openReply(reply, false) : undefined}
            />
          ))}
        </div>
      )}

      {/* FAB */}
      {isAuthenticated && !replyTarget && (
        <button
          onClick={() => openReply(post, true)}
          className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-amber text-navy shadow-lg shadow-amber/30 transition-all hover:bg-amber-dark hover:shadow-xl active:scale-90 md:right-[calc(50%-256px+16px)]"
          aria-label="Reply"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
          </svg>
        </button>
      )}

      {/* Reply modal */}
      {replyTarget && (
        <div className="fixed inset-0 z-50 bg-navy animate-fade-in">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <button
              onClick={() => setReplyTarget(null)}
              className="text-text-muted hover:text-text-primary transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-text-primary">Reply</span>
            <div className="w-5" />
          </div>
          <div className="px-4 py-3 border-b border-border/50 flex gap-3">
            <div className="flex flex-col items-center gap-1">
              <Avatar name={replyTarget.name} size={32} />
              <div className="w-0.5 flex-1 bg-border/50" />
            </div>
            <div className="flex-1 min-w-0 pb-3">
              <p className="text-[13px] font-bold text-text-primary">{replyTarget.name}</p>
              <p className="text-[13px] text-text-secondary mt-0.5 line-clamp-3 whitespace-pre-wrap break-words">{replyTarget.content}</p>
              <p className="text-xs text-text-muted mt-2">
                Replying to <span className="text-amber">{replyTarget.name}</span>
              </p>
            </div>
          </div>
          <div className="mx-auto max-w-lg px-4 pt-3">
            <ComposeBox
              parentId={replyTarget.id}
              placeholder="Post your reply"
              onPosted={handleReplied}
              autoFocus
            />
          </div>
        </div>
      )}
    </div>
  );
}
