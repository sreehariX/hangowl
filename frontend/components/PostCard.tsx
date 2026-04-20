"use client";

import Link from "next/link";
import { memo, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { ImageLightbox } from "@/components/ImageLightbox";
import {
  HeartIcon,
  ReplyIcon,
  ShareIcon,
  BarChartIcon,
  DotsIcon,
} from "@/components/icons";
import { api } from "@/lib/api";
import { postCache } from "@/lib/post-cache";
import type { Post } from "@/lib/types";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const VIEWS_KEY = "ho_viewed_v2";
const VIEWS_TTL = 24 * 60 * 60 * 1000;
const THREAD_COLOR = "rgba(91, 131, 212, 0.24)";

function getViewedStore(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(VIEWS_KEY) || "{}");
  } catch {
    return {};
  }
}
function hasViewed(id: string) {
  const s = getViewedStore();
  return !!s[id] && Date.now() < s[id];
}
function addViewed(id: string) {
  try {
    const s = getViewedStore();
    if (s[id] && Date.now() < s[id]) return;
    s[id] = Date.now() + VIEWS_TTL;
    const pruned = Object.entries(s)
      .filter(([, e]) => Date.now() < e)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 500);
    localStorage.setItem(VIEWS_KEY, JSON.stringify(Object.fromEntries(pruned)));
  } catch {}
}

