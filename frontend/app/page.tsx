"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { postCache } from "@/lib/post-cache";
import { supabase } from "@/lib/supabase";
import { ComposeBox } from "@/components/ComposeBox";
import { FeedSkeleton } from "@/components/Skeleton";
import { PostCard } from "@/components/PostCard";
import { EmptyState, Spinner } from "@/components/primitives";
import {
  ChevronRightIcon,
  ChevronUpIcon,
  CloseIcon,
  PlusIcon,
  SparkleIcon,
} from "@/components/icons";
import type { Post, Stats } from "@/lib/types";

const FEED_CACHE_KEY = "ho_feed_cache_v1";

export default function FeedHomePage() {
  const { isAuthenticated, userId, loading: authLoading } = useAuth();

  const [posts, setPosts] = useState<Post[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const cached = localStorage.getItem(FEED_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as Post[];
        parsed.forEach((p) => {
          postCache.set(p.id, p);
          if (p.top_reply) postCache.set(p.top_reply.id, p.top_reply);
        });
        return parsed;
      }
    } catch {}
    return [];
  });
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return !localStorage.getItem(FEED_CACHE_KEY);
    } catch {}
    return true;
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [queuedPosts, setQueuedPosts] = useState<Post[]>([]);
  const observerRef = useRef<HTMLDivElement>(null);

  const fetchFeed = useCallback(async (cursor?: string) => {
    try {
      const data = await api.getFeed(cursor);
      data.posts.forEach((p) => {
        postCache.set(p.id, p);
        if (p.top_reply) postCache.set(p.top_reply.id, p.top_reply);
      });
      if (cursor) {
        setPosts((prev) => {
          const ids = new Set(prev.map((p) => p.id));
          const newPosts = data.posts.filter((p) => !ids.has(p.id));
          return [...prev, ...newPosts];
        });
      } else {
        setPosts(data.posts);
        try {
          localStorage.setItem(FEED_CACHE_KEY, JSON.stringify(data.posts));
        } catch {}
      }
      setHasMore(data.posts.length >= 20);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      await fetchFeed();
      if (active) setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [fetchFeed]);

  useEffect(() => {
    let active = true;
    async function loadStats() {
      if (document.hidden) return;
      try {
        const data = await api.getStats();
        if (active) setStats(data);
      } catch {
        /* silent */
      }
    }
    loadStats();
    const si = setInterval(loadStats, 60000);
    const onVisible = () => {
      if (!document.hidden) loadStats();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      clearInterval(si);
      document.removeEventListener("visibilitychange", onVisible);
    };
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
      } catch {
        /* silent */
      }
    }
    loadUserData();
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    api.heartbeat().catch(() => {});
    const hb = setInterval(() => api.heartbeat().catch(() => {}), 120000);
    return () => clearInterval(hb);
  }, [isAuthenticated]);

  useEffect(() => {
    const channel = supabase
      .channel("feed-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "posts",
          filter: "parent_id=is.null",
        },
        (payload) => {
          const newPost = payload.new as Post;
          if (newPost.user_id === userId) return;
          setQueuedPosts((prev) =>
            prev.some((p) => p.id === newPost.id) ? prev : [newPost, ...prev],
          );
        },
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
        if (
          entries[0].isIntersecting &&
          hasMore &&
          !loadingMore &&
          posts.length > 0
        ) {
          const lastPost = posts[posts.length - 1];
          setLoadingMore(true);
          fetchFeed(lastPost.created_at).finally(() => setLoadingMore(false));
        }
      },
      { threshold: 0.1 },
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
    <div className="app-shell pt-5">
      <div className="app-content relative">
        {/* Top bar */}
        <header className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-title-lg font-semibold tracking-tight text-text-primary">
              HangOwl
            </h1>
            <p className="text-caption text-text-tertiary">
              Campus social, designed for clarity.
            </p>
          </div>
          {stats && (
            <div className="surface-glass flex items-center gap-3 px-3.5 py-2">
              <span className="text-[11px] font-medium tabular-nums text-text-tertiary">
                {stats.total_users} students
              </span>
              <span className="h-3.5 w-px bg-border" />
              <span className="flex items-center gap-1.5 text-[11px] font-semibold">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                </span>
                <span className="tabular-nums text-success">{stats.free_now}</span>
                <span className="text-text-tertiary">free</span>
              </span>
            </div>
          )}
        </header>

        {/* Trust text */}
        {!authLoading && (
          <p className="mb-4 flex items-center gap-1.5 text-[11px] text-text-tertiary">
            <SparkleIcon size={12} className="text-amber" />
            Every student is verified with their IITB email. Completely anonymous.
          </p>
        )}

        {/* Logged-out hero */}
        {!authLoading && !isAuthenticated && (
          <section className="surface-hero mb-6 overflow-hidden p-7 text-center">
            <div
              aria-hidden
              className="absolute -top-16 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full bg-amber/15 blur-3xl"
            />
            <div className="relative">
              <div className="mb-3 text-4xl">🦉</div>
              <h2 className="mb-2 text-title font-semibold tracking-tight text-text-primary">
                Find your people at IIT Bombay
              </h2>
              <p className="mx-auto mb-5 max-w-[360px] text-body text-text-secondary">
                Every student is verified with their IITB email. Your identity stays
                completely anonymous.
              </p>
              {stats && (
                <p className="mb-4 text-caption text-text-tertiary">
                  <span className="font-semibold tabular-nums text-amber">
                    {stats.total_users}
                  </span>{" "}
                  students already here
                </p>
              )}
              <Link href="/verify" className="btn-primary btn-lg btn-block">
                Join with IIT-B email
              </Link>
              <p className="mt-3 text-[11px] text-text-tertiary">
                No signup. No password. Just a one-time code.
              </p>
            </div>
          </section>
        )}

        {/* Live hangouts nudge */}
        {stats && stats.active_plans > 0 && (
          <Link
            href="/hangouts"
            className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-amber/20 bg-gradient-to-r from-amber/10 to-amber/5 px-4 py-3 transition-all duration-200 hover:border-amber/40 hover:from-amber/15 active:scale-[0.99]"
          >
            <span className="flex items-center gap-2 text-caption font-semibold text-amber">
              <span className="flex h-1.5 w-1.5 rounded-full bg-amber">
                <span className="animate-ping absolute h-1.5 w-1.5 rounded-full bg-amber" />
              </span>
              {stats.active_plans} hangout
              {stats.active_plans !== 1 ? "s" : ""} happening now
            </span>
            <ChevronRightIcon size={14} className="text-amber" />
          </Link>
        )}

        {/* New posts pill */}
        {queuedPosts.length > 0 && (
          <button
            onClick={showQueuedPosts}
            className="sticky left-0 right-0 top-3 z-40 mx-auto mb-3 flex w-fit animate-slide-down-in items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-glow-brand transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <ChevronUpIcon size={14} />
            Show {queuedPosts.length} new post{queuedPosts.length !== 1 ? "s" : ""}
          </button>
        )}

        {/* Feed */}
        {loading ? (
          <FeedSkeleton />
        ) : posts.length === 0 ? (
          <div className="surface-panel">
            <EmptyState
              icon={<SparkleIcon size={26} />}
              title="No posts yet"
              description="Be the first to share something on campus."
            />
          </div>
        ) : (
          <>
            <div className="surface-panel overflow-hidden">
              {posts.map((post) => (
                <Fragment key={post.id}>
                  <PostCard
                    post={post}
                    liked={likedIds.has(post.id)}
                    currentUserId={userId}
                    isAdmin={isAdmin}
                    onDeleted={() => handlePostDeleted(post.id)}
                    showThreadLine={!!post.top_reply}
                  />
                  {post.top_reply && (
                    <PostCard
                      post={post.top_reply}
                      liked={likedIds.has(post.top_reply.id)}
                      currentUserId={userId}
                      isAdmin={isAdmin}
                      seamless
                    />
                  )}
                </Fragment>
              ))}
            </div>
            <div ref={observerRef} className="h-4" />
            {loadingMore && (
              <div className="flex justify-center py-4">
                <Spinner />
              </div>
            )}
          </>
        )}

        {/* Compose FAB + Modal */}
        {isAuthenticated && !showCompose && (
          <button
            onClick={() => setShowCompose(true)}
            className="fab bottom-28 right-4 md:right-[calc(50%-260px+8px)]"
            aria-label="New post"
          >
            <PlusIcon size={24} />
          </button>
        )}

        {showCompose && (
          <div className="fixed inset-0 z-50 animate-fade-in bg-ink-950/85 backdrop-blur-xl">
            <div className="sticky-bar">
              <button
                onClick={() => setShowCompose(false)}
                className="icon-btn"
                aria-label="Close"
              >
                <CloseIcon size={20} />
              </button>
              <span className="flex-1 text-center text-[15px] font-semibold text-text-primary">
                New post
              </span>
              <div className="h-9 w-9" aria-hidden />
            </div>
            <div className="app-content px-4 pt-4">
              <ComposeBox
                onPosted={handlePosted}
                placeholder="What's happening at IITB?"
                autoFocus
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
