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
        active ? "text-text-primary" : "text-text-tertiary hover:text-text-primary"
      }`}
    >
      <span className="relative">
        {icon}
        {badge}
      </span>
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
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-black/90 backdrop-blur-xl safe-area-pb"
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
            className={`flex flex-1 items-center justify-center py-2.5 transition-colors ${
              profileActive
                ? "text-text-primary"
                : "text-text-tertiary hover:text-text-primary"
            }`}
          >
            <span
              className={`rounded-full ${profileActive ? "ring-2 ring-amber" : ""}`}
            >
              <Avatar name={personaName || ""} size={ICON_SIZE + 2} />
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
