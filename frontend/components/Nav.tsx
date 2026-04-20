"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { memo, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { useNotifications } from "@/lib/notifications-context";
import { Avatar } from "@/components/Avatar";
import {
  HomeIcon,
  CompassIcon,
  BellIcon,
  LoginIcon,
} from "@/components/icons";

/**
 * Premium bottom navigation — pill-shaped, blurred, with active pill
 * background and subtle amber glow on the selected item.
 */

interface Item {
  href: string;
  label: string;
  icon: ReactNode;
}

const BASE_ITEMS: Item[] = [
  { href: "/", label: "Feed", icon: <HomeIcon size={22} /> },
  { href: "/hangouts", label: "Hangouts", icon: <CompassIcon size={22} /> },
];

function NavButton({
  href,
  label,
  icon,
  active,
  badge,
}: Item & { active: boolean; badge?: ReactNode }) {
  return (
    <Link
      href={href}
      className={`group relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[10.5px] font-medium transition-colors duration-200 ease-[var(--ease-premium)] ${
        active
          ? "text-amber"
          : "text-text-tertiary hover:text-text-secondary"
      }`}
      aria-current={active ? "page" : undefined}
    >
      <span
        className={`relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors duration-200 ${
          active ? "bg-amber/12" : "group-hover:bg-surface-hover/70"
        }`}
      >
        {icon}
        {badge}
      </span>
      <span className={`${active ? "font-semibold" : ""}`}>{label}</span>
    </Link>
  );
}

export const Nav = memo(function Nav() {
  const pathname = usePathname();
  const { isAuthenticated, personaName, loading: authLoading } = useAuth();
  const { unreadCount, pulse } = useNotifications();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const bellActive = pathname === "/notifications";
  const profileActive = pathname === "/profile";
  const displayCount = isAuthenticated && !bellActive ? unreadCount : 0;
  const badgeLabel =
    displayCount > 99 ? "99+" : displayCount > 0 ? String(displayCount) : null;

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      aria-label="Primary"
    >
      <div className="pointer-events-auto mx-auto flex w-full max-w-[520px] items-stretch justify-around rounded-3xl border border-border/60 bg-ink-850/85 p-1.5 shadow-glass backdrop-blur-2xl">
        {BASE_ITEMS.map((item) => (
          <NavButton key={item.href} {...item} active={isActive(item.href)} />
        ))}

        {!authLoading && isAuthenticated && (
          <NavButton
            href="/notifications"
            label="Buzz"
            active={bellActive}
            icon={
              <span className={pulse ? "animate-like-pop" : ""}>
                <BellIcon size={22} />
              </span>
            }
            badge={
              badgeLabel ? (
                <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white ring-2 ring-ink-850">
                  {badgeLabel}
                </span>
              ) : null
            }
          />
        )}

        {!authLoading && isAuthenticated ? (
          <Link
            href="/profile"
            className={`group relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[10.5px] font-medium transition-colors duration-200 ${
              profileActive ? "text-amber" : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                profileActive ? "bg-amber/12" : "group-hover:bg-surface-hover/70"
              }`}
            >
              <span
                className={`rounded-full transition-all ${
                  profileActive ? "ring-2 ring-amber ring-offset-2 ring-offset-ink-850" : ""
                }`}
              >
                <Avatar name={personaName || ""} size={22} />
              </span>
            </span>
            <span className={profileActive ? "font-semibold" : ""}>You</span>
          </Link>
        ) : !authLoading ? (
          <NavButton
            href="/verify"
            label="Join"
            active={false}
            icon={<LoginIcon size={22} />}
          />
        ) : null}
      </div>
    </nav>
  );
});
