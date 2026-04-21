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

const VIEWS_KEY = "ho_viewed_v2";
const VIEWS_TTL = 24 * 60 * 60 * 1000;
const THREAD_COLOR = "#2F2F33";

function getViewedStore(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(VIEWS_KEY) || "{}"); }
  catch { return {}; }
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
    month: "short", day: "numeric", timeZone: "Asia/Kolkata",
    ...(d > 365 ? { year: "numeric" } : {}),
  });
}

function formatFullDate(iso: string) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  });
  const date = d.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Kolkata",
  });
  return `${time} · ${date}`;
}

function PostImage({
  src,
  onOpen,
}: {
  src: string;
  onOpen: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <button
      type="button"
      className="relative block h-full w-full overflow-hidden bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-amber"
      onClick={(e) => { e.stopPropagation(); onOpen(); }}
      aria-label="Open image"
    >
      {!loaded && <div className="skeleton absolute inset-0" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        draggable={false}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`h-full w-full object-cover transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </button>
  );
}

/*
 * Grid layout for 1 to 4 images, same visual grammar as Twitter / X.
 *  1 → single 2:1 hero
 *  2 → side-by-side split
 *  3 → left tall + two stacked right
 *  4 → 2×2 square grid
 *
 * IMPORTANT: we always declare `gridTemplateRows` explicitly. Leaving it
 * implicit + `auto` means children with `h-full` resolve against a 0-height
 * row in some WebKit / older Chromium builds — which is what caused "I
 * uploaded 4 photos but only see 1" in production.
 */
function PostImages({
  urls,
  onOpen,
}: {
  urls: string[];
  onOpen: (index: number) => void;
}) {
  const n = urls.length;
  if (n === 0) return null;

  if (n === 1) {
    return (
      <div className="mt-3 overflow-hidden rounded-2xl border border-border" style={{ aspectRatio: "2 / 1" }}>
        <PostImage src={urls[0]} onOpen={() => onOpen(0)} />
      </div>
    );
  }

  const wrap = "mt-3 grid gap-[2px] overflow-hidden rounded-2xl border border-border bg-border";

  if (n === 2) {
    return (
      <div
        className={wrap}
        style={{
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr",
          aspectRatio: "2 / 1",
        }}
      >
        {urls.map((u, i) => (
          <PostImage key={i} src={u} onOpen={() => onOpen(i)} />
        ))}
      </div>
    );
  }

  if (n === 3) {
    return (
      <div
        className={wrap}
        style={{
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          aspectRatio: "2 / 1",
        }}
      >
        <div className="row-span-2 h-full">
          <PostImage src={urls[0]} onOpen={() => onOpen(0)} />
        </div>
        <PostImage src={urls[1]} onOpen={() => onOpen(1)} />
        <PostImage src={urls[2]} onOpen={() => onOpen(2)} />
      </div>
    );
  }

  return (
    <div
      className={wrap}
      style={{
        gridTemplateColumns: "1fr 1fr",
        gridTemplateRows: "1fr 1fr",
        aspectRatio: "1 / 1",
      }}
    >
      {urls.slice(0, 4).map((u, i) => (
        <PostImage key={i} src={u} onOpen={() => onOpen(i)} />
      ))}
    </div>
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
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
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

  // Normalize image sources: support both legacy `image_url` and the new
  // `image_urls` array. Cap at 4 for layout safety.
  const imageUrls: string[] = (() => {
    const many = Array.isArray(post.image_urls) ? post.image_urls.filter(Boolean) : [];
    if (many.length > 0) return many.slice(0, 4);
    return post.image_url ? [post.image_url] : [];
  })();

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
    } catch {}
    finally { setBanning(false); }
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

  const pbBorder = showThreadLine ? "pb-0" : "border-b border-border pb-3";

  return (
    <div
      ref={cardRef}
      className={`relative px-4 pt-3 transition-colors ${pbBorder} ${
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
        <div className="relative flex shrink-0 flex-col items-center">
          {seamless && (
            <div
              className="absolute left-1/2 w-px -translate-x-1/2"
              style={{ background: THREAD_COLOR, top: -12, height: 28 }}
            />
          )}
          <Avatar
            name={personaName}
            size={40}
            className="relative z-[1]"
          />
          {showThreadLine && (
            <div
              className="absolute left-1/2 w-px -translate-x-1/2"
              style={{ background: THREAD_COLOR, top: 44, bottom: -1 }}
            />
          )}
        </div>

        <div className="relative min-w-0 flex-1">
          <div className="flex min-w-0 items-baseline gap-1 pr-8 leading-tight">
            <span className="truncate text-[15px] font-semibold text-text-primary">
              {personaName}
            </span>
            {!isDetail && (
              <span
                className="shrink-0 text-caption text-text-tertiary"
                title={formatFullDate(post.created_at)}
              >
                <span className="mr-1 text-text-muted">·</span>
                {formatRelativeTime(post.created_at)}
              </span>
            )}
          </div>

          {canDelete && !confirmDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
              className="absolute -top-1 right-0 flex h-7 w-7 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-surface-hover hover:text-danger"
              aria-label="Post menu"
            >
              <DotsIcon size={15} />
            </button>
          )}
          {canDelete && confirmDelete && (
            <span
              className="absolute right-0 top-0 flex shrink-0 items-center gap-3"
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

          <div className="relative mt-0.5" onClick={handleDoubleTap}>
            <p
              className={`post-content whitespace-pre-wrap break-words leading-[1.4] text-text-primary ${
                isDetail ? "mt-1 text-[17px]" : "text-[15px]"
              }`}
            >
              {post.content}
            </p>
            {imageUrls.length > 0 && (
              <PostImages urls={imageUrls} onOpen={(i) => setLightboxIndex(i)} />
            )}
            {doubleTapHeart && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <HeartIcon
                  filled
                  size={64}
                  className="animate-like-pop text-danger opacity-90"
                />
              </div>
            )}
          </div>

          {isDetail && (
            <p className="mt-2 text-caption text-text-tertiary">{formatFullDate(post.created_at)}</p>
          )}

          <div
            className={`mt-2 flex items-center gap-5 text-caption ${
              isDetail ? "border-t border-border pt-2.5" : ""
            }`}
          >
            <button
              onClick={(e) => { e.stopPropagation(); handleLike(); }}
              disabled={!currentUserId}
              className={`group flex items-center gap-1 rounded-full py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                liked ? "text-danger" : "text-text-tertiary hover:text-danger"
              }`}
              aria-label="Like"
              aria-pressed={liked}
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                  liked ? "bg-danger/10" : "group-hover:bg-danger/10"
                }`}
              >
                <HeartIcon size={16} filled={liked} className={likeAnim ? "animate-like-pop" : ""} />
              </span>
              <span className="tabular-nums">{likesCount}</span>
            </button>

            {onReply ? (
              <button
                onClick={(e) => { e.stopPropagation(); onReply(); }}
                className="group flex items-center gap-1 rounded-full py-1 text-text-tertiary transition-colors hover:text-brand-400"
                aria-label="Reply"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full transition-colors group-hover:bg-brand-500/10">
                  <ReplyIcon size={16} />
                </span>
                <span className="tabular-nums">{post.replies_count}</span>
              </button>
            ) : (
              <Link
                href={`/feed/${post.id}`}
                onClick={(e) => e.stopPropagation()}
                className="group flex items-center gap-1 rounded-full py-1 text-text-tertiary transition-colors hover:text-brand-400"
                aria-label="Reply"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full transition-colors group-hover:bg-brand-500/10">
                  <ReplyIcon size={16} />
                </span>
                <span className="tabular-nums">{post.replies_count}</span>
              </Link>
            )}

            <button
              onClick={(e) => { e.stopPropagation(); handleShare(); }}
              className="group flex items-center rounded-full py-1 text-text-tertiary transition-colors hover:text-amber"
              aria-label="Share"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full transition-colors group-hover:bg-amber/10">
                <ShareIcon size={16} />
              </span>
            </button>

            <span className="ml-auto flex items-center gap-1 text-text-tertiary">
              <BarChartIcon size={14} />
              <span className="tabular-nums">{formatViewCount(viewsCount)}</span>
            </span>
          </div>
        </div>
      </div>

      {lightboxIndex !== null && imageUrls[lightboxIndex] && (
        <ImageLightbox
          src={imageUrls[lightboxIndex]}
          onClose={() => setLightboxIndex(null)}
        />
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
