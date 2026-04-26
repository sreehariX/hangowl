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

function SidebarLink({
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
      className={`group relative flex items-center gap-4 rounded-full px-4 py-2.5 text-[16px] font-medium transition-colors xl:px-5 ${
        active
          ? "bg-surface-hover text-text-primary"
          : "text-text-secondary hover:bg-surface-hover/60 hover:text-text-primary"
      }`}
    >
      <span className="relative inline-flex">
        {icon}
        {badge}
      </span>
      <span className="hidden xl:inline">{label}</span>
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
  const isAdmin = useIsAdmin();
  const metricsActive = pathname === "/admin/metrics";

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

      {/*
       * Desktop left sidebar (Twitter/X style). Two-step layout:
       *   - md (≥768px): icon-only rail (~72px wide) so we don't gobble
       *     reading width on smaller laptops
       *   - xl (≥1280px): expanded rail (~260px) with labels alongside the
       *     icons, matching X/Twitter's wide breakpoint
       *
       * The sidebar is `fixed` so the timeline scrolls independently
       * underneath it, exactly like Twitter/X. Page content gets a left
       * gutter (md:pl-[72px] xl:pl-[260px]) from the layout shell so it
       * doesn't slide under the sidebar.
       */}
      <aside
        aria-label="Primary"
        className="fixed inset-y-0 left-0 z-40 hidden h-dvh w-[72px] flex-col border-r border-border bg-ink-900/70 backdrop-blur-md md:flex xl:w-[260px]"
      >
        <div className="flex h-full flex-col gap-1 px-2 py-3 xl:px-4">
          <Link
            href="/"
            className="flex h-12 items-center justify-center rounded-full text-amber transition-colors hover:bg-surface-hover/60 xl:justify-start xl:gap-2 xl:px-4 xl:text-[20px] xl:font-semibold xl:tracking-tight xl:text-text-primary"
            aria-label="HangOwl home"
          >
            <span aria-hidden className="text-2xl">🦉</span>
            <span className="hidden xl:inline">HangOwl</span>
          </Link>

          <nav className="mt-2 flex flex-col gap-1">
            {BASE_ITEMS.map((item) => (
              <SidebarLink key={item.href} {...item} active={isActive(item.href)} />
            ))}
            {!authLoading && isAuthenticated && (
              <SidebarLink
                href="/notifications"
                label="Notifications"
                active={bellActive}
                icon={bellIcon}
                badge={desktopBellBadge}
              />
            )}
            {isAdmin === true && (
              <Link
                href="/admin/metrics"
                aria-current={metricsActive ? "page" : undefined}
                title="Metrics"
                className={`group relative mt-1 flex items-center gap-4 rounded-full px-4 py-2.5 text-[16px] font-medium transition-colors xl:px-5 ${
                  metricsActive
                    ? "bg-amber/15 text-amber"
                    : "text-amber/80 hover:bg-amber/10 hover:text-amber"
                }`}
              >
                <BarChartIcon size={ICON_SIZE} />
                <span className="hidden xl:inline">Metrics</span>
              </Link>
            )}
          </nav>

          <div className="mt-auto pt-4">
            {!authLoading && isAuthenticated ? (
              <Link
                href="/profile"
                aria-label="Profile"
                aria-current={profileActive ? "page" : undefined}
                className={`flex items-center gap-3 rounded-full p-2 transition-colors xl:p-3 ${
                  profileActive ? "bg-surface-hover" : "hover:bg-surface-hover/60"
                }`}
              >
                <Avatar name={personaName || ""} size={32} />
                <span className="hidden min-w-0 flex-1 xl:block">
                  <span className="block truncate text-[14px] font-semibold text-text-primary">
                    {personaName}
                  </span>
                  <span className="block truncate text-[12px] text-text-tertiary">
                    Anonymous
                  </span>
                </span>
              </Link>
            ) : !authLoading ? (
              <Link
                href="/verify"
                className="btn-primary btn-xs flex w-full items-center justify-center px-3"
              >
                <span className="hidden xl:inline">Sign in</span>
                <LoginIcon size={18} className="xl:hidden" />
              </Link>
            ) : null}
          </div>
        </div>
      </aside>

    </>
  );
});

/**
 * Mobile-only admin entry. Sits between the page header and content as a
 * thin sticky bar with a single Metrics button. On desktop, the equivalent
 * link is rendered inside the left sidebar (see Nav above), so this bar
 * is hidden via `md:hidden`.
 *
 * Returns null for non-admins so the link is invisible to regular users.
 */
export function AdminBar() {
  const pathname = usePathname();
  const isAdmin = useIsAdmin();
  if (isAdmin !== true) return null;
  const metricsActive = pathname === "/admin/metrics";
  return (
    <div
      aria-label="Admin tools"
      className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur md:hidden"
    >
      <div className="mx-auto flex w-full max-w-[600px] items-center gap-2 px-4 py-1.5">
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
