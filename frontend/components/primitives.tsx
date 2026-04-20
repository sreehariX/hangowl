"use client";

import { type HTMLAttributes, type ReactNode } from "react";
import { ArrowLeftIcon } from "@/components/icons";

/* -------------------------------------------------------------------------- */
/* Spinner                                                                     */
/* -------------------------------------------------------------------------- */

export function Spinner({
  size = 20,
  className = "",
  tone = "amber",
}: {
  size?: number;
  className?: string;
  tone?: "amber" | "muted" | "white" | "ink";
}) {
  const colors: Record<string, string> = {
    amber: "#F6BA3D",
    muted: "#8594B0",
    white: "#FFFFFF",
    ink: "#06080F",
  };
  const c = colors[tone] ?? colors.amber;
  return (
    <span
      className={`inline-block animate-spin rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        borderWidth: 2,
        borderStyle: "solid",
        borderColor: `${c}33`,
        borderTopColor: c,
      }}
      role="status"
      aria-label="Loading"
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Screen header — sticky bar with optional back + trailing action             */
/* -------------------------------------------------------------------------- */

interface ScreenHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  onBack?: () => void;
  backHref?: string;
  trailing?: ReactNode;
  sticky?: boolean;
}

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  trailing,
  sticky = true,
}: ScreenHeaderProps) {
  return (
    <div className={`${sticky ? "sticky-bar" : "flex items-center gap-3 px-4 py-3"}`}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="icon-btn"
          aria-label="Go back"
        >
          <ArrowLeftIcon size={20} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold tracking-tight text-text-primary">
          {title}
        </div>
        {subtitle && <div className="truncate text-caption text-text-tertiary">{subtitle}</div>}
      </div>
      {trailing && <div className="ml-auto flex items-center gap-2">{trailing}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* EmptyState                                                                  */
/* -------------------------------------------------------------------------- */

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className}`}>
      {icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-hover/70 text-text-tertiary">
          {icon}
        </div>
      )}
      <h3 className="text-headline font-semibold text-text-primary">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-xs text-body text-text-tertiary">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Section heading                                                             */
/* -------------------------------------------------------------------------- */

export function SectionHeading({
  children,
  action,
  className = "",
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-3 flex items-center justify-between ${className}`}>
      <h2 className="section-eyebrow">{children}</h2>
      {action}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Card                                                                        */
/* -------------------------------------------------------------------------- */

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "hero" | "panel" | "glass";
}

export function Card({ variant = "panel", className = "", ...rest }: CardProps) {
  const base =
    variant === "hero" ? "surface-hero" : variant === "glass" ? "surface-glass" : "surface-panel";
  return <div className={`${base} ${className}`} {...rest} />;
}
