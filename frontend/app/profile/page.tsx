"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Avatar } from "@/components/Avatar";
import { PostCard } from "@/components/PostCard";
import { FeedSkeleton } from "@/components/Skeleton";
import { EmptyState, SectionHeading, Spinner } from "@/components/primitives";
import {
  ChevronRightIcon,
  LinkedinIcon,
  LogoutIcon,
  MailIcon,
  PhoneIcon,
  TrophyIcon,
} from "@/components/icons";
import type { Post } from "@/lib/types";

function ProfileRow({
  icon, title, subtitle, href, external,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  href: string;
  external?: boolean;
}) {
  const Tag = external ? "a" : Link;
  const extra = external ? { target: "_blank", rel: "noopener noreferrer" } : {};

  return (
    <Tag
      href={href}
      {...extra}
      className="flex items-center gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-surface-hover/40"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-hover text-text-secondary">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-medium text-text-primary">{title}</p>
        {subtitle && (
          <p className="truncate text-caption text-text-tertiary">{subtitle}</p>
        )}
      </div>
      <ChevronRightIcon size={16} className="shrink-0 text-text-muted" />
    </Tag>
  );
}

export default function ProfilePage() {
  const {
    isAuthenticated, userId, personaName, loading: authLoading, logout,
  } = useAuth();
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
    (async () => {
      try {
        const [postsData, likesData] = await Promise.all([
          api.getMyPosts(),
          api.getMyLikedPostIds(),
        ]);
        if (active) {
          setPosts(postsData.posts);
          setLikedIds(new Set(likesData.post_ids));
        }
      } catch {}
      finally { if (active) setLoadingPosts(false); }
    })();
    return () => { active = false; };
  }, [isAuthenticated]);

  function handleLogout() { logout(); router.push("/"); }
  function handlePostDeleted(postId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  if (authLoading) {
    return (
      <div className="app-shell pt-10">
        <div className="flex justify-center">
          <Spinner />
        </div>
      </div>
    );
  }
  if (!isAuthenticated) return null;

  return (
    <div className="app-shell pt-0">
      <div className="app-content">
        <div className="top-bar">
          <h1 className="text-[17px] font-semibold text-text-primary">Profile</h1>
        </div>

        <section className="flex flex-col items-center border-b border-border px-4 py-10">
          <Avatar name={personaName || ""} size={84} />
          <h2 className="mt-4 text-title-lg font-semibold tracking-tight text-text-primary">
            {personaName}
          </h2>
          <p className="mt-1 text-caption text-text-tertiary">
            Your anonymous identity on HangOwl
          </p>
        </section>

        <section className="py-4">
          <div className="px-4">
            <SectionHeading>My posts · {posts.length}</SectionHeading>
          </div>
          {loadingPosts ? (
            <FeedSkeleton count={2} />
          ) : posts.length === 0 ? (
            <EmptyState
              title="You haven't posted yet"
              description="Share a thought with campus."
            />
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                liked={likedIds.has(post.id)}
                currentUserId={userId}
                onDeleted={() => handlePostDeleted(post.id)}
              />
            ))
          )}
        </section>

        <section className="border-t border-border py-4">
          <div className="px-4">
            <SectionHeading>More</SectionHeading>
          </div>
          <ProfileRow
            icon={<TrophyIcon size={18} />}
            title="Leaderboard"
            subtitle="Top hangout crew on campus"
            href="/ranks"
          />
          <ProfileRow
            icon={<PhoneIcon size={16} />}
            title="+91 8639012320"
            subtitle="Sreehari · available 24×7"
            href="tel:+918639012320"
            external
          />
          <ProfileRow
            icon={<MailIcon size={16} />}
            title="sreeharixe@gmail.com"
            subtitle="Send a note"
            href="mailto:sreeharixe@gmail.com"
            external
          />
          <ProfileRow
            icon={<LinkedinIcon size={16} />}
            title="LinkedIn"
            subtitle="Connect with the maker"
            href="https://www.linkedin.com/in/sreeharix/"
            external
          />
        </section>

        <div className="px-4 py-4">
          <button
            onClick={handleLogout}
            className="btn-secondary btn-block justify-center gap-2 text-danger hover:bg-danger/5"
          >
            <LogoutIcon size={16} />
            Log out
          </button>
          <p className="mt-4 text-center text-[11px] text-text-muted">
            HangOwl · Built for IIT Bombay
          </p>
        </div>
      </div>
    </div>
  );
}