function formatViewCount(n: number) {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

function formatRelativeTime(iso: string) {
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

function formatFullDate(iso: string) {
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

/* -------------------------------------------------------------------------- */
/* Image                                                                       */
/* -------------------------------------------------------------------------- */

function PostImage({ src, onOpen }: { src: string; onOpen: () => void }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <button
      type="button"
      className="group relative mt-3 block aspect-[2/1] w-full overflow-hidden rounded-2xl border border-border/60 bg-ink-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      aria-label="Open image"
    >
      {!loaded && <div className="skeleton absolute inset-0 rounded-2xl" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        draggable={false}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`h-full w-full object-cover transition-all duration-500 ease-out ${
          loaded ? "scale-100 opacity-100" : "scale-[1.02] opacity-0"
        } group-hover:scale-[1.015]`}
      />
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Main                                                                        */
/* -------------------------------------------------------------------------- */

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
  isDetail?: boolean;
  showThreadLine?: boolean;
  seamless?: boolean;
  onDeleted?: () => void;
  onReply?: () => void;
}

const PostCard = memo(function PostCard({
  post,
  liked: initialLiked,
  currentUserId,
  isAdmin,
  isDetail,
  showThreadLine,
  seamless,
  onDeleted,
  onReply,
}: PostCardProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
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
    if (initialLiked !== undefined) setLiked(initialLiked);
  }, [initialLiked]);

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
        } else if (timer) {
          clearTimeout(timer);
        }
      },
      { threshold: 0.5 },
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
  const isNavigable = !isDetail;

  async function handleLike() {
    if (liking || !currentUserId) return;
    setLiking(true);
    const prev = { liked, count: likesCount };
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
      setLiked(prev.liked);
      setLikesCount(prev.count);
    } finally {
      setLiking(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      if (isAdmin && !isAuthor) await api.adminDeletePost(post.id);
      else await api.deletePost(post.id);
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
    if (navigator.share)
      navigator.share({ text: post.content.slice(0, 100), url }).catch(() => {});
    else navigator.clipboard.writeText(url).catch(() => {});
  }

  const pt = "pt-4";
  const pbBorder = showThreadLine ? "pb-0" : "border-b border-border/60 pb-4";

  return (
    <div
      ref={cardRef}
      className={`relative px-4 transition-colors duration-200 ${pt} ${pbBorder} ${
        isNavigable ? "cursor-pointer select-none hover:bg-surface-hover/40" : ""
      }`}
      onClick={
        isNavigable
          ? () => {
              postCache.set(post.id, post);
              startTransition(() => router.push(`/feed/${post.id}`));
            }
          : undefined
      }
    >
      <div className="flex gap-3">
        {/* Avatar column with thread line */}
        <div className="relative flex shrink-0 flex-col items-center">
          {seamless && (
            <div
              className="absolute left-1/2 w-[2px] -translate-x-1/2"
              style={{ background: THREAD_COLOR, top: -16, height: 36 }}
            />
          )}
          <Avatar
            name={personaName}
            size={40}
            className={`relative z-[1] ${seamless ? "mt-0" : "mt-0.5"}`}
          />
          {showThreadLine && (
            <div
              className="absolute left-1/2 w-[2px] -translate-x-1/2"
              style={{ background: THREAD_COLOR, top: seamless ? 40 : 42, bottom: -1 }}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {/* Name · time */}
          <div className="flex min-w-0 items-center">
            <span className="truncate text-[15px] font-semibold tracking-tight text-text-primary">
              {personaName}
            </span>
            {!isDetail && (
              <>
                <span className="mx-1.5 shrink-0 text-caption text-text-muted">·</span>
                <span
                  className="shrink-0 text-caption text-text-tertiary"
                  title={formatFullDate(post.created_at)}
                >
                  {formatRelativeTime(post.created_at)}
                </span>
              </>
            )}
            {canDelete && !confirmDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(true);
                }}
                className="icon-btn ml-auto shrink-0 h-7 w-7 hover:text-danger"
                aria-label="Post menu"
              >
                <DotsIcon size={16} />
              </button>
            )}
            {canDelete && confirmDelete && (
              <span
                className="ml-auto flex shrink-0 items-center gap-3"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-caption font-medium text-text-tertiary hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-caption font-semibold text-danger hover:text-danger/80 disabled:opacity-50"
                >
                  {deleting ? "…" : "Delete"}
                </button>
              </span>
            )}
          </div>

          {/* Content + image */}
          <div className="relative" onClick={handleDoubleTap}>
            <p
              className={`whitespace-pre-wrap break-words leading-relaxed text-text-primary ${
                isDetail ? "mt-2 text-[17px]" : "mt-0.5 text-[15px]"
              }`}
            >
              {post.content}
            </p>
            {post.image_url && (
              <PostImage src={post.image_url} onOpen={() => setLightboxSrc(post.image_url!)} />
            )}
            {doubleTapHeart && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <HeartIcon
                  filled
                  size={64}
                  className="animate-like-pop text-danger opacity-90 drop-shadow-lg"
                />
              </div>
            )}
          </div>

          {isDetail && (
            <p className="mt-3 text-body text-text-tertiary">{formatFullDate(post.created_at)}</p>
          )}

          {/* Action bar */}
          <div
            className={`mt-3 flex items-center gap-5 text-caption ${
              isDetail ? "border-t border-border/60 pt-3" : ""
            }`}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleLike();
              }}
              disabled={!currentUserId}
              className={`group flex items-center gap-1.5 rounded-full px-1 py-1 transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
                liked
                  ? "text-danger"
                  : "text-text-tertiary hover:text-danger"
              }`}
              aria-label="Like"
              aria-pressed={liked}
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                  liked ? "bg-danger/10" : "group-hover:bg-danger/10"
                }`}
              >
                <HeartIcon size={17} filled={liked} className={likeAnim ? "animate-like-pop" : ""} />
              </span>
              <span className="tabular-nums">{likesCount}</span>
            </button>

            {onReply ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReply();
                }}
                className="group flex items-center gap-1.5 rounded-full px-1 py-1 text-text-tertiary transition-colors duration-200 hover:text-brand-400"
                aria-label="Reply"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full group-hover:bg-brand-500/10">
                  <ReplyIcon size={17} />
                </span>
                <span className="tabular-nums">{post.replies_count}</span>
              </button>
            ) : (
              <Link
                href={`/feed/${post.id}`}
                onClick={(e) => e.stopPropagation()}
                className="group flex items-center gap-1.5 rounded-full px-1 py-1 text-text-tertiary transition-colors duration-200 hover:text-brand-400"
                aria-label="Reply"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full group-hover:bg-brand-500/10">
                  <ReplyIcon size={17} />
                </span>
                <span className="tabular-nums">{post.replies_count}</span>
              </Link>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleShare();
              }}
              className="group flex items-center gap-1.5 rounded-full px-1 py-1 text-text-tertiary transition-colors duration-200 hover:text-amber"
              aria-label="Share"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full group-hover:bg-amber/10">
                <ShareIcon size={17} />
              </span>
            </button>

            <span className="ml-auto flex items-center gap-1.5 text-text-tertiary">
              <BarChartIcon size={15} />
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
            <span className="text-caption text-success">
              Banned ({banDone.replace("_", " ")})
            </span>
          ) : !showBanMenu ? (
            <button
              onClick={() => setShowBanMenu(true)}
              className="text-caption text-text-tertiary transition-colors hover:text-danger"
            >
              Ban user
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-caption text-text-tertiary">Ban for:</span>
              {BAN_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => handleBan(opt.type)}
                  disabled={banning}
                  className="rounded-md border border-danger/30 px-2 py-0.5 text-caption text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
                >
                  {opt.label}
                </button>
              ))}
              <button
                onClick={() => setShowBanMenu(false)}
                className="text-caption text-text-tertiary hover:text-text-primary"
              >
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
