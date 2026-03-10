"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { ComposeBox } from "@/components/ComposeBox";
import { PostCard } from "@/components/PostCard";
import type { Post, Stats } from "@/lib/types";

export default function FeedHomePage() {
  const { isAuthenticated, userId, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
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
    let active = true;
    async function loadStats() {
      try {
        const data = await api.getStats();
        if (active) setStats(data);
      } catch { /* silent */ }
    }
    loadStats();
    const si = setInterval(loadStats, 30000);
    return () => { active = false; clearInterval(si); };
  }, []);

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

  useEffect(() => {
    if (!isAuthenticated) return;
    api.heartbeat().catch(() => {});
    const hb = setInterval(() => api.heartbeat().catch(() => {}), 60000);
    return () => clearInterval(hb);
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

    return () => { supabase.removeChannel(channel); };
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

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pb-24">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-text-primary tracking-tight">HangOwl</h1>
        {stats && (
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-text-muted">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
            </span>
            <span className="text-success tabular-nums">{stats.free_now}</span>
            online
          </div>
        )}
      </div>

      {/* Logged-out hero */}
      {!authLoading && !isAuthenticated && (
        <section className="mb-8 rounded-2xl border border-border bg-surface p-6 text-center">
          <div className="text-4xl mb-3">🦉</div>
          <h2 className="text-lg font-bold text-text-primary mb-1">
            Find your people at IIT Bombay
          </h2>
          <p className="text-sm text-text-secondary mb-5">
            Post what you want to do. Others join anonymously.
          </p>
          <Link
            href="/verify"
            className="inline-block w-full rounded-xl bg-amber py-3 font-semibold text-navy transition-all hover:bg-amber-dark active:scale-[0.98]"
          >
            Join with IIT-B email
          </Link>
          <p className="text-[11px] text-text-muted mt-2">
            No signup. No password. Just a one-time code.
          </p>
        </section>
      )}

      {/* Live hangouts nudge */}
      {stats && stats.active_plans > 0 && (
        <Link
          href="/hangouts"
          className="flex items-center justify-between mb-4 rounded-xl border border-amber/20 bg-amber/5 px-4 py-2.5 transition-colors hover:bg-amber/10 active:scale-[0.99]"
        >
          <span className="text-xs font-medium text-amber">
            {stats.active_plans} hangout{stats.active_plans !== 1 ? "s" : ""} happening now
          </span>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      )}

      {/* Compose */}
      {isAuthenticated && (
        <div className="mb-5">
          <ComposeBox onPosted={handlePosted} />
        </div>
      )}

      {/* Feed */}
      {loading ? (
        <div className="flex flex-col items-center gap-2 py-16">
          <div className="h-6 w-6 border-2 border-text-muted/30 border-t-amber rounded-full animate-spin" />
          <p className="text-sm text-text-muted">Loading...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-10 text-center">
          <p className="text-text-secondary text-sm">No posts yet. Be the first to share something!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              liked={likedIds.has(post.id)}
              currentUserId={userId}
              isAdmin={isAdmin}
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
