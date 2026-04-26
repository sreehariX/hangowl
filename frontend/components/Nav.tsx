"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { useNotifications } from "@/lib/notifications-context";
import { useIsAdmin } from "@/lib/hooks";
import { Avatar } from "@/components/Avatar";
import {
  HomeIcon,
  CompassIcon,
  BellIcon,
  LoginIcon,
  BarChartIcon,
} from "@/components/icons";

interface Item {
  href: string;
  label: string;
  icon: ReactNode;
}

const ICON_SIZE = 22;

const BASE_ITEMS: Item[] = [
  { href: "/", label: "Feed", icon: <HomeIcon size={ICON_SIZE} /> },
  { href: "/hangouts", label: "Hangouts", icon: <CompassIcon size={ICON_SIZE} /> },
];

function MobileButton({
  href,
  label,
  icon,
  active,
  badge,
}: Item & { active: boolean; badge?: ReactNode }) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`relative flex flex-1 items-center justify-center py-2.5 transition-colors ${
        active ? "text-amber" : "text-text-tertiary hover:text-text-primary"
      }`}
    >
      <span className="relative">
        {icon}
        {badge}
      </span>
    </Link>
  );
}

function DesktopLink({
  href,
  label,
  icon,
  active,
  badge,
}: Item & { active: boolean; badge?: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
        active
          ? "bg-surface-hover text-text-primary"
          : "text-text-tertiary hover:bg-surface-hover/60 hover:text-text-primary"
      }`}
    >
      <span className="relative inline-flex">
        {icon}
        {badge}
      </span>
      <span>{label}</span>
    </Link>
  );
}

/*
 * Scroll direction hook. The bottom nav softens and fades while scrolling
 * down, then restores its opaque state when the user scrolls up. Mimics
 * Twitter/X and Instagram's primary bars on mobile.
 */
function useScrollState() {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    lastY.current = window.scrollY;
    const handler = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY.current;
        if (y < 12) setHidden(false);
        else if (delta > 8) setHidden(true);
        else if (delta < -6) setHidden(false);
        lastY.current = y;
        ticking.current = false;
      });
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return hidden;
}

export const Nav = memo(function Nav() {
  const pathname = usePathname();
  const { isAuthenticated, personaName, loading: authLoading } = useAuth();
  const { unreadCount, pulse } = useNotifications();
  const scrolledDown = useScrollState();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const bellActive = pathname === "/notifications";
  const profileActive = pathname === "/profile";
  const displayCount = isAuthenticated && !bellActive ? unreadCount : 0;
  const badgeLabel =
    displayCount > 99 ? "99+" : displayCount > 0 ? String(displayCount) : null;

  const bellIcon = (
    <span className={pulse ? "animate-like-pop" : undefined}>
      <BellIcon size={ICON_SIZE} />
    </span>
  );
  const mobileBellBadge = badgeLabel ? (
    <span className="absolute -right-2 -top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white">
      {badgeLabel}
    </span>
  ) : null;
  const desktopBellBadge = badgeLabel ? (
    <span className="absolute -right-1.5 -top-1.5 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-danger px-1 text-[9px] font-semibold leading-none text-white">
      {badgeLabel}
    </span>
  ) : null;

  return (
    <>
      {/* Mobile bottom nav */}
      <nav
        aria-label="Primary"
        data-dim={scrolledDown ? "true" : "false"}
        className="nav-bar fixed inset-x-0 bottom-0 z-50 safe-area-pb md:hidden"
      >
        <div className="mx-auto flex max-w-[600px] items-stretch">
          {BASE_ITEMS.map((item) => (
            <MobileButton key={item.href} {...item} active={isActive(item.href)} />
          ))}

          {!authLoading && isAuthenticated && (
            <MobileButton
              href="/notifications"
              label="Notifications"
              active={bellActive}
              icon={bellIcon}
              badge={mobileBellBadge}
            />
          )}

          {!authLoading && isAuthenticated ? (
            <Link
              href="/profile"
              aria-label="Profile"
              aria-current={profileActive ? "page" : undefined}
              className={`relative flex flex-1 items-center justify-center py-2.5 transition-colors ${
                profileActive
                  ? "text-amber"
                  : "text-text-tertiary hover:text-text-primary"
              }`}
            >
              <span
                className={`relative inline-flex items-center justify-center transition-transform duration-200 ${
                  profileActive ? "scale-[1.04]" : ""
                }`}
              >
                <Avatar name={personaName || ""} size={ICON_SIZE + 4} />
                {profileActive && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -bottom-[9px] left-1/2 h-[3px] w-6 -translate-x-1/2 rounded-full bg-amber"
                  />
                )}
              </span>
            </Link>
          ) : !authLoading ? (
            <MobileButton
              href="/verify"
              label="Sign in"
              active={false}
              icon={<LoginIcon size={ICON_SIZE} />}
            />
          ) : null}
        </div>
      </nav>

      {/* Desktop top nav: premium, centred, compact */}
      <nav
        aria-label="Primary"
        className="desktop-nav hidden md:flex"
      >
        <div className="mx-auto flex w-full max-w-[1080px] items-center gap-6 px-6 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-text-primary"
          >
            <span aria-hidden className="text-lg">🦉</span>
            HangOwl
          </Link>

          <div className="flex items-center gap-1">
            {BASE_ITEMS.map((item) => (
              <DesktopLink key={item.href} {...item} active={isActive(item.href)} />
            ))}
            {!authLoading && isAuthenticated && (
              <DesktopLink
                href="/notifications"
                label="Notifications"
                active={bellActive}
                icon={bellIcon}
                badge={desktopBellBadge}
              />
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {!authLoading && isAuthenticated ? (
              <Link
                href="/profile"
                aria-label="Profile"
                aria-current={profileActive ? "page" : undefined}
                className={`flex items-center gap-2 rounded-full px-2 py-1 transition-colors ${
                  profileActive ? "bg-surface-hover" : "hover:bg-surface-hover/60"
                }`}
              >
                <Avatar name={personaName || ""} size={28} />
                <span className="max-w-[140px] truncate text-[13px] font-medium text-text-primary">
                  {personaName}
                </span>
              </Link>
            ) : !authLoading ? (
              <Link
                href="/verify"
                className="btn-primary btn-xs px-3"
              >
                Sign in
              </Link>
            ) : null}
          </div>
        </div>
      </nav>

    </>
  );
});

/**
 * Admin-only access bar. Renders directly under the navbar with a single
 * "Metrics" button; hidden entirely for non-admins so the admin surface is
 * invisible to regular users.
 *
 * Lives as its own slot in the document flow (rendered from RootLayout
 * rather than inside the Nav fragment) so the bar can position itself
 * relative to the natural document order without fighting the existing
 * sticky/fixed behaviour of the surrounding nav elements.
 */
export function AdminBar() {
  const pathname = usePathname();
  const isAdmin = useIsAdmin();
  if (isAdmin !== true) return null;
  const metricsActive = pathname === "/admin/metrics";
  return (
    <div
      aria-label="Admin tools"
      className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur"
    >
      <div className="mx-auto flex w-full max-w-[1080px] items-center gap-2 px-4 py-1.5 md:px-6">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-amber">
          Admin
        </span>
        <Link
          href="/admin/metrics"
          aria-current={metricsActive ? "page" : undefined}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
            metricsActive
              ? "bg-amber text-ink-950"
              : "bg-surface-hover text-text-primary hover:bg-surface-hover/80"
          }`}
        >
          <BarChartIcon size={14} />
          Metrics
        </Link>
      </div>
    </div>
  );
}
