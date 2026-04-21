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
    try { return !localStorage.getItem(FEED_CACHE_KEY); }
    catch { return true; }
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
          return [...prev, ...data.posts.filter((p) => !ids.has(p.id))];
        });
      } else {
        setPosts(data.posts);
        try { localStorage.setItem(FEED_CACHE_KEY, JSON.stringify(data.posts)); } catch {}
      }
      setHasMore(data.posts.length >= 20);
    } catch {}
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      await fetchFeed();
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [fetchFeed]);

  useEffect(() => {
    let active = true;
    async function loadStats() {
      if (document.hidden) return;
      try {
        const data = await api.getStats();
        if (active) setStats(data);
      } catch {}
    }
    loadStats();
    const si = setInterval(loadStats, 60000);
    const onVisible = () => { if (!document.hidden) loadStats(); };
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
    (async () => {
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
    })();
    return () => { active = false; };
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
        { event: "INSERT", schema: "public", table: "posts", filter: "parent_id=is.null" },
        (payload) => {
          const newPost = payload.new as Post;
          if (newPost.user_id === userId) return;
          setQueuedPosts((prev) =>
            prev.some((p) => p.id === newPost.id) ? prev : [newPost, ...prev],
          );
        },
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
          const last = posts[posts.length - 1];
          setLoadingMore(true);
          fetchFeed(last.created_at).finally(() => setLoadingMore(false));
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
    <div className="app-shell pt-0">
      <div className="app-content relative">
        <header className="sticky-bar">
          <h1 className="text-[17px] font-semibold text-text-primary">Feed</h1>
          {stats && (
            <span className="ml-auto flex items-center gap-2 text-[11px] font-medium text-text-tertiary">
              <span className="inline-flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-70 animate-pulse" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                </span>
                <span className="tabular-nums text-success">{stats.free_now}</span>
                <span>online</span>
              </span>
              <span className="h-3 w-px bg-border" aria-hidden />
              <span className="inline-flex items-center gap-1">
                <span className="tabular-nums text-text-secondary">
                  {stats.total_users}
                </span>
                <span>students</span>
              </span>
            </span>
          )}
        </header>

        {!authLoading && !isAuthenticated && (
          <section className="border-b border-border px-4 py-10 text-center">
            <div className="mb-3 text-3xl">🦉</div>
            <h2 className="mb-1.5 text-title font-semibold text-text-primary">
              Find your people at IIT Bombay
            </h2>
            <p className="mx-auto mb-2 max-w-[360px] text-body text-text-secondary">
              Verified IIT-B students. Everyone here went through @iitb.ac.in
              — but every name on HangOwl is anonymous.
            </p>
            {stats && (
              <p className="mx-auto mb-5 text-caption text-text-tertiary">
                <span className="font-semibold tabular-nums text-text-secondary">
                  {stats.total_users}
                </span>{" "}
                students joined ·{" "}
                <span className="font-semibold tabular-nums text-success">
                  {stats.free_now}
                </span>{" "}
                online now
              </p>
            )}
            <Link href="/verify" className="btn-primary btn-lg inline-flex">
              Sign in with IIT-B email
            </Link>
          </section>
        )}

        {stats && stats.active_plans > 0 && (
          <Link
            href="/hangouts"
            className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-surface-hover/50"
          >
            <span className="flex items-center gap-2 text-caption font-medium text-text-primary">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-amber opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber" />
              </span>
              {stats.active_plans} hangout
              {stats.active_plans !== 1 ? "s" : ""} happening now
            </span>
            <ChevronRightIcon size={14} className="text-text-tertiary" />
          </Link>
        )}

        {queuedPosts.length > 0 && (
          <div className="flex justify-center py-2">
            <button
              onClick={showQueuedPosts}
              className="flex animate-slide-down-in items-center gap-1.5 rounded-full bg-amber px-4 py-1.5 text-xs font-semibold text-ink-950 transition-opacity hover:opacity-90"
            >
              <ChevronUpIcon size={14} />
              Show {queuedPosts.length} new post{queuedPosts.length !== 1 ? "s" : ""}
            </button>
          </div>
        )}

        {loading ? (
          <FeedSkeleton />
        ) : posts.length === 0 ? (
          <EmptyState
            icon={<SparkleIcon size={22} />}
            title="No posts yet"
            description="Be the first to share something on campus."
          />
        ) : (
          <>
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
            <div ref={observerRef} className="h-4" />
            {loadingMore && (
              <div className="flex justify-center py-4">
                <Spinner />
              </div>
            )}
          </>
        )}

        {isAuthenticated && !showCompose && (
          <button
            onClick={() => setShowCompose(true)}
            className="fab bottom-24 right-4 md:right-[calc(50%-300px+16px)]"
            aria-label="New post"
          >
            <PlusIcon size={24} />
          </button>
        )}

        {showCompose && (
          <div className="fixed inset-0 z-[70] animate-fade-in bg-ink-900">
            <div className="sticky-bar">
              <button
                onClick={() => setShowCompose(false)}
                className="icon-btn"
                aria-label="Close"
              >
                <CloseIcon size={20} />
              </button>
              <span className="text-[17px] font-semibold text-text-primary">
                New post
              </span>
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
