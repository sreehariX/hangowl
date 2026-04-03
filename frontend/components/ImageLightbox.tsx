"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ImageLightboxProps {
  src: string;
  onClose: () => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.5;
const DOUBLE_TAP_ZOOM = 2.5;

export function ImageLightbox({ src, onClose }: ImageLightboxProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const lastTapRef = useRef(0);
  const lastPinchDistRef = useRef<number | null>(null);

  const clampPan = useCallback((newPan: { x: number; y: number }, z: number) => {
    const el = containerRef.current;
    if (!el || z <= 1) return { x: 0, y: 0 };
    const maxX = (el.clientWidth * (z - 1)) / 2;
    const maxY = (el.clientHeight * (z - 1)) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, newPan.x)),
      y: Math.max(-maxY, Math.min(maxY, newPan.y)),
    };
  }, []);

  const applyZoom = useCallback((newZ: number) => {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZ));
    setZoom(clamped);
    if (clamped <= 1) setPan({ x: 0, y: 0 });
    return clamped;
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "+" || e.key === "=") {
        setZoom((z) => {
          const n = Math.min(MAX_ZOOM, z + ZOOM_STEP);
          return n;
        });
      } else if (e.key === "-") {
        setZoom((z) => {
          const n = Math.max(MIN_ZOOM, z - ZOOM_STEP);
          if (n <= 1) setPan({ x: 0, y: 0 });
          return n;
        });
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // Prevent native touch scroll/zoom inside container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const prevent = (e: TouchEvent) => { if (e.touches.length >= 1) e.preventDefault(); };
    el.addEventListener("touchmove", prevent, { passive: false });
    return () => el.removeEventListener("touchmove", prevent);
  }, []);

  // ─── Mouse wheel zoom ───────────────────────────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.3 : 0.3;
    setZoom((z) => {
      const n = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta));
      if (n <= 1) setPan({ x: 0, y: 0 });
      return n;
    });
  }, []);

  // ─── Mouse drag ─────────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [zoom, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan((p) => clampPan({ x: dragStartRef.current.panX + dx, y: dragStartRef.current.panY + dy }, zoom));
  }, [isDragging, zoom, clampPan]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  // ─── Double click to toggle zoom ────────────────────────────────────────────
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setZoom((z) => {
      const newZ = z > 1 ? 1 : DOUBLE_TAP_ZOOM;
      if (newZ <= 1) setPan({ x: 0, y: 0 });
      return newZ;
    });
  }, []);

  // ─── Touch: pinch-to-zoom + drag + double-tap ────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDistRef.current = Math.sqrt(dx * dx + dy * dy);
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        e.preventDefault();
        setZoom((z) => {
          const newZ = z > 1 ? 1 : DOUBLE_TAP_ZOOM;
          if (newZ <= 1) setPan({ x: 0, y: 0 });
          return newZ;
        });
      }
      lastTapRef.current = now;
      dragStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        panX: pan.x,
        panY: pan.y,
      };
      setIsDragging(true);
    }
  }, [pan]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (lastPinchDistRef.current !== null) {
        const ratio = dist / lastPinchDistRef.current;
        setZoom((z) => {
          const n = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * ratio));
          if (n <= 1) setPan({ x: 0, y: 0 });
          return n;
        });
      }
      lastPinchDistRef.current = dist;
    } else if (e.touches.length === 1 && isDragging) {
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      const dy = e.touches[0].clientY - dragStartRef.current.y;
      setPan(clampPan(
        { x: dragStartRef.current.panX + dx, y: dragStartRef.current.panY + dy },
        zoom
      ));
    }
  }, [isDragging, zoom, clampPan]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) lastPinchDistRef.current = null;
    if (e.touches.length === 0) setIsDragging(false);
  }, []);

  const zoomPct = Math.round(zoom * 100);
  const isZoomed = zoom > 1;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/92 animate-fade-in">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => applyZoom(zoom - ZOOM_STEP)}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Zoom out"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white text-xl leading-none transition-colors hover:bg-white/20 disabled:opacity-30"
          >
            −
          </button>
          <span className="w-12 text-center text-xs font-medium text-white/60 tabular-nums">
            {zoomPct}%
          </span>
          <button
            onClick={() => applyZoom(zoom + ZOOM_STEP)}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Zoom in"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white text-xl leading-none transition-colors hover:bg-white/20 disabled:opacity-30"
          >
            +
          </button>
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      {/* Image area */}
      <div
        ref={containerRef}
        className="flex flex-1 items-center justify-center overflow-hidden"
        style={{ cursor: isZoomed ? (isDragging ? "grabbing" : "grab") : "zoom-in" }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => { if (!isZoomed && e.target === e.currentTarget) onClose(); }}
      >
        <img
          src={src}
          alt=""
          draggable={false}
          className="max-h-full max-w-full rounded-xl object-contain shadow-2xl select-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            transition: isDragging ? "none" : "transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
          }}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Bottom hint / reset */}
      <div className="flex items-center justify-center py-3 shrink-0 min-h-[44px]">
        {isZoomed ? (
          <button
            onClick={() => { applyZoom(1); setPan({ x: 0, y: 0 }); }}
            className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/20"
          >
            Reset zoom
          </button>
        ) : (
          <p className="text-[11px] text-white/30">
            Scroll or pinch to zoom · Double-tap to zoom in
          </p>
        )}
      </div>
    </div>
  );
}
