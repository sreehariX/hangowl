"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useNotifications } from "@/lib/notifications-context";
import { Avatar } from "@/components/Avatar";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Feed",
    icon: (active: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        {!active && <polyline points="9 22 9 12 15 12 15 22" />}
      </svg>
    ),
  },
  {
    href: "/hangouts",
    label: "Hangouts",
    icon: (active: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
      </svg>
    ),
  },
];

function BellIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

export function Nav() {
  const pathname = usePathname();
  const { isAuthenticated, personaName, loading: authLoading } = useAuth();
  const { unreadCount, pulse } = useNotifications();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const bellActive = pathname === "/notifications";
  // Derive display count: hide badge when not authenticated or currently viewing notifications
  const displayCount = isAuthenticated && !bellActive ? unreadCount : 0;
  const badgeLabel = displayCount > 99 ? "99+" : displayCount > 0 ? String(displayCount) : null;

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-50 safe-area-pb px-3 pb-2">
      <div className="pointer-events-auto mx-auto flex w-full max-w-[680px] items-stretch justify-around rounded-2xl border border-border/80 bg-navy-light/85 px-2 py-1.5 shadow-glass backdrop-blur-xl">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex flex-1 flex-col items-center gap-1 rounded-xl py-2 transition-all ${
                active
                  ? "bg-amber/12 text-amber"
                  : "text-text-muted hover:bg-navy-lighter/80 hover:text-text-secondary"
              }`}
            >
              <div className={`${active ? "" : "transition-transform group-hover:-translate-y-0.5"}`}>
                {item.icon(active)}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}

        {/* Notification Bell */}
        {!authLoading && isAuthenticated && (
          <Link
            href="/notifications"
            className={`group relative flex flex-1 flex-col items-center gap-1 rounded-xl py-2 transition-all ${
              bellActive
                ? "bg-amber/12 text-amber"
                : "text-text-muted hover:bg-navy-lighter/80 hover:text-text-secondary"
            }`}
          >
            <div className={`relative ${pulse ? "animate-like-pop" : "transition-transform group-hover:-translate-y-0.5"}`}>
              <BellIcon active={bellActive} />
              {badgeLabel && (
                <span className="absolute -right-2.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold leading-none text-white shadow-sm">
                  {badgeLabel}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">Buzz</span>
          </Link>
        )}

        {!authLoading && isAuthenticated ? (
          <Link
            href="/profile"
            className={`group flex flex-1 flex-col items-center gap-1 rounded-xl py-2 transition-all ${
              pathname === "/profile"
                ? "bg-amber/12 text-amber"
                : "text-text-muted hover:bg-navy-lighter/80 hover:text-text-secondary"
            }`}
          >
            <div className={`rounded-full transition-all ${pathname === "/profile" ? "ring-2 ring-amber/80 ring-offset-2 ring-offset-navy-light" : "ring-2 ring-transparent group-hover:-translate-y-0.5"}`}>
              <Avatar name={personaName || ""} size={24} />
            </div>
            <span className="text-[10px] font-medium">You</span>
          </Link>
        ) : !authLoading ? (
          <Link
            href="/verify"
            className="flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-amber transition-all hover:bg-amber/10"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" x2="3" y1="12" y2="12" />
            </svg>
            <span className="text-[10px] font-medium">Join</span>
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
