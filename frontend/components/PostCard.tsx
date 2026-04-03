"use client";

import Link from "next/link";
import { memo, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { ImageLightbox } from "@/components/ImageLightbox";
import { ProgressiveImage } from "@/components/ProgressiveImage";
import { api } from "@/lib/api";
import type { Post } from "@/lib/types";

// localStorage-backed dedup with 24h TTL — survives app reopen but re-counts after a day
const VIEWS_KEY = "ho_viewed_v2";
const VIEWS_TTL = 24 * 60 * 60 * 1000;

function getViewedStore(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(VIEWS_KEY) || "{}");
  } catch {
    return {};
  }
}

function hasViewed(id: string): boolean {
  const store = getViewedStore();
  return !!store[id] && Date.now() < store[id];
}

function addViewed(id: string): void {
  try {
    const store = getViewedStore();
    if (store[id] && Date.now() < store[id]) return;
    store[id] = Date.now() + VIEWS_TTL;
    // Prune expired + keep max 500
    const pruned = Object.entries(store)
      .filter(([, exp]) => Date.now() < exp)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 500);
    localStorage.setItem(VIEWS_KEY, JSON.stringify(Object.fromEntries(pruned)));
  } catch {}
}

function formatViewCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

// Twitter-style relative time: 5s · 3m · 2h · Apr 1 · Apr 1, 2024
function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${Math.max(0, s)}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = new Date(iso);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Kolkata",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

// Twitter full date: "4:30 PM · Apr 1, 2026"
function formatFullDate(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
  const date = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  return `${time} · ${date}`;
}

const BAN_OPTIONS = [
  { type: "1_week", label: "1 week" },
  { type: "1_month", label: "1 month" },
  { type: "permanent", label: "Permanent" },
] as const;

interface PostCardProps {
  post: Post;
  liked?: boolean;
  currentUserId?: string | null;
  isAdmin?: boolean;
  isReply?: boolean;
  isDetail?: boolean;
  onDeleted?: () => void;
  onReply?: () => void;
}

