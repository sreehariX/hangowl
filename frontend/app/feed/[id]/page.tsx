"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { PostCard } from "@/components/PostCard";
import { ComposeBox } from "@/components/ComposeBox";
import type { Post } from "@/lib/types";

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.id as string;
  const { isAuthenticated, userId, loading: authLoading } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [replies, setReplies] = useState<Post[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchPost = useCallback(async () => {
    try {
      const data = await api.getPost(postId);
      setPost(data.post);
      setReplies(data.replies);
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId]);

  function handleReplied() {
    fetchPost();
  }

  function handlePostDeleted() {
    router.push("/feed");
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
          <Link href="/feed" className="text-amber hover:text-amber-dark text-sm">
            Back to Feed
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-16 pb-24 md:pt-6">
      <Link
        href="/feed"
        className="mb-4 inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-text-primary"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 19-7-7 7-7" />
          <path d="M19 12H5" />
        </svg>
        Back to Feed
      </Link>

      <PostCard
        post={post}
        liked={likedIds.has(post.id)}
        currentUserId={userId}
        isAdmin={isAdmin}
        onDeleted={handlePostDeleted}
      />

      <div className="mt-6 mb-4">
        <h2 className="text-sm font-semibold text-text-secondary">
          Replies ({post.replies_count})
        </h2>
      </div>

      {isAuthenticated && (
        <div className="mb-4">
          <ComposeBox
            parentId={postId}
            placeholder="Write a reply..."
            onPosted={handleReplied}
          />
        </div>
      )}

      {replies.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-6 text-center">
          <p className="text-sm text-text-muted">No replies yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {replies.map((reply) => (
            <PostCard
              key={reply.id}
              post={reply}
              liked={likedIds.has(reply.id)}
              currentUserId={userId}
              isAdmin={isAdmin}
              isReply
              onDeleted={() => handleReplyDeleted(reply.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
