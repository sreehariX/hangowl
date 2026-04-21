"use client";

import { type HTMLAttributes, type ReactNode } from "react";
import { ArrowLeftIcon } from "@/components/icons";

export function Spinner({
  size = 20, className = "", tone = "amber",
}: {
  size?: number;
  className?: string;
  tone?: "amber" | "muted" | "white" | "ink";
}) {
  const colors: Record<string, string> = {
    amber: "#F6BA3D",
    muted: "#797F8B",
    white: "#FFFFFF",
    ink: "#000000",
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

interface ScreenHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  onBack?: () => void;
  backHref?: string;
  trailing?: ReactNode;
  sticky?: boolean;
}

export function ScreenHeader({
  title, subtitle, onBack, trailing, sticky = true,
}: ScreenHeaderProps) {
  return (
    <div className={sticky ? "sticky-bar" : "flex items-center gap-3 px-4 py-3"}>
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
        <div className="truncate text-[17px] font-semibold text-text-primary">
          {title}
        </div>
        {subtitle && <div className="truncate text-caption text-text-tertiary">{subtitle}</div>}
      </div>
      {trailing && <div className="ml-auto flex items-center gap-2">{trailing}</div>}
    </div>
  );
}

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
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover text-text-tertiary">
          {icon}
        </div>
      )}
      <h3 className="text-headline font-semibold text-text-primary">{title}</h3>
      {description && (
        <p className="mt-1 max-w-xs text-body text-text-tertiary">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SectionHeading({
  children, action, className = "",
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

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "hero" | "panel" | "glass";
}

export function Card({ className = "", ...rest }: CardProps) {
  return <div className={`surface-panel ${className}`} {...rest} />;
}