const PostCard = memo(function PostCard({ post, liked: initialLiked, currentUserId, isAdmin, isReply, isDetail, onDeleted, onReply }: PostCardProps) {
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [liked, setLiked] = useState(initialLiked ?? false);
  const [liking, setLiking] = useState(false);
  const [likeAnim, setLikeAnim] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showBanMenu, setShowBanMenu] = useState(false);
  const [banning, setBanning] = useState(false);
  const [banDone, setBanDone] = useState<string | null>(null);
  const [doubleTapHeart, setDoubleTapHeart] = useState(false);
  const [viewsCount, setViewsCount] = useState(post.views_count ?? 0);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const lastTapRef = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  // Track impression: count a view after card is 50% visible for 1s
  useEffect(() => {
    if (hasViewed(post.id)) return;
    const el = cardRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          timer = setTimeout(() => {
            if (hasViewed(post.id)) return;
            addViewed(post.id);
            api.recordPostView(post.id).catch(() => {});
            setViewsCount((c) => c + 1);
            observer.disconnect();
          }, 1000);
        } else {
          if (timer) clearTimeout(timer);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [post.id]);

  const personaName = post.users?.persona_name ?? "Anonymous";
  const isAuthor = currentUserId === post.user_id;
  const canDelete = isAuthor || isAdmin;

  async function handleLike() {
    if (liking || !currentUserId) return;
    setLiking(true);
    const prevLiked = liked;
    const prevCount = likesCount;
    const nowLiked = !liked;
    setLiked(nowLiked);
    setLikesCount(liked ? Math.max(0, likesCount - 1) : likesCount + 1);
    if (nowLiked) {
      setLikeAnim(true);
      setTimeout(() => setLikeAnim(false), 400);
    }

    try {
      const res = await api.toggleLike(post.id);
      setLiked(res.liked);
      setLikesCount(res.likes_count);
    } catch {
      setLiked(prevLiked);
      setLikesCount(prevCount);
    } finally {
      setLiking(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      if (isAdmin && !isAuthor) {
        await api.adminDeletePost(post.id);
      } else {
        await api.deletePost(post.id);
      }
      onDeleted?.();
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function handleBan(banType: string) {
    setBanning(true);
    try {
      await api.banUser(post.user_id, banType);
      setBanDone(banType);
      setShowBanMenu(false);
    } catch {
      /* silent */
    } finally {
      setBanning(false);
    }
  }

  function handleDoubleTap(e: React.MouseEvent | React.TouchEvent) {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      e.preventDefault();
      e.stopPropagation();
      if (!liked && currentUserId) {
        handleLike();
      }
      setDoubleTapHeart(true);
      setTimeout(() => setDoubleTapHeart(false), 600);
    }
    lastTapRef.current = now;
  }

  function handleShare() {
    const url = `${window.location.origin}/feed/${post.id}`;
    if (navigator.share) {
      navigator.share({ text: post.content.slice(0, 100), url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  }

  const content = (
    <div
      ref={cardRef}
      className={`border-b border-border px-4 py-3.5 transition-colors ${
        !isReply && !isDetail ? "hover:bg-surface-hover/50" : ""
      } ${isDetail ? "pb-0 border-b-0" : ""}`}
    >
      <div className="flex gap-3">
        <Avatar name={personaName} size={isDetail ? 44 : 40} className="shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">

          {/* Header row: Name · time (feed) or just Name (detail) */}
          <div className="flex items-center gap-0 min-w-0">
            <span className={`font-bold text-text-primary truncate ${isDetail ? "text-[16px]" : "text-[15px]"}`}>
              {personaName}
            </span>
            {!isDetail && (
              <>
                <span className="mx-1.5 text-text-muted text-[13px] shrink-0">·</span>
                <span
                  className="text-[13px] text-text-muted shrink-0"
                  title={formatFullDate(post.created_at)}
                >
                  {formatRelativeTime(post.created_at)}
                </span>
              </>
            )}
            {canDelete && !confirmDelete && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete(true); }}
                className="ml-auto text-text-muted transition-colors hover:text-error shrink-0 p-1 -mr-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
                </svg>
              </button>
            )}
            {canDelete && confirmDelete && (
              <span className="ml-auto flex items-center gap-2 shrink-0" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                <button onClick={() => setConfirmDelete(false)} className="text-xs text-text-muted hover:text-text-primary px-1">Cancel</button>
                <button onClick={handleDelete} disabled={deleting} className="text-xs font-medium text-error hover:text-error/80 disabled:opacity-50 px-1">
                  {deleting ? "..." : "Delete"}
                </button>
              </span>
            )}
          </div>

          {/* Content + image */}
          <div className="relative mt-0.5" onClick={handleDoubleTap}>
            <p className={`text-text-primary leading-snug whitespace-pre-wrap break-words ${isDetail ? "text-[17px] mt-2" : "text-[15px]"}`}>
              {post.content}
            </p>

            {post.image_url && (
              <button
                type="button"
                className="mt-3 block w-full cursor-zoom-in rounded-2xl overflow-hidden border border-border/60 focus:outline-none"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLightboxSrc(post.image_url!); }}
              >
                <ProgressiveImage
                  src={post.image_url}
                  className="max-h-[400px] w-full object-cover"
                  skeletonClassName="w-full h-[220px]"
                />
              </button>
            )}

            {doubleTapHeart && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="text-error animate-like-pop opacity-90 drop-shadow-lg">
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                </svg>
              </div>
            )}
          </div>

          {/* Full timestamp — detail view only (Twitter style: "4:30 PM · Apr 1, 2026") */}
          {isDetail && (
            <p className="mt-3 text-[14px] text-text-muted">
              {formatFullDate(post.created_at)}
            </p>
          )}

          {/* Action bar */}
          <div className={`flex items-center gap-5 ${isDetail ? "mt-3 pt-3 border-t border-border" : "mt-2.5"}`}>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleLike(); }}
              disabled={!currentUserId}
              className={`flex items-center gap-1.5 text-[13px] transition-colors group ${
                liked ? "text-error" : "text-text-muted hover:text-error"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <span className={`flex items-center justify-center h-8 w-8 rounded-full transition-colors ${liked ? "" : "group-hover:bg-error/10"}`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={likeAnim ? "animate-like-pop" : ""}>
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                </svg>
              </span>
              <span className="tabular-nums">{likesCount}</span>
            </button>

            {!isReply && (
              onReply ? (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onReply(); }}
                  className="flex items-center gap-1.5 text-[13px] text-text-muted transition-colors group hover:text-mid-blue-light"
                >
                  <span className="flex items-center justify-center h-8 w-8 rounded-full transition-colors group-hover:bg-mid-blue-light/10">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                    </svg>
                  </span>
                  <span className="tabular-nums">{post.replies_count}</span>
                </button>
              ) : (
                <Link
                  href={`/feed/${post.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 text-[13px] text-text-muted transition-colors group hover:text-mid-blue-light"
                >
                  <span className="flex items-center justify-center h-8 w-8 rounded-full transition-colors group-hover:bg-mid-blue-light/10">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                    </svg>
                  </span>
                  <span className="tabular-nums">{post.replies_count}</span>
                </Link>
              )
            )}

            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleShare(); }}
              className="flex items-center gap-1.5 text-[13px] text-text-muted transition-colors group hover:text-amber"
            >
              <span className="flex items-center justify-center h-8 w-8 rounded-full transition-colors group-hover:bg-amber/10">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" x2="12" y1="2" y2="15" />
                </svg>
              </span>
            </button>

            <span className="ml-auto flex items-center gap-1.5 text-[13px] text-text-muted">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
              <span className="tabular-nums">{formatViewCount(viewsCount)}</span>
            </span>
          </div>
        </div>
      </div>

      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}

      {isAdmin && !isAuthor && (
        <div className="mt-2 pl-[52px]" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
          {banDone ? (
            <span className="text-[11px] text-success">Banned ({banDone.replace("_", " ")})</span>
          ) : !showBanMenu ? (
            <button
              onClick={() => setShowBanMenu(true)}
              className="text-[11px] text-text-muted transition-colors hover:text-error"
            >
              Ban user
            </button>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-text-muted">Ban for:</span>
              {BAN_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => handleBan(opt.type)}
                  disabled={banning}
                  className="rounded-md border border-error/30 px-2 py-0.5 text-[11px] text-error transition-colors hover:bg-error/10 disabled:opacity-50"
                >
                  {opt.label}
                </button>
              ))}
              <button
                onClick={() => setShowBanMenu(false)}
                className="text-[11px] text-text-muted hover:text-text-primary"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (isReply || isDetail) return content;

  return (
    <Link href={`/feed/${post.id}`} className="block">
      {content}
    </Link>
  );
});

export { PostCard };
