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

      {/* Desktop top nav — premium, centred, compact */}
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
