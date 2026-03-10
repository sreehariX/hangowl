"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { api } from "@/lib/api";
import type { Post } from "@/lib/types";

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
  return `${time} . ${date}`;
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
  onDeleted?: () => void;
}

export function PostCard({ post, liked: initialLiked, currentUserId, isAdmin, isReply, onDeleted }: PostCardProps) {
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [liked, setLiked] = useState(initialLiked ?? false);
  const [liking, setLiking] = useState(false);
  const [likeAnim, setLikeAnim] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showBanMenu, setShowBanMenu] = useState(false);
  const [banning, setBanning] = useState(false);
  const [banDone, setBanDone] = useState<string | null>(null);

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

  function handleShare() {
    const url = `${window.location.origin}/feed/${post.id}`;
    if (navigator.share) {
      navigator.share({ text: post.content.slice(0, 100), url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  }

  const content = (
    <div className={`border-b border-border px-4 py-3 transition-colors ${!isReply ? "hover:bg-surface-hover/50" : ""}`}>
      <div className="flex gap-3">
        <Avatar name={personaName} size={40} className="shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-[15px] font-bold text-text-primary truncate">
              {personaName}
            </span>
            {canDelete && !confirmDelete && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete(true); }}
                className="ml-auto text-text-muted transition-colors hover:text-error shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
              </button>
            )}
            {canDelete && confirmDelete && (
              <span className="ml-auto flex items-center gap-2 shrink-0" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                <button onClick={() => setConfirmDelete(false)} className="text-xs text-text-muted hover:text-text-primary">Cancel</button>
                <button onClick={handleDelete} disabled={deleting} className="text-xs font-medium text-error hover:text-error/80 disabled:opacity-50">
                  {deleting ? "..." : "Delete"}
                </button>
              </span>
            )}
          </div>

          <p className="text-[15px] text-text-primary leading-snug whitespace-pre-wrap break-words mt-0.5">
            {post.content}
          </p>

          {post.image_url && (
            <img
              src={post.image_url}
              alt=""
              className="mt-3 max-h-[350px] w-full rounded-2xl border border-border object-cover"
              loading="lazy"
            />
          )}

          <p className="mt-2 text-xs text-text-muted">
            {formatFullDate(post.created_at)}
          </p>

          <div className="mt-2 flex items-center gap-6 pt-2 border-t border-border/50">
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleLike(); }}
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

            {!isReply && (
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

            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleShare(); }}
              className="flex items-center gap-1.5 text-[13px] text-text-muted transition-colors hover:text-amber"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" x2="12" y1="2" y2="15" />
              </svg>
            </button>
          </div>
        </div>
      </div>

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

  if (isReply) return content;

  return (
    <Link href={`/feed/${post.id}`} className="block">
      {content}
    </Link>
  );
}
