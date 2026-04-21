"use client";

import { useState, useCallback } from "react";

interface ProgressiveImageProps {
  src: string;
  alt?: string;
  className?: string;
  skeletonClassName?: string;
}

function ImageInner({ src, alt = "", className = "", skeletonClassName }: ProgressiveImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const imgCallback = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth > 0) {
      setLoaded(true);
    }
  }, []);

  if (error) return null;

  return (
    <div className={`relative overflow-hidden ${skeletonClassName || className}`}>
      {!loaded && <div className="skeleton absolute inset-0" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgCallback}
        src={src}
        alt={alt}
        className={`${className} transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

export function ProgressiveImage(props: ProgressiveImageProps) {
  return <ImageInner key={props.src} {...props} />;
}
