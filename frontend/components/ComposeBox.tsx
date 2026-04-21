"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { compressImage } from "@/lib/compress-image";
import { ImageIcon, CloseIcon } from "@/components/icons";
import { Spinner } from "@/components/primitives";
import type { Post } from "@/lib/types";

interface ComposeBoxProps {
  parentId?: string;
  placeholder?: string;
  onPosted?: (post: Post) => void;
  onPostStart?: () => void;
  onOptimisticPost?: (content: string, imageUrls: string[]) => void;
  onPostFailed?: () => void;
  autoFocus?: boolean;
}

const MAX_CHARS = 500;
const MAX_INPUT_MB = 20;
const MAX_IMAGES = 4;

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
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (autoFocus) textareaRef.current?.focus(); }, [autoFocus]);

  const trimmed = content.trim();
  const charCount = trimmed.length;
  const overLimit = charCount > MAX_CHARS;
  const canPost = charCount > 0 && !overLimit && !posting && !uploading;
  const showCounter = charCount > 280 || overLimit;
  const remainingSlots = MAX_IMAGES - imageUrls.length;

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (fileRef.current) fileRef.current.value = "";
    if (picked.length === 0) return;

    if (remainingSlots <= 0) {
      setError(`You can attach up to ${MAX_IMAGES} photos.`);
      return;
    }
    const files = picked.slice(0, remainingSlots);
    if (picked.length > remainingSlots) {
      setError(`Only ${remainingSlots} more photo${remainingSlots === 1 ? "" : "s"} can be attached.`);
    } else {
      setError(null);
    }

    for (const f of files) {
      if (!f.type.startsWith("image/")) {
        setError("Only image files are allowed");
        return;
      }
      if (f.size > MAX_INPUT_MB * 1024 * 1024) {
        setError(`Each image must be under ${MAX_INPUT_MB}MB`);
        return;
      }
    }

    setUploading(true);
    setUploadProgress({ done: 0, total: files.length });
    try {
      const uploaded: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const compressed = await compressImage(files[i], {
          maxWidth: 1920, maxHeight: 1920, quality: 0.85, maxSizeMB: 2,
        });
        const { url } = await api.uploadImage(compressed);
        uploaded.push(url);
        setUploadProgress({ done: i + 1, total: files.length });
      }
      setImageUrls((prev) => [...prev, ...uploaded].slice(0, MAX_IMAGES));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  function removeImage(idx: number) {
    setImageUrls((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handlePost() {
    if (!canPost) return;
    setPosting(true);
    setError(null);
    onPostStart?.();
    onOptimisticPost?.(trimmed, imageUrls);
    try {
      const { post } = await api.createPost({
        content: trimmed,
        image_urls: imageUrls,
        image_url: imageUrls[0] ?? null,
        parent_id: parentId || null,
      });
      setContent("");
      setImageUrls([]);
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
    <div className="rounded-2xl border border-border p-4">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder || "What's happening?"}
        rows={3}
        maxLength={MAX_CHARS + 100}
        className="w-full resize-none bg-transparent text-[16px] leading-relaxed text-text-primary placeholder:text-text-muted outline-none"
      />

      {imageUrls.length > 0 && (
        <div
          className="mt-2 grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${Math.min(imageUrls.length, 2)}, minmax(0, 1fr))`,
          }}
        >
          {imageUrls.map((src, idx) => (
            <div
              key={src + idx}
              className="relative overflow-hidden rounded-xl border border-border"
              style={{ aspectRatio: imageUrls.length === 1 ? "16 / 9" : "1 / 1" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
                loading="lazy"
                decoding="async"
              />
              <button
                type="button"
                onClick={() => removeImage(idx)}
                aria-label="Remove image"
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/75 text-white transition-opacity hover:opacity-90"
              >
                <CloseIcon size={14} />
              </button>
            </div>
          ))}
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
            multiple
            onChange={handleImagePick}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || remainingSlots <= 0}
            className="icon-btn hover:text-amber disabled:opacity-40"
            title={
              remainingSlots <= 0
                ? `Maximum of ${MAX_IMAGES} photos`
                : `Attach image${remainingSlots > 1 ? "s" : ""} (${remainingSlots} left)`
            }
            aria-label="Attach image"
          >
            <ImageIcon size={20} />
          </button>
          {uploading && uploadProgress && (
            <span className="flex items-center gap-1.5 text-caption text-text-tertiary">
              <Spinner size={12} />
              Uploading {uploadProgress.done}/{uploadProgress.total}…
            </span>
          )}
          {!uploading && imageUrls.length > 0 && (
            <span className="text-caption text-text-tertiary">
              {imageUrls.length}/{MAX_IMAGES}
            </span>
          )}
          {showCounter && (
            <span
              className={`text-caption tabular-nums ${overLimit ? "text-danger" : "text-text-tertiary"}`}
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
          {posting ? <Spinner size={14} tone="ink" /> : cta}
        </button>
      </div>
    </div>
  );
}
