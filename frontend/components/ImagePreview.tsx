"use client";

import { ProgressiveImage } from "@/components/ProgressiveImage";

interface ImagePreviewProps {
  src: string;
  onRemove: () => void;
}

export function ImagePreview({ src, onRemove }: ImagePreviewProps) {
  return (
    <div className="relative mt-2 inline-block">
      <ProgressiveImage
        src={src}
        alt="Attachment preview"
        className="max-h-48 rounded-xl border border-border object-cover"
        skeletonClassName="h-32 w-48 rounded-xl"
      />
      <button
        type="button"
        onClick={onRemove}
        className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-error text-white text-xs font-bold shadow-md transition-transform hover:scale-110"
      >
        &times;
      </button>
    </div>
  );
}
