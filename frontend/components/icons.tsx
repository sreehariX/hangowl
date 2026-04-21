"use client";

/**
 * Central icon set: every glyph uses the same 24x24 viewBox, 2px stroke,
 * round caps/joins, and inherits `currentColor`. One source of truth so
 * the UI feels stamped from the same mould.
 */

import { memo, type SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & { size?: number };

const base = (size: number): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
});

function make(name: string, draw: React.ReactNode) {
  const C = ({ size = 20, ...rest }: Props) => (
    <svg {...base(size)} {...rest}>
      {draw}
    </svg>
  );
  C.displayName = name;
  return memo(C);
}

export const HomeIcon = make(
  "HomeIcon",
  <>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
    <path d="M10 21v-6h4v6" />
  </>,
);

export const CompassIcon = make(
  "CompassIcon",
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2.4 5.1-5.1 2.4 2.4-5.1 5.1-2.4Z" />
  </>,
);

export const BellIcon = make(
  "BellIcon",
  <>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </>,
);

export const UserIcon = make(
  "UserIcon",
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </>,
);

export const PlusIcon = make(
  "PlusIcon",
  <>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </>,
);

export const CloseIcon = make(
  "CloseIcon",
  <>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </>,
);

export const ChevronLeftIcon = make(
  "ChevronLeftIcon",
  <path d="m15 18-6-6 6-6" />,
);

export const ChevronRightIcon = make(
  "ChevronRightIcon",
  <path d="m9 18 6-6-6-6" />,
);

export const ChevronUpIcon = make(
  "ChevronUpIcon",
  <path d="m18 15-6-6-6 6" />,
);

export const ChevronDownIcon = make(
  "ChevronDownIcon",
  <path d="m6 9 6 6 6-6" />,
);

export const ArrowLeftIcon = make(
  "ArrowLeftIcon",
  <>
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </>,
);

export const HeartIcon = ({ size = 20, filled, ...rest }: Props & { filled?: boolean }) => (
  <svg {...base(size)} {...rest} fill={filled ? "currentColor" : "none"}>
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  </svg>
);

export const ReplyIcon = make(
  "ReplyIcon",
  <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />,
);

export const ShareIcon = make(
  "ShareIcon",
  <>
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <polyline points="16 6 12 2 8 6" />
    <line x1="12" x2="12" y1="2" y2="15" />
  </>,
);

export const BarChartIcon = make(
  "BarChartIcon",
  <>
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </>,
);

export const ImageIcon = make(
  "ImageIcon",
  <>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  </>,
);

export const DotsIcon = make(
  "DotsIcon",
  <>
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
  </>,
);

export const CalendarIcon = make(
  "CalendarIcon",
  <>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </>,
);

export const UsersIcon = make(
  "UsersIcon",
  <>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </>,
);

export const ClockIcon = make(
  "ClockIcon",
  <>
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15 14" />
  </>,
);

export const MapPinIcon = make(
  "MapPinIcon",
  <>
    <path d="M20 10c0 7-8 13-8 13S4 17 4 10a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </>,
);

export const SparkleIcon = make(
  "SparkleIcon",
  <>
    <path d="M12 3v3" />
    <path d="M12 18v3" />
    <path d="M3 12h3" />
    <path d="M18 12h3" />
    <path d="m5.6 5.6 2.1 2.1" />
    <path d="m16.3 16.3 2.1 2.1" />
    <path d="m5.6 18.4 2.1-2.1" />
    <path d="m16.3 7.7 2.1-2.1" />
  </>,
);

export const CheckIcon = make(
  "CheckIcon",
  <polyline points="20 6 9 17 4 12" />,
);

export const LogoutIcon = make(
  "LogoutIcon",
  <>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" x2="9" y1="12" y2="12" />
  </>,
);

export const LoginIcon = make(
  "LoginIcon",
  <>
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    <polyline points="10 17 15 12 10 7" />
    <line x1="15" x2="3" y1="12" y2="12" />
  </>,
);

export const MailIcon = make(
  "MailIcon",
  <>
    <rect x="2" y="4" width="20" height="16" rx="3" />
    <path d="m3 6 9 7 9-7" />
  </>,
);

export const PhoneIcon = make(
  "PhoneIcon",
  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />,
);

export const LinkedinIcon = ({ size = 20, ...rest }: Props) => (
  <svg {...base(size)} {...rest} fill="currentColor" stroke="none">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

export const SendIcon = make(
  "SendIcon",
  <>
    <path d="M22 2 11 13" />
    <path d="M22 2 15 22 11 13 2 9l20-7Z" />
  </>,
);

export const TrophyIcon = make(
  "TrophyIcon",
  <>
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </>,
);

export const SpinnerIcon = ({ size = 20, ...rest }: Props) => (
  <svg {...base(size)} {...rest} className={`animate-spin ${rest.className ?? ""}`}>
    <circle cx="12" cy="12" r="9" strokeOpacity="0.2" />
    <path d="M21 12a9 9 0 0 0-9-9" />
  </svg>
);

export const ArrowUpIcon = make(
  "ArrowUpIcon",
  <>
    <path d="M12 19V5" />
    <path d="m5 12 7-7 7 7" />
  </>,
);

export const NavigationIcon = make(
  "NavigationIcon",
  <polygon points="3 11 22 2 13 21 11 13 3 11" />,
);

export const MessageCircleIcon = make(
  "MessageCircleIcon",
  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />,
);

export const MapIcon = make(
  "MapIcon",
  <>
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
    <line x1="8" y1="2" x2="8" y2="18" />
    <line x1="16" y1="6" x2="16" y2="22" />
  </>,
);

export const HangoutIcon = make(
  "HangoutIcon",
  <>
    <path d="M12 2a5 5 0 0 1 5 5v2a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5Z" />
    <path d="M4 22a8 8 0 0 1 16 0" />
    <path d="M9 13.5V15" />
    <path d="M15 13.5V15" />
  </>,
);
