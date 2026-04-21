"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { memo, useEffect, useRef, useState, type ReactNode } from "react";
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

/*
 * Scroll direction hook — nav softens & fades while scrolling down, then
 * restores its opaque state when the user scrolls up. Mimics Twitter/X and
 * Instagram's primary bars on mobile.
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

  return (
    <nav
      aria-label="Primary"
      data-dim={scrolledDown ? "true" : "false"}
      className="nav-bar fixed inset-x-0 bottom-0 z-50 safe-area-pb"
    >
      <div className="mx-auto flex max-w-[600px] items-stretch">
        {BASE_ITEMS.map((item) => (
          <NavButton key={item.href} {...item} active={isActive(item.href)} />
        ))}

        {!authLoading && isAuthenticated && (
          <NavButton
            href="/notifications"
            label="Notifications"
            active={bellActive}
            icon={
              <span className={pulse ? "animate-like-pop" : undefined}>
                <BellIcon size={ICON_SIZE} />
              </span>
            }
            badge={
              badgeLabel ? (
                <span className="absolute -right-2 -top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white">
                  {badgeLabel}
                </span>
              ) : null
            }
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
          <NavButton
            href="/verify"
            label="Sign in"
            active={false}
            icon={<LoginIcon size={ICON_SIZE} />}
          />
        ) : null}
      </div>
    </nav>
  );
});
