"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Avatar } from "@/components/Avatar";
import { PostCard } from "@/components/PostCard";
import type { Post } from "@/lib/types";

export default function ProfilePage() {
  const { isAuthenticated, userId, personaName, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [loadingPosts, setLoadingPosts] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/verify");
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    async function load() {
      try {
        const [postsData, likesData] = await Promise.all([
          api.getMyPosts(),
          api.getMyLikedPostIds(),
        ]);
        if (active) {
          setPosts(postsData.posts);
          setLikedIds(new Set(likesData.post_ids));
        }
      } catch { /* silent */ }
      finally { if (active) setLoadingPosts(false); }
    }
    load();
    return () => { active = false; };
  }, [isAuthenticated]);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  function handlePostDeleted(postId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  if (authLoading) {
    return (
      <div className="app-shell pt-10">
        <div className="app-content flex min-h-[50dvh] items-center justify-center pb-24">
          <div className="h-6 w-6 border-2 border-text-muted/30 border-t-amber rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="app-shell pt-5">
      <div className="app-content">
      {/* Profile header */}
      <div className="hero-surface mb-6 flex flex-col items-center py-7">
        <Avatar name={personaName || ""} size={72} />
        <h1 className="mt-3 text-lg font-bold text-text-primary">{personaName}</h1>
        <p className="text-xs text-text-muted mt-0.5">Anonymous identity</p>
      </div>

      {/* My Posts */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-text-secondary mb-3">
          My posts ({posts.length})
        </h2>
        {loadingPosts ? (
          <div className="flex justify-center py-8">
            <div className="h-5 w-5 border-2 border-text-muted/30 border-t-amber rounded-full animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="panel-surface p-6 text-center">
            <p className="text-sm text-text-muted">No posts yet</p>
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
          </div>
        )}
      </div>

      {/* Ranks */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-text-secondary mb-3">Campus rankings</h2>
        <a
          href="/ranks"
          className="panel-surface flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-surface-hover active:scale-[0.99]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber shrink-0">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
            <path d="M4 22h16" />
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary">View leaderboard</p>
            <p className="text-[11px] text-text-muted">Top hangout crew on campus</p>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted shrink-0">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </a>
      </div>

      {/* Contact */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-text-secondary mb-3">Contact</h2>
        <div className="space-y-2">
          <a
            href="tel:+918639012320"
            className="panel-surface flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-surface-hover active:scale-[0.99]"
          >
            <span className="text-lg">📞</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary">+91 8639012320</p>
              <p className="text-[11px] text-text-muted">Sreehari - available 24x7</p>
            </div>
          </a>
          <a
            href="mailto:sreeharixe@gmail.com"
            className="panel-surface flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-surface-hover active:scale-[0.99]"
          >
            <span className="text-lg">📧</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary">sreeharixe@gmail.com</p>
            </div>
          </a>
          <a
            href="https://www.linkedin.com/in/sreeharix/"
            target="_blank"
            rel="noopener noreferrer"
            className="panel-surface flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-surface-hover active:scale-[0.99]"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#0A66C2] shrink-0">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            <p className="text-sm font-medium text-text-primary">LinkedIn</p>
          </a>
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full rounded-xl border border-error/30 py-3 text-sm font-medium text-error transition-colors hover:bg-error/10"
      >
        Log out
      </button>

      <p className="text-center text-[11px] text-text-muted mt-6">
        HangOwl &middot; Built for IIT Bombay students
      </p>
      </div>
    </div>
  );
}
