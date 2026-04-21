"use client";

import { ProgressiveImage } from "@/components/ProgressiveImage";
import { CloseIcon } from "@/components/icons";

interface ImagePreviewProps {
  src: string;
  onRemove: () => void;
}

export function ImagePreview({ src, onRemove }: ImagePreviewProps) {
  return (
    <div className="relative inline-block">
      <ProgressiveImage
        src={src}
        alt="Attachment preview"
        className="max-h-56 rounded-xl border border-border object-cover"
        skeletonClassName="h-36 w-56 rounded-xl"
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove image"
        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/80 text-white transition-opacity hover:opacity-90"
      >
        <CloseIcon size={14} />
      </button>
    </div>
  );
}
