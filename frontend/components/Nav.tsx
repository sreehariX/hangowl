"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

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
  const { isAuthenticated, personaName } = useAuth();

  const links = [...PUBLIC_LINKS, ...(isAuthenticated ? AUTH_LINKS : [])];

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
            <span className="ml-2 hidden rounded-full bg-mid-blue/20 px-3 py-1 text-xs text-mid-blue-light md:inline">
              {personaName}
            </span>
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
