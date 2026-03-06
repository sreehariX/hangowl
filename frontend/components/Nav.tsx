"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/Avatar";

const PUBLIC_LINKS = [
  { href: "/", label: "Home" },
  { href: "/leaderboard", label: "Ranks" },
];

const AUTH_LINKS = [
  { href: "/board", label: "Board" },
  { href: "/free", label: "I'm Free" },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, personaName, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [...PUBLIC_LINKS, ...(isAuthenticated ? AUTH_LINKS : [])];

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    router.push("/");
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-navy/95 backdrop-blur-md safe-area-pb md:static md:border-b md:border-t-0">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2 md:max-w-4xl md:justify-between md:px-6 md:py-3">
        <Link href="/" className="hidden md:block font-bold text-amber text-lg">
          HangOwl
        </Link>
        <div className="flex items-center gap-1 md:gap-4">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-amber/15 text-amber"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          {isAuthenticated ? (
            <div className="relative ml-2">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 rounded-full bg-surface px-2 py-1 transition-colors hover:bg-surface-hover"
              >
                <Avatar name={personaName || ""} size={26} />
                <span className="hidden text-xs text-text-secondary md:inline max-w-[100px] truncate">
                  {personaName}
                </span>
              </button>
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute bottom-full mb-2 right-0 z-50 w-48 rounded-xl border border-border bg-navy-light p-2 shadow-xl shadow-black/40 md:bottom-auto md:top-full md:mt-2 md:mb-0">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-border mb-1">
                      <Avatar name={personaName || ""} size={32} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {personaName}
                        </p>
                        <p className="text-[10px] text-text-muted">New Owl</p>
                      </div>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-error transition-colors hover:bg-error/10"
                    >
                      Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link
              href="/verify"
              className="ml-2 rounded-lg bg-amber px-3 py-2 text-sm font-semibold text-navy transition-colors hover:bg-amber-dark"
            >
              Join
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
