"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { ComposeBox } from "@/components/ComposeBox";
import { PostCard } from "@/components/PostCard";
import type { Post } from "@/lib/types";

export default function FeedPage() {
  const { isAuthenticated, userId, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const observerRef = useRef<HTMLDivElement>(null);

  const fetchFeed = useCallback(async (cursor?: string) => {
    try {
      const data = await api.getFeed(cursor);
      if (cursor) {
        setPosts((prev) => {
          const ids = new Set(prev.map((p) => p.id));
          const newPosts = data.posts.filter((p) => !ids.has(p.id));
          return [...prev, ...newPosts];
        });
      } else {
        setPosts(data.posts);
      }
      setHasMore(data.posts.length >= 20);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      await fetchFeed();
      if (active) setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [fetchFeed]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    async function loadLikes() {
      try {
        const data = await api.getMyLikedPostIds();
        if (active) setLikedIds(new Set(data.post_ids));
      } catch {
        /* silent */
      }
    }
    loadLikes();
    return () => { active = false; };
  }, [isAuthenticated]);

  useEffect(() => {
    const channel = supabase
      .channel("feed-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts", filter: "parent_id=is.null" },
        (payload) => {
          const newPost = payload.new as Post;
          if (newPost.user_id === userId) return;
          setPosts((prev) => {
            if (prev.some((p) => p.id === newPost.id)) return prev;
            return [newPost, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    if (!observerRef.current || !hasMore) return;
    const target = observerRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && posts.length > 0) {
          const lastPost = posts[posts.length - 1];
          setLoadingMore(true);
          fetchFeed(lastPost.created_at).finally(() => setLoadingMore(false));
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, posts, fetchFeed]);

  function handlePosted() {
    fetchFeed();
  }

  function handlePostDeleted(postId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-4 pb-24">
        <div className="h-6 w-6 border-2 border-text-muted/30 border-t-amber rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-16 pb-24 md:pt-6">
      <h1 className="text-xl font-bold text-text-primary mb-4">Feed</h1>

      {isAuthenticated && (
        <div className="mb-6">
          <ComposeBox onPosted={handlePosted} />
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center gap-2 py-12">
          <div className="h-6 w-6 border-2 border-text-muted/30 border-t-amber rounded-full animate-spin" />
          <p className="text-sm text-text-muted">Loading feed...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <p className="text-text-secondary">No posts yet. Be the first to share something!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              liked={likedIds.has(post.id)}
              currentUserId={userId}
              onDeleted={() => handlePostDeleted(post.id)}
            />
          ))}
          <div ref={observerRef} className="h-4" />
          {loadingMore && (
            <div className="flex justify-center py-4">
              <div className="h-5 w-5 border-2 border-text-muted/30 border-t-amber rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
