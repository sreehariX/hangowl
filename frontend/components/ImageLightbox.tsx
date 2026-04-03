"use client";

import { useEffect, useRef, useState } from "react";

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
  const [imgLoaded, setImgLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // All mutable gesture state in refs to avoid stale closures
  const stateRef = useRef({
    zoom: 1,
    pan: { x: 0, y: 0 },
    pointers: new Map<number, { x: number; y: number }>(),
    pinchStartDist: 0,
    pinchStartZoom: 1,
    dragStartPan: { x: 0, y: 0 },
    dragStartPos: { x: 0, y: 0 },
    lastTapTime: 0,
    isDragging: false,
  });

  function commit(newZoom: number, newPan: { x: number; y: number }) {
    const el = containerRef.current;
    const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    let { x, y } = newPan;
    if (el && clampedZoom > 1) {
      const maxX = (el.clientWidth * (clampedZoom - 1)) / 2;
      const maxY = (el.clientHeight * (clampedZoom - 1)) / 2;
      x = Math.max(-maxX, Math.min(maxX, x));
      y = Math.max(-maxY, Math.min(maxY, y));
    } else {
      x = 0;
      y = 0;
    }
    stateRef.current.zoom = clampedZoom;
    stateRef.current.pan = { x, y };
    setZoom(clampedZoom);
    setPan({ x, y });
  }

  // Pointer Events — reliable cross-browser pinch zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const captureEl = el;
    const s = stateRef.current;

    function getPinchDist() {
      const pts = Array.from(s.pointers.values());
      if (pts.length < 2) return 0;
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function onPointerDown(e: PointerEvent) {
      e.preventDefault();
      captureEl.setPointerCapture(e.pointerId);
      s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (s.pointers.size === 2) {
        // Starting pinch — snapshot current state
        s.pinchStartDist = getPinchDist();
        s.pinchStartZoom = s.zoom;
        s.isDragging = false;
      } else if (s.pointers.size === 1) {
        // Single pointer — check for double-tap
        const now = Date.now();
        if (now - s.lastTapTime < 280) {
          // Double tap: toggle zoom
          s.lastTapTime = 0;
          if (s.zoom > 1) {
            commit(MIN_ZOOM, { x: 0, y: 0 });
          } else {
            commit(DOUBLE_TAP_ZOOM, { x: 0, y: 0 });
          }
          return;
        }
        s.lastTapTime = now;
        s.isDragging = true;
        s.dragStartPos = { x: e.clientX, y: e.clientY };
        s.dragStartPan = { ...s.pan };
      }
    }

    function onPointerMove(e: PointerEvent) {
      e.preventDefault();
      if (!s.pointers.has(e.pointerId)) return;
      s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (s.pointers.size === 2) {
        // Pinch zoom
        const dist = getPinchDist();
        if (s.pinchStartDist > 0) {
          const newZoom = s.pinchStartZoom * (dist / s.pinchStartDist);
          commit(newZoom, s.pan);
        }
      } else if (s.pointers.size === 1 && s.isDragging && s.zoom > 1) {
        // Pan (only when zoomed)
        const dx = e.clientX - s.dragStartPos.x;
        const dy = e.clientY - s.dragStartPos.y;
        commit(s.zoom, { x: s.dragStartPan.x + dx, y: s.dragStartPan.y + dy });
      }
    }

    function onPointerUp(e: PointerEvent) {
      s.pointers.delete(e.pointerId);
      if (s.pointers.size < 2) {
        s.pinchStartDist = 0;
      }
      if (s.pointers.size === 0) {
        s.isDragging = false;
      }
    }

    el.addEventListener("pointerdown", onPointerDown, { passive: false });
    el.addEventListener("pointermove", onPointerMove, { passive: false });
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "+" || e.key === "=") commit(stateRef.current.zoom + ZOOM_STEP, stateRef.current.pan);
      else if (e.key === "-") commit(stateRef.current.zoom - ZOOM_STEP, stateRef.current.pan);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mouse wheel zoom (desktop)
  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.3 : 0.3;
    commit(stateRef.current.zoom + delta, stateRef.current.pan);
  }

  const isZoomed = zoom > 1;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col animate-lightbox-in"
      style={{ background: "#000" }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top bar */}
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
        {isZoomed && (
          <div className="pointer-events-auto flex items-center gap-1">
            <button
              onClick={() => commit(zoom - ZOOM_STEP, stateRef.current.pan)}
              disabled={zoom <= MIN_ZOOM}
              aria-label="Zoom out"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white text-lg backdrop-blur-sm transition-colors hover:bg-white/15 disabled:opacity-30"
            >−</button>
            <button
              onClick={() => commit(MIN_ZOOM, { x: 0, y: 0 })}
              className="rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm transition-colors hover:bg-white/15"
            >Reset</button>
            <button
              onClick={() => commit(zoom + ZOOM_STEP, stateRef.current.pan)}
              disabled={zoom >= MAX_ZOOM}
              aria-label="Zoom in"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white text-lg backdrop-blur-sm transition-colors hover:bg-white/15 disabled:opacity-30"
            >+</button>
          </div>
        )}
      </div>

      {/* Image area */}
      <div
        ref={containerRef}
        className="flex flex-1 items-center justify-center overflow-hidden"
        style={{ touchAction: "none", cursor: isZoomed ? "grab" : "default" }}
        onWheel={handleWheel}
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
            transition: "none",
            pointerEvents: "none", // let container handle all pointer events
          }}
        />
      </div>

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
