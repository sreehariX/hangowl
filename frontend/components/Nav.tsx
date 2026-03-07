"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/Avatar";
import { api } from "@/lib/api";
import type { Stats } from "@/lib/types";

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, personaName, loading: authLoading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await api.getStats();
        if (active) setStats(data);
      } catch { /* silent */ }
    }
    load();
    const interval = setInterval(load, 30000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    router.push("/");
  };

  const bottomLinks = isAuthenticated
    ? [
        { href: "/", label: "Home" },
        { href: "/board", label: "Board" },
        { href: "/free", label: "I'm Free" },
        { href: "/my-plans", label: "My Plans" },
        { href: "/leaderboard", label: "Ranks" },
        { href: "/contact", label: "Contact" },
      ]
    : [
        { href: "/", label: "Home" },
        { href: "/leaderboard", label: "Ranks" },
        { href: "/contact", label: "Contact" },
      ];

  return (
    <>
      {stats && (
        <div className="fixed top-0 left-0 z-50 p-3 md:p-4">
          <div className="flex items-center gap-3 text-[11px] font-medium">
            <span className="text-amber tabular-nums">{stats.total_users} students</span>
            <span className="flex items-center gap-1 text-success tabular-nums">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
              </span>
              {stats.free_now} online
            </span>
            <span className="text-mid-blue-light tabular-nums">{stats.active_plans} plans</span>
          </div>
        </div>
      )}

      {isAuthenticated && (
        <div className="fixed top-0 right-0 z-50 p-3 md:p-4">
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="h-10 w-10 rounded-full overflow-hidden ring-2 ring-border hover:ring-amber transition-all active:scale-95"
            >
              <Avatar name={personaName || ""} size={40} />
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute top-full mt-2 right-0 z-50 min-w-[13rem] rounded-xl border border-border bg-navy-light p-2 shadow-xl shadow-black/40">
                  <div className="flex items-center gap-3 px-3 py-3 border-b border-border mb-1">
                    <Avatar name={personaName || ""} size={36} />
                    <p className="text-sm font-semibold text-text-primary whitespace-nowrap">
                      {personaName}
                    </p>
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
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-navy/95 backdrop-blur-md safe-area-pb md:static md:border-b md:border-t-0">
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2 md:max-w-4xl md:justify-between md:px-6 md:py-3">
          <Link href="/" className="hidden md:block font-bold text-amber text-lg">
            HangOwl
          </Link>
          <div className="flex items-center gap-1 md:gap-4">
            {bottomLinks.map((link) => {
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
            {!authLoading && !isAuthenticated && (
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
    </>
  );
}
