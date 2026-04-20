"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { compressImage } from "@/lib/compress-image";
import { ImagePreview } from "@/components/ImagePreview";
import { ImageIcon } from "@/components/icons";
import { Spinner } from "@/components/primitives";
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
const MAX_INPUT_MB = 20;

export function ComposeBox({
  parentId,
  placeholder,
  onPosted,
  onPostStart,
  onOptimisticPost,
  onPostFailed,
  autoFocus,
}: ComposeBoxProps) {
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState("Uploading…");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  const trimmed = content.trim();
  const charCount = trimmed.length;
  const overLimit = charCount > MAX_CHARS;
  const canPost = charCount > 0 && !overLimit && !posting && !uploading;
  const showCounter = charCount > 280 || overLimit;

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
      setUploadLabel("Optimizing…");
      const compressed = await compressImage(file, {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.85,
        maxSizeMB: 2,
      });

      setUploadLabel("Uploading…");
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

  const cta = parentId ? "Reply" : "Post";

  return (
    <div className="surface-panel p-4">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder || "What's on your mind?"}
        rows={3}
        maxLength={MAX_CHARS + 100}
        className="w-full resize-none bg-transparent text-body-lg leading-relaxed text-text-primary placeholder:text-text-muted outline-none"
      />

      {imageUrl && (
        <div className="mt-2">
          <ImagePreview src={imageUrl} onRemove={() => setImageUrl(null)} />
        </div>
      )}

      {error && (
        <p className="mt-2 rounded-lg bg-danger/10 px-3 py-1.5 text-caption text-danger">
          {error}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
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
            className="icon-btn hover:text-amber disabled:opacity-40"
            title="Attach image"
            aria-label="Attach image"
          >
            <ImageIcon size={20} />
          </button>
          {uploading && (
            <span className="flex items-center gap-1.5 text-caption text-text-tertiary">
              <Spinner size={12} />
              {uploadLabel}
            </span>
          )}
          {showCounter && (
            <span
              className={`text-caption tabular-nums ${
                overLimit ? "text-danger" : "text-text-tertiary"
              }`}
            >
              {MAX_CHARS - charCount}
            </span>
          )}
        </div>

        <button
          onClick={handlePost}
          disabled={!canPost}
          className="btn-primary btn-sm px-5"
        >
          {posting ? <Spinner size={14} tone="white" /> : cta}
        </button>
      </div>
    </div>
  );
}
