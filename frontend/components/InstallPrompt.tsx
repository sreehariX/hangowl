"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon } from "@/components/icons";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const SUPPRESS_KEY = "hangowl_suppress_until";
const ONE_HOUR = 60 * 60 * 1000;
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

function isSuppressed() {
  try {
    const until = localStorage.getItem(SUPPRESS_KEY);
    return until ? Date.now() < parseInt(until, 10) : false;
  } catch { return false; }
}
function suppressFor(ms: number) {
  try { localStorage.setItem(SUPPRESS_KEY, (Date.now() + ms).toString()); }
  catch {}
}

type Stage = "prompt" | "progress" | "done";

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [stage, setStage] = useState<Stage>("prompt");
  const [progress, setProgress] = useState(0);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator &&
        (window.navigator as Navigator & { standalone: boolean }).standalone);
    if (isStandalone || isSuppressed()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(
    () => () => { if (progressRef.current) clearInterval(progressRef.current); },
    [],
  );

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);

    if (outcome === "accepted") {
      suppressFor(THIRTY_DAYS);
      setStage("progress");
      setProgress(0);
      let p = 0;
      progressRef.current = setInterval(() => {
        p += p < 60 ? 8 : p < 85 ? 3 : 0.5;
        setProgress(Math.min(p, 92));
      }, 80);
      setTimeout(() => {
        if (progressRef.current) clearInterval(progressRef.current);
        setProgress(100);
        setTimeout(() => setStage("done"), 400);
      }, 2000);
    } else {
      setShow(false);
    }
  }

  function handleLater() {
    suppressFor(ONE_HOUR);
    setShow(false);
    setStage("prompt");
    setProgress(0);
  }

  if (!show) return null;

  const shell =
    "pointer-events-auto w-full max-w-sm animate-slide-up rounded-2xl border border-border bg-surface p-5";

  if (stage === "progress") {
    return (
      <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center px-4 pb-24">
        <div className={shell}>
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="text-3xl">🦉</div>
            <p className="text-body-lg font-semibold text-text-primary">
              Adding to home screen…
            </p>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-hover">
            <div
              className="h-full bg-amber transition-[width] duration-100 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-center text-caption tabular-nums text-text-tertiary">
            {Math.round(progress)}%
          </p>
        </div>
      </div>
    );
  }

  if (stage === "done") {
    return (
      <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center px-4 pb-24">
        <div className={shell}>
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckIcon size={24} />
            </div>
            <p className="text-body-lg font-semibold text-text-primary">
              HangOwl is on your home screen
            </p>
            <p className="text-caption text-text-tertiary">
              Tap the HangOwl icon to continue.
            </p>
          </div>
          <button onClick={() => setShow(false)} className="btn-primary btn-block mt-4">
            Got it
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center px-4 pb-24">
      <div className={shell}>
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="text-3xl">🦉</div>
          <p className="text-body-lg font-semibold text-text-primary">
            Add HangOwl to your home screen
          </p>
          <p className="max-w-[240px] text-caption text-text-tertiary">
            Open it like any other app.
          </p>
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={handleLater} className="btn-secondary flex-1">
            Later
          </button>
          <button onClick={handleInstall} className="btn-primary flex-[2]">
            Install
          </button>
        </div>
      </div>
    </div>
  );
}
