"use client";

import Link from "next/link";
import { memo, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { ImageLightbox } from "@/components/ImageLightbox";
import { api } from "@/lib/api";
import type { Post } from "@/lib/types";

const VIEWS_KEY = "ho_viewed_v2";
const VIEWS_TTL = 24 * 60 * 60 * 1000;

function getViewedStore(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(VIEWS_KEY) || "{}"); }
  catch { return {}; }
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

// Twitter-style: "just now", "3m", "2h", "3d", "Apr 1", "Apr 1, 2024"
function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Kolkata",
    ...(d > 365 ? { year: "numeric" } : {}),
  });
}

// Full date for detail view: "4:30 PM · Apr 1, 2026"
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

// Image with skeleton placeholder while loading
function PostImage({ src, onOpen }: { src: string; onOpen: () => void }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <button
      type="button"
      className="mt-3 block w-full rounded-2xl overflow-hidden focus:outline-none cursor-zoom-in"
      onClick={(e) => { e.stopPropagation(); onOpen(); }}
    >
      {!loaded && <div className="skeleton w-full h-[220px]" />}
      <img
        src={src}
        alt=""
        draggable={false}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`block w-full max-h-[400px] object-cover transition-opacity duration-300 ${
          loaded ? "opacity-100" : "opacity-0 h-0"
        }`}
      />
    </button>
  );
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
  showThreadLine?: boolean; // draws a vertical line below avatar connecting to next card
  seamless?: boolean;       // removes top padding — used when previous card has showThreadLine
  onDeleted?: () => void;
  onReply?: () => void;
}

const PostCard = memo(function PostCard({
  post, liked: initialLiked, currentUserId, isAdmin, isReply, isDetail,
  showThreadLine, seamless, onDeleted, onReply,
}: PostCardProps) {
  const router = useRouter();
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
  // All cards navigate unless we're already in the detail view of THIS post
  const isNavigable = !isDetail;

  async function handleLike() {
    if (liking || !currentUserId) return;
    setLiking(true);
    const prevLiked = liked;
    const prevCount = likesCount;
    setLiked(!liked);
    setLikesCount(liked ? Math.max(0, likesCount - 1) : likesCount + 1);
    if (!liked) {
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
      if (!liked && currentUserId) handleLike();
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

  return (
    <div
      ref={cardRef}
      className={`px-4 transition-colors border-b border-border ${
        seamless ? "pt-0" : "pt-3"
      } ${
        showThreadLine ? "pb-0" : "pb-3"
      } ${
        isNavigable ? "hover:bg-surface-hover/50 cursor-pointer" : ""
      }`}
      onClick={isNavigable ? () => router.push(`/feed/${post.id}`) : undefined}
    >
      <div className="flex gap-3">
        {/* Avatar column — thread line sits here */}
        <div className="flex flex-col items-center shrink-0">
          <Avatar name={personaName} size={40} className="mt-0.5" />
          {showThreadLine && (
            <div className="w-0.5 flex-1 bg-border/50 mt-1 min-h-[12px]" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Name · time */}
          <div className="flex items-center min-w-0 gap-0">
            <span className="text-[15px] font-bold text-text-primary truncate">
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
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                className="ml-auto text-text-muted transition-colors hover:text-error shrink-0 pl-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
                </svg>
              </button>
            )}
            {canDelete && confirmDelete && (
              <span className="ml-auto flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setConfirmDelete(false)} className="text-xs text-text-muted hover:text-text-primary">Cancel</button>
                <button onClick={handleDelete} disabled={deleting} className="text-xs font-medium text-error hover:text-error/80 disabled:opacity-50">
                  {deleting ? "..." : "Delete"}
                </button>
              </span>
            )}
          </div>

          {/* Content + image */}
          <div className="relative" onClick={handleDoubleTap}>
            <p className={`text-text-primary leading-snug whitespace-pre-wrap break-words ${isDetail ? "text-[17px] mt-1" : "text-[15px] mt-0.5"}`}>
              {post.content}
            </p>

            {post.image_url && (
              <PostImage src={post.image_url} onOpen={() => setLightboxSrc(post.image_url!)} />
            )}

            {doubleTapHeart && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="text-error animate-like-pop opacity-90 drop-shadow-lg">
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                </svg>
              </div>
            )}
          </div>

          {/* Full date — only on detail view */}
          {isDetail && (
            <p className="mt-3 text-[14px] text-text-muted">
              {formatFullDate(post.created_at)}
            </p>
          )}

          {/* Action bar */}
          <div className={`mt-2 flex items-center gap-6 ${isDetail ? "pt-3 border-t border-border" : ""}`}>
            {/* Like */}
            <button
              onClick={(e) => { e.stopPropagation(); handleLike(); }}
              disabled={!currentUserId}
              className={`flex items-center gap-1.5 text-[13px] transition-colors ${
                liked ? "text-error" : "text-text-muted hover:text-error"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={likeAnim ? "animate-like-pop" : ""}>
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </svg>
              <span className="tabular-nums">{likesCount}</span>
            </button>

            {/* Reply — always show, compose if onReply provided else link */}
            {onReply ? (
              <button
                onClick={(e) => { e.stopPropagation(); onReply(); }}
                className="flex items-center gap-1.5 text-[13px] text-text-muted transition-colors hover:text-mid-blue-light"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                </svg>
                <span className="tabular-nums">{post.replies_count}</span>
              </button>
            ) : (
              <Link
                href={`/feed/${post.id}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 text-[13px] text-text-muted transition-colors hover:text-mid-blue-light"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                </svg>
                <span className="tabular-nums">{post.replies_count}</span>
              </Link>
            )}

            {/* Share */}
            <button
              onClick={(e) => { e.stopPropagation(); handleShare(); }}
              className="flex items-center gap-1.5 text-[13px] text-text-muted transition-colors hover:text-amber"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" x2="12" y1="2" y2="15" />
              </svg>
            </button>

            {/* Views */}
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
        <div className="mt-2 pl-[52px]" onClick={(e) => e.stopPropagation()}>
          {banDone ? (
            <span className="text-[11px] text-success">Banned ({banDone.replace("_", " ")})</span>
          ) : !showBanMenu ? (
            <button onClick={() => setShowBanMenu(true)} className="text-[11px] text-text-muted transition-colors hover:text-error">
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
              <button onClick={() => setShowBanMenu(false)} className="text-[11px] text-text-muted hover:text-text-primary">
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export { PostCard };
