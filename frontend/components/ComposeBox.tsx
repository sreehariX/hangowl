"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { compressImage } from "@/lib/compress-image";
import { ImagePreview } from "@/components/ImagePreview";
import type { Post } from "@/lib/types";

interface ComposeBoxProps {
  parentId?: string;
  placeholder?: string;
  onPosted?: (post: Post) => void;
  onPostStart?: () => void;
  onOptimisticPost?: (content: string, imageUrl: string | null) => void;
  onPostFailed?: () => void;
  autoFocus?: boolean;
}

const MAX_CHARS = 500;
const MAX_INPUT_MB = 20; // Accept up to 20MB — compressed before upload

export function ComposeBox({ parentId, placeholder, onPosted, onPostStart, onOptimisticPost, onPostFailed, autoFocus }: ComposeBoxProps) {
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState("Uploading...");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  const trimmed = content.trim();
  const canPost = trimmed.length > 0 && trimmed.length <= MAX_CHARS && !posting && !uploading;

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed");
      return;
    }

    if (file.size > MAX_INPUT_MB * 1024 * 1024) {
      setError(`Image must be under ${MAX_INPUT_MB}MB`);
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Compress before upload — same as Instagram/Twitter
      setUploadLabel("Optimizing...");
      const compressed = await compressImage(file, { maxWidth: 1920, maxHeight: 1920, quality: 0.85, maxSizeMB: 2 });

      setUploadLabel("Uploading...");
      const result = await api.uploadImage(compressed);
      setImageUrl(result.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handlePost() {
    if (!canPost) return;
    setPosting(true);
    setError(null);
    onPostStart?.();
    onOptimisticPost?.(trimmed, imageUrl);
    try {
      const { post } = await api.createPost({
        content: trimmed,
        image_url: imageUrl,
        parent_id: parentId || null,
      });
      setContent("");
      setImageUrl(null);
      onPosted?.(post);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post");
      onPostFailed?.();
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder || "What's on your mind?"}
        rows={3}
        maxLength={MAX_CHARS}
        className="w-full resize-none bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
      />

      {imageUrl && (
        <ImagePreview src={imageUrl} onRemove={() => setImageUrl(null)} />
      )}

      {error && (
        <p className="mt-2 text-xs text-error">{error}</p>
      )}

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleImagePick}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="text-text-muted transition-colors hover:text-amber disabled:opacity-40"
            title="Attach image (up to 20MB, auto-compressed)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
          </button>
          {uploading && (
            <span className="text-xs text-text-muted animate-pulse">{uploadLabel}</span>
          )}
          <span className={`text-xs tabular-nums ${trimmed.length > MAX_CHARS ? "text-error" : "text-text-muted"}`}>
            {trimmed.length}/{MAX_CHARS}
          </span>
        </div>

        <button
          onClick={handlePost}
          disabled={!canPost}
          className="rounded-lg bg-amber px-4 py-1.5 text-sm font-semibold text-navy transition-all hover:bg-amber-dark active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {posting ? "Posting..." : parentId ? "Reply" : "Post"}
        </button>
      </div>
    </div>
  );
}
