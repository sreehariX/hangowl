"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { api } from "@/lib/api";
import type { Post } from "@/lib/types";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Kolkata",
  });
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
    <div className={`rounded-2xl border border-border bg-surface p-4 transition-colors ${!isReply ? "hover:bg-surface-hover" : ""}`}>
      <div className="flex items-start gap-3">
        <Avatar name={personaName} size={36} className="shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-text-primary truncate">
              {personaName}
            </span>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 text-mid-blue-light" aria-label="Verified IITB student">
              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0 1 12 2.944a11.955 11.955 0 0 1-8.618 3.04A12.02 12.02 0 0 0 3 12c0 3.072 1.157 5.876 3.058 7.998C7.56 21.82 9.649 23 12 23s4.44-1.18 5.942-3.002A11.956 11.956 0 0 0 21 12c0-2.09-.535-4.058-1.382-5.616z" />
            </svg>
            <span className="text-xs text-text-muted shrink-0">
              {timeAgo(post.created_at)}
            </span>
          </div>
          <p className="mt-1 text-sm text-text-primary whitespace-pre-wrap break-words">
            {post.content}
          </p>
          {post.image_url && (
            <img
              src={post.image_url}
              alt=""
              className="mt-3 max-h-80 w-full rounded-xl border border-border object-cover"
              loading="lazy"
            />
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-5 pl-12">
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleLike(); }}
          disabled={!currentUserId}
          className={`flex items-center gap-1.5 text-xs transition-colors ${
            liked ? "text-error" : "text-text-muted hover:text-error"
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={likeAnim ? "animate-like-pop" : ""}>
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
          </svg>
          <span className="tabular-nums">{likesCount}</span>
        </button>

        {!isReply && (
          <Link
            href={`/feed/${post.id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 text-xs text-text-muted transition-colors hover:text-mid-blue-light"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
            </svg>
            <span className="tabular-nums">{post.replies_count}</span>
          </Link>
        )}

        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleShare(); }}
          className="flex items-center gap-1.5 text-xs text-text-muted transition-colors hover:text-amber"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" x2="12" y1="2" y2="15" />
          </svg>
        </button>

        {canDelete && !confirmDelete && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete(true); }}
            className="ml-auto text-xs text-text-muted transition-colors hover:text-error"
          >
            Delete
          </button>
        )}
        {canDelete && confirmDelete && (
          <span className="ml-auto flex items-center gap-2" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-text-muted hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs font-medium text-error hover:text-error/80 disabled:opacity-50"
            >
              {deleting ? "..." : "Confirm"}
            </button>
          </span>
        )}
      </div>

      {isAdmin && !isAuthor && (
        <div className="mt-2 pl-12" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
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
