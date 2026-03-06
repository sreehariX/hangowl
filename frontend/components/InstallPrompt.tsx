"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("hangowl_installed") === "true") return;

    const lastDismissed = localStorage.getItem("hangowl_install_dismissed");
    if (lastDismissed) {
      const elapsed = Date.now() - parseInt(lastDismissed, 10);
      if (elapsed < 24 * 60 * 60 * 1000) return;
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
    }
    setDeferredPrompt(null);
    setShow(false);
  };

  const handleDismiss = () => {
    localStorage.setItem("hangowl_install_dismissed", Date.now().toString());
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-sm animate-slide-up md:bottom-6">
      <div className="rounded-2xl border border-amber/20 bg-navy-light p-4 shadow-xl shadow-black/40">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber/15 text-xl">
            🦉
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-text-primary">
              Add HangOwl to Home Screen
            </p>
            <p className="text-xs text-text-muted mt-0.5">
              Open instantly, like a real app
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleDismiss}
            className="flex-1 rounded-lg border border-border py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-surface"
          >
            Later
          </button>
          <button
            onClick={handleInstall}
            className="flex-1 rounded-lg bg-amber py-2 text-xs font-semibold text-navy transition-colors hover:bg-amber-dark"
          >
            Install
          </button>
        </div>
      </div>
    </div>
  );
}
