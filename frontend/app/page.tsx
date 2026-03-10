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
  const [showCompose, setShowCompose] = useState(false);
  const [queuedPosts, setQueuedPosts] = useState<Post[]>([]);
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
          setQueuedPosts((prev) => {
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

  function showQueuedPosts() {
    setPosts((prev) => {
      const ids = new Set(prev.map((p) => p.id));
      const fresh = queuedPosts.filter((p) => !ids.has(p.id));
      return [...fresh, ...prev];
    });
    setQueuedPosts([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handlePosted() {
    setShowCompose(false);
    fetchFeed();
  }

  function handlePostDeleted(postId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pb-24 relative">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-text-primary tracking-tight">HangOwl</h1>
        <div className="flex items-center gap-3">
          {stats && (
            <span className="text-[11px] font-medium text-text-muted tabular-nums">
              {stats.total_users} students
            </span>
          )}
          {stats && (
            <div className="flex items-center gap-1 text-[11px] font-medium">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
              </span>
              <span className="text-success tabular-nums">{stats.free_now}</span>
            </div>
          )}
        </div>
      </div>

      {/* Trust text */}
      {!authLoading && (
        <p className="text-[11px] text-text-muted mb-4">
          Every student is verified with their IITB email. Completely anonymous.
        </p>
      )}

      {/* Logged-out hero */}
      {!authLoading && !isAuthenticated && (
        <section className="mb-6 rounded-2xl border border-border bg-surface p-6 text-center">
          <div className="text-4xl mb-3">🦉</div>
          <h2 className="text-lg font-bold text-text-primary mb-1">
            Find your people at IIT Bombay
          </h2>
          <p className="text-sm text-text-secondary mb-2">
            Every student is verified with their IITB email. Your identity stays completely anonymous.
          </p>
          {stats && (
            <p className="text-xs text-text-muted mb-4">
              {stats.total_users} students already here
            </p>
          )}
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

      {/* New posts pill (Twitter-style) */}
      {queuedPosts.length > 0 && (
        <button
          onClick={showQueuedPosts}
          className="sticky top-2 z-40 mx-auto mb-3 flex items-center gap-1.5 rounded-full bg-mid-blue px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-mid-blue/30 transition-all hover:bg-mid-blue-light active:scale-95 animate-slide-down-in w-fit left-0 right-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
          Show {queuedPosts.length} new post{queuedPosts.length !== 1 ? "s" : ""}
        </button>
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
        <>
          <div className="rounded-2xl border border-border overflow-hidden">
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
          </div>
          <div ref={observerRef} className="h-4" />
          {loadingMore && (
            <div className="flex justify-center py-4">
              <div className="h-5 w-5 border-2 border-text-muted/30 border-t-amber rounded-full animate-spin" />
            </div>
          )}
        </>
      )}

      {/* Compose FAB + Modal */}
      {isAuthenticated && !showCompose && (
        <button
          onClick={() => setShowCompose(true)}
          className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-amber text-navy shadow-lg shadow-amber/30 transition-all hover:bg-amber-dark hover:shadow-xl active:scale-90 md:right-[calc(50%-256px+16px)]"
          aria-label="New post"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
        </button>
      )}

      {showCompose && (
        <div className="fixed inset-0 z-50 bg-navy animate-fade-in">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <button
              onClick={() => setShowCompose(false)}
              className="text-sm text-text-muted hover:text-text-primary transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-text-primary">New post</span>
            <div className="w-5" />
          </div>
          <div className="mx-auto max-w-lg px-4 pt-4">
            <ComposeBox onPosted={handlePosted} placeholder="What's happening?" autoFocus />
          </div>
        </div>
      )}
    </div>
  );
}
