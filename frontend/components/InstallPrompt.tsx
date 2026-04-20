"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, SparkleIcon } from "@/components/icons";

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
  } catch {
    return false;
  }
}

function suppressFor(ms: number) {
  try {
    localStorage.setItem(SUPPRESS_KEY, (Date.now() + ms).toString());
  } catch {
    /* storage unavailable */
  }
}

type Stage = "prompt" | "progress" | "done";

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [stage, setStage] = useState<Stage>("prompt");
  const [progress, setProgress] = useState(0);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator &&
        (window.navigator as Navigator & { standalone: boolean }).standalone);
    if (isStandalone) return;
    if (isSuppressed()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(
    () => () => {
      if (progressRef.current) clearInterval(progressRef.current);
    },
    [],
  );

  const handleInstall = async () => {
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
  };

  const handleLater = () => {
    suppressFor(ONE_HOUR);
    setShow(false);
    setStage("prompt");
    setProgress(0);
  };

  if (!show) return null;

  const shell =
    "pointer-events-auto w-full max-w-sm animate-slide-up surface-hero overflow-hidden p-5";

  if (stage === "progress") {
    return (
      <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center px-4 pb-28">
        <div className={shell}>
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber/15 text-3xl">
              🦉
            </div>
            <div>
              <p className="text-body-lg font-semibold text-text-primary">
                Adding to home screen…
              </p>
              <p className="mt-1 text-caption text-text-tertiary">Just a moment</p>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink-850">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-[width] duration-100 ease-out"
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
      <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center px-4 pb-28">
        <div className={shell}>
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success/15 text-success">
              <CheckIcon size={28} />
            </div>
            <div>
              <p className="text-body-lg font-semibold text-text-primary">
                HangOwl is on your home screen
              </p>
              <p className="mt-1.5 text-caption leading-relaxed text-text-tertiary">
                Close this and tap the{" "}
                <span className="font-semibold text-amber">HangOwl</span> icon to
                continue.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShow(false)}
            className="btn-primary btn-block mt-4"
          >
            Got it
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center px-4 pb-28">
      <div className={`${shell} relative`}>
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-amber/15 blur-3xl"
        />
        <div className="relative flex flex-col items-center gap-1.5 text-center">
          <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber/15 text-3xl">
            🦉
          </div>
          <p className="text-body-lg font-semibold text-text-primary">
            Add HangOwl to your home screen
          </p>
          <p className="max-w-[240px] text-caption leading-relaxed text-text-tertiary">
            Open it like any other app — no browser needed.
          </p>
          <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-amber/10 px-3 py-1 text-caption font-semibold text-amber">
            <SparkleIcon size={12} /> One tap to open, anytime
          </span>
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={handleLater} className="btn-secondary flex-1">
            Later
          </button>
          <button onClick={handleInstall} className="btn-primary flex-[2]">
            Install app
          </button>
        </div>
      </div>
    </div>
  );
}
