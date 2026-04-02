"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_COOLDOWN = 60 * 60 * 1000; // 1 hour

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // If already running as installed app, never show
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator && (window.navigator as Navigator & { standalone: boolean }).standalone);
    if (isStandalone) return;

    // Clear stale "installed" flag if app is no longer on home screen
    localStorage.removeItem("hangowl_installed");

    const lastDismissed = localStorage.getItem("hangowl_install_dismissed");
    if (lastDismissed) {
      const elapsed = Date.now() - parseInt(lastDismissed, 10);
      if (elapsed < DISMISS_COOLDOWN) return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      localStorage.setItem("hangowl_installed", "true");
      setInstalled(true);
    }
    setDeferredPrompt(null);
    if (outcome !== "accepted") setShow(false);
  };

  const handleDismiss = () => {
    localStorage.setItem("hangowl_install_dismissed", Date.now().toString());
    setShow(false);
    setInstalled(false);
  };

  if (!show) return null;

  if (installed) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center pb-24 px-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-sm animate-slide-up">
          <div className="rounded-2xl border border-amber/30 bg-navy-light p-5 shadow-2xl shadow-black/60">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber/20 text-3xl">
                🏠
              </div>
              <div>
                <p className="font-bold text-base text-text-primary">
                  You&apos;re all set!
                </p>
                <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
                  Go to your home screen, tap the{" "}
                  <span className="text-amber font-semibold">HangOwl</span>{" "}
                  icon, and continue from there.
                </p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="mt-4 w-full rounded-xl bg-amber py-2.5 text-sm font-bold text-navy transition-colors hover:bg-amber-dark"
            >
              Got it!
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-24 px-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-sm animate-slide-up">
        <div className="rounded-2xl border border-amber/30 bg-navy-light p-5 shadow-2xl shadow-black/60 relative overflow-hidden">
          {/* decorative glow */}
          <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-amber/10 blur-2xl pointer-events-none" />

          <div className="relative flex flex-col items-center text-center gap-1">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber/20 text-3xl mb-1">
              🦉
            </div>
            <p className="font-bold text-base text-text-primary">
              Add HangOwl to your home screen
            </p>
            <p className="text-xs text-text-muted leading-relaxed max-w-[220px]">
              Open it like any other app — no browser needed.
            </p>

            <div className="mt-2 flex items-center gap-1.5 rounded-full bg-amber/10 px-3 py-1">
              <span className="text-xs text-amber font-medium">⚡ One tap to open, anytime</span>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={handleDismiss}
              className="flex-1 rounded-xl border border-border py-2.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface"
            >
              Later
            </button>
            <button
              onClick={handleInstall}
              className="flex-[2] rounded-xl bg-amber py-2.5 text-sm font-bold text-navy transition-all hover:bg-amber-dark active:scale-95"
            >
              Install App →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
