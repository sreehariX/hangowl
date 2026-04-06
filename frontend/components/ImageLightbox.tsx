"use client";

import { useEffect, useRef, useState } from "react";

interface ImageLightboxProps {
  src: string;
  onClose: () => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.5;
const DBL_TAP_ZOOM = 2.5;

export function ImageLightbox({ src, onClose }: ImageLightboxProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [imgLoaded, setImgLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Single mutable object — updated SYNCHRONOUSLY before setState so touch handlers
  // always read current values (no stale-closure bug with useEffect-synced refs)
  const g = useRef({
    zoom: 1,
    pan: { x: 0, y: 0 },
    pinchStartDist: 0,
    pinchStartZoom: 1,
    dragging: false,
    dragStart: { x: 0, y: 0, panX: 0, panY: 0 },
    lastTap: 0,
  });

  function clampedZoom(z: number) {
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
  }

  function clampedPan(x: number, y: number, z: number) {
    const el = containerRef.current;
    if (!el || z <= 1) return { x: 0, y: 0 };
    const mx = (el.clientWidth * (z - 1)) / 2;
    const my = (el.clientHeight * (z - 1)) / 2;
    return {
      x: Math.max(-mx, Math.min(mx, x)),
      y: Math.max(-my, Math.min(my, y)),
    };
  }

  function commit(newZoom: number, newX: number, newY: number) {
    const cz = clampedZoom(newZoom);
    const { x, y } = clampedPan(newX, newY, cz);
    g.current.zoom = cz;
    g.current.pan = { x, y };
    setZoom(cz);
    setPan({ x, y });
  }

  // ── Touch events (most reliable cross-platform, especially iOS Safari) ──────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const state = g.current;

    function dist(t: TouchList) {
      const dx = t[0].clientX - t[1].clientX;
      const dy = t[0].clientY - t[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function onStart(e: TouchEvent) {
      e.preventDefault();

      if (e.touches.length === 2) {
        // Start pinch — snapshot current state so each move calculates from baseline
        state.pinchStartDist = dist(e.touches);
        state.pinchStartZoom = state.zoom;
        state.dragging = false;
        return;
      }

      if (e.touches.length === 1) {
        const now = Date.now();
        if (now - state.lastTap < 280) {
          // Double tap: toggle zoom
          state.lastTap = 0;
          if (state.zoom > 1) {
            commit(MIN_ZOOM, 0, 0);
          } else {
            commit(DBL_TAP_ZOOM, 0, 0);
          }
          return;
        }
        state.lastTap = now;
        state.dragging = true;
        state.dragStart = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          panX: state.pan.x,
          panY: state.pan.y,
        };
      }
    }

    function onMove(e: TouchEvent) {
      e.preventDefault();

      if (e.touches.length === 2) {
        if (state.pinchStartDist === 0) return;
        // Calculate zoom from baseline (avoids cumulative error)
        const d = dist(e.touches);
        const newZoom = state.pinchStartZoom * (d / state.pinchStartDist);
        commit(newZoom, state.pan.x, state.pan.y);
        return;
      }

      if (e.touches.length === 1 && state.dragging && state.zoom > 1) {
        const dx = e.touches[0].clientX - state.dragStart.x;
        const dy = e.touches[0].clientY - state.dragStart.y;
        commit(state.zoom, state.dragStart.panX + dx, state.dragStart.panY + dy);
      }
    }

    function onEnd(e: TouchEvent) {
      if (e.touches.length < 2) state.pinchStartDist = 0;
      if (e.touches.length === 0) state.dragging = false;
    }

    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: false });

    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "+" || e.key === "=") commit(g.current.zoom + ZOOM_STEP, g.current.pan.x, g.current.pan.y);
      else if (e.key === "-") commit(g.current.zoom - ZOOM_STEP, g.current.pan.x, g.current.pan.y);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mobile back button ────────────────────────────────────────────────────
  const closedByBackRef = useRef(false);
  useEffect(() => {
    closedByBackRef.current = false;
    history.pushState({ lightbox: true }, "");

    const onPopState = () => {
      closedByBackRef.current = true;
      onClose();
    };
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("popstate", onPopState);
      // If closed by X (not back button), pop the history entry we pushed
      if (!closedByBackRef.current && history.state?.lightbox) {
        history.back();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mouse wheel (desktop) ────────────────────────────────────────────────
  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.3 : 0.3;
    commit(g.current.zoom + delta, g.current.pan.x, g.current.pan.y);
  }

  // ── Mouse drag (desktop) ────────────────────────────────────────────────
  const mouseDrag = useRef({ active: false, startX: 0, startY: 0, panX: 0, panY: 0 });
  function onMouseDown(e: React.MouseEvent) {
    if (g.current.zoom <= 1) return;
    e.preventDefault();
    mouseDrag.current = { active: true, startX: e.clientX, startY: e.clientY, panX: g.current.pan.x, panY: g.current.pan.y };
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!mouseDrag.current.active) return;
    commit(g.current.zoom, mouseDrag.current.panX + e.clientX - mouseDrag.current.startX, mouseDrag.current.panY + e.clientY - mouseDrag.current.startY);
  }
  function onMouseUp() { mouseDrag.current.active = false; }

  // ── Double click (desktop) ───────────────────────────────────────────────
  function onDblClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (g.current.zoom > 1) commit(MIN_ZOOM, 0, 0);
    else commit(DBL_TAP_ZOOM, 0, 0);
  }

  const isZoomed = zoom > 1;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col animate-lightbox-in"
      style={{ background: "#000" }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Close button + zoom controls */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 py-2 z-10 pointer-events-none">
        {isZoomed ? (
          <div className="pointer-events-auto flex items-center gap-1">
            <button onClick={() => commit(zoom - ZOOM_STEP, g.current.pan.x, g.current.pan.y)} disabled={zoom <= MIN_ZOOM}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white text-lg backdrop-blur-sm hover:bg-white/15 disabled:opacity-30">−</button>
            <button onClick={() => commit(MIN_ZOOM, 0, 0)}
              className="rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm hover:bg-white/15">Reset</button>
            <button onClick={() => commit(zoom + ZOOM_STEP, g.current.pan.x, g.current.pan.y)} disabled={zoom >= MAX_ZOOM}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white text-lg backdrop-blur-sm hover:bg-white/15 disabled:opacity-30">+</button>
          </div>
        ) : (
          <div />
        )}
        <button
          onClick={onClose}
          aria-label="Close"
          className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-white/15 active:scale-90"
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
        style={{ touchAction: "none", cursor: isZoomed ? "grab" : "default" }}
        onWheel={handleWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onDoubleClick={onDblClick}
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
            pointerEvents: "none",
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
