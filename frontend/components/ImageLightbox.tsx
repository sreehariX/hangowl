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
  const [imgLoaded, setImgLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Refs that native touch handlers can read without stale closures
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  function clampPan(newPan: { x: number; y: number }, z: number) {
    const el = containerRef.current;
    if (!el || z <= 1) return { x: 0, y: 0 };
    const maxX = (el.clientWidth * (z - 1)) / 2;
    const maxY = (el.clientHeight * (z - 1)) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, newPan.x)),
      y: Math.max(-maxY, Math.min(maxY, newPan.y)),
    };
  }

  function applyZoom(newZ: number) {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZ));
    setZoom(clamped);
    if (clamped <= 1) setPan({ x: 0, y: 0 });
  }

  // ─── Keyboard ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "+" || e.key === "=") applyZoom(zoomRef.current + ZOOM_STEP);
      else if (e.key === "-") applyZoom(zoomRef.current - ZOOM_STEP);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Native touch events (reliable pinch zoom on mobile) ─────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Local mutable state for touch tracking (avoids stale closures)
    let lastPinchDist: number | null = null;
    let dragging = false;
    let dragStart = { x: 0, y: 0, panX: 0, panY: 0 };
    let lastTapTime = 0;

    function onTouchStart(e: TouchEvent) {
      e.preventDefault();

      if (e.touches.length === 2) {
        // Pinch starting — record initial distance
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastPinchDist = Math.sqrt(dx * dx + dy * dy);
        dragging = false;
        setIsDragging(false);
      } else if (e.touches.length === 1) {
        const now = Date.now();
        if (now - lastTapTime < 300) {
          // Double tap: toggle zoom
          const curZoom = zoomRef.current;
          const newZ = curZoom > 1 ? MIN_ZOOM : DOUBLE_TAP_ZOOM;
          setZoom(newZ);
          setPan({ x: 0, y: 0 });
          lastTapTime = 0; // reset so triple-tap doesn't re-trigger
          return;
        }
        lastTapTime = now;
        dragging = true;
        dragStart = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          panX: panRef.current.x,
          panY: panRef.current.y,
        };
        setIsDragging(true);
      }
    }

    function onTouchMove(e: TouchEvent) {
      e.preventDefault();

      if (e.touches.length === 2) {
        // Pinch zoom
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (lastPinchDist !== null && lastPinchDist > 0) {
          const ratio = dist / lastPinchDist;
          const curZoom = zoomRef.current;
          const newZ = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, curZoom * ratio));
          setZoom(newZ);
          if (newZ <= 1) setPan({ x: 0, y: 0 });
        }
        lastPinchDist = dist;
      } else if (e.touches.length === 1 && dragging) {
        // Single-finger pan (only when zoomed)
        const curZoom = zoomRef.current;
        if (curZoom <= 1) return;
        const dx = e.touches[0].clientX - dragStart.x;
        const dy = e.touches[0].clientY - dragStart.y;
        const el2 = containerRef.current;
        if (!el2) return;
        const maxX = (el2.clientWidth * (curZoom - 1)) / 2;
        const maxY = (el2.clientHeight * (curZoom - 1)) / 2;
        setPan({
          x: Math.max(-maxX, Math.min(maxX, dragStart.panX + dx)),
          y: Math.max(-maxY, Math.min(maxY, dragStart.panY + dy)),
        });
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (e.touches.length < 2) lastPinchDist = null;
      if (e.touches.length === 0) {
        dragging = false;
        setIsDragging(false);
      }
    }

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: false });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, []); // empty — reads state via refs

  // ─── Mouse wheel zoom ─────────────────────────────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.3 : 0.3;
    const newZ = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomRef.current + delta));
    setZoom(newZ);
    if (newZ <= 1) setPan({ x: 0, y: 0 });
  }, []);

  // ─── Mouse drag ───────────────────────────────────────────────────────────────
  const mouseDragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoomRef.current <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    mouseDragStart.current = { x: e.clientX, y: e.clientY, panX: panRef.current.x, panY: panRef.current.y };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - mouseDragStart.current.x;
    const dy = e.clientY - mouseDragStart.current.y;
    setPan(clampPan(
      { x: mouseDragStart.current.panX + dx, y: mouseDragStart.current.panY + dy },
      zoomRef.current
    ));
  }, [isDragging]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  // ─── Double click (desktop) ───────────────────────────────────────────────────
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const newZ = zoomRef.current > 1 ? MIN_ZOOM : DOUBLE_TAP_ZOOM;
    setZoom(newZ);
    setPan({ x: 0, y: 0 });
  }, []);

  const isZoomed = zoom > 1;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col animate-lightbox-in"
      style={{ background: "#000" }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Close button — top left */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 py-2 z-10 pointer-events-none">
        <button
          onClick={onClose}
          aria-label="Close"
          className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-white/15 active:scale-90"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
          </svg>
        </button>

        {/* Zoom controls — only when zoomed */}
        {isZoomed && (
          <div className="pointer-events-auto flex items-center gap-1">
            <button onClick={() => applyZoom(zoom - ZOOM_STEP)} disabled={zoom <= MIN_ZOOM} aria-label="Zoom out"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white text-lg backdrop-blur-sm transition-colors hover:bg-white/15 disabled:opacity-30">−</button>
            <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              className="rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm transition-colors hover:bg-white/15">Reset</button>
            <button onClick={() => applyZoom(zoom + ZOOM_STEP)} disabled={zoom >= MAX_ZOOM} aria-label="Zoom in"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white text-lg backdrop-blur-sm transition-colors hover:bg-white/15 disabled:opacity-30">+</button>
          </div>
        )}
      </div>

      {/* Image area */}
      <div
        ref={containerRef}
        className="flex flex-1 items-center justify-center overflow-hidden"
        style={{
          cursor: isZoomed ? (isDragging ? "grabbing" : "grab") : "default",
          touchAction: "none",
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onClick={(e) => { if (!isZoomed && e.target === e.currentTarget) onClose(); }}
      >
        <img
          src={src}
          alt=""
          draggable={false}
          onLoad={() => setImgLoaded(true)}
          className={`max-h-full max-w-full object-contain select-none ${imgLoaded ? "animate-lightbox-img-in" : "opacity-0"}`}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            transition: isDragging ? "none" : "transform 0.15s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
          }}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Bottom hint */}
      {!isZoomed && (
        <div className="flex items-center justify-center py-4 shrink-0 pointer-events-none">
          <p className="text-[11px] text-white/25 tracking-wide">
            Pinch or scroll to zoom · Double-tap to zoom in
          </p>
        </div>
      )}
    </div>
  );
}
