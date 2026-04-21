"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Avatar } from "@/components/Avatar";
import { PostCard } from "@/components/PostCard";
import { EmptyState, SectionHeading, Spinner } from "@/components/primitives";
import {
  ChevronRightIcon,
  LinkedinIcon,
  LogoutIcon,
  MailIcon,
  PhoneIcon,
  SparkleIcon,
  TrophyIcon,
} from "@/components/icons";
import type { Post } from "@/lib/types";

function ProfileRow({
  icon,
  title,
  subtitle,
  href,
  external,
  tone = "default",
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  href: string;
  external?: boolean;
  tone?: "default" | "amber" | "brand";
}) {
  const tint =
    tone === "amber"
      ? "bg-amber/10 text-amber"
      : tone === "brand"
        ? "bg-brand-500/10 text-brand-400"
        : "bg-surface-hover text-text-secondary";
  const Tag = external ? "a" : Link;
  const extra = external
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {};

  return (
    <Tag
      href={href}
      {...extra}
      className="list-row border border-border/50 bg-surface/60"
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tint}`}>
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
    isAuthenticated,
    userId,
    personaName,
    loading: authLoading,
    logout,
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
      } catch {
        /* silent */
      } finally {
        if (active) setLoadingPosts(false);
      }
    }
    load();
    return () => {
      active = false;
    };
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
          <Spinner />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="app-shell pt-5">
      <div className="app-content space-y-8">
        <section className="surface-hero relative overflow-hidden py-8">
          <div
            aria-hidden
            className="absolute -top-20 left-1/2 h-56 w-[420px] -translate-x-1/2 rounded-full bg-amber/15 blur-3xl"
          />
          <div className="relative flex flex-col items-center">
            <div className="relative">
              <div
                aria-hidden
                className="absolute inset-0 -z-10 rounded-2xl bg-amber/20 blur-xl"
              />
              <Avatar name={personaName || ""} size={80} />
            </div>
            <h1 className="mt-4 text-title font-semibold tracking-tight text-text-primary">
              {personaName}
            </h1>
            <p className="mt-1 flex items-center gap-1.5 text-caption text-text-tertiary">
              <SparkleIcon size={11} className="text-amber" />
              Anonymous identity
            </p>
          </div>
        </section>

        <section>
          <SectionHeading>My posts · {posts.length}</SectionHeading>
          {loadingPosts ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : posts.length === 0 ? (
            <div className="surface-panel">
              <EmptyState
                title="You haven't posted yet"
                description="Share a thought with campus — it takes seconds."
              />
            </div>
          ) : (
            <div className="surface-panel overflow-hidden">
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
        </section>

        <section>
          <SectionHeading>Campus rankings</SectionHeading>
          <ProfileRow
            icon={<TrophyIcon size={20} />}
            title="View leaderboard"
            subtitle="Top hangout crew on campus"
            href="/ranks"
            tone="amber"
          />
        </section>

        <section>
          <SectionHeading>Support</SectionHeading>
          <div className="space-y-2">
            <ProfileRow
              icon={<PhoneIcon size={18} />}
              title="+91 8639012320"
              subtitle="Sreehari · available 24×7"
              href="tel:+918639012320"
              external
            />
            <ProfileRow
              icon={<MailIcon size={18} />}
              title="sreeharixe@gmail.com"
              subtitle="Send us a note"
              href="mailto:sreeharixe@gmail.com"
              external
            />
            <ProfileRow
              icon={<LinkedinIcon size={18} />}
              title="LinkedIn"
              subtitle="Connect with the maker"
              href="https://www.linkedin.com/in/sreeharix/"
              external
              tone="brand"
            />
          </div>
        </section>

        <button
          onClick={handleLogout}
          className="btn-secondary btn-block justify-center gap-2 border-danger/30 bg-danger/5 text-danger hover:border-danger/50 hover:bg-danger/10"
        >
          <LogoutIcon size={18} />
          Log out
        </button>

        <p className="pb-4 text-center text-[11px] text-text-muted">
          HangOwl · Built with love for IIT Bombay
        </p>
      </div>
    </div>
  );
}
