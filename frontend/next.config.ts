import type { NextConfig } from "next";

/*
 * Security headers applied to every response. Kept intentionally lean:
 *  - X-Frame-Options + frame-ancestors: stop clickjacking (we never embed).
 *  - X-Content-Type-Options: prevent MIME sniffing.
 *  - Referrer-Policy: leak only origin cross-site.
 *  - Permissions-Policy: disable things we don't use (FLoC, camera, mic,
 *    usb, payment). We DO allow geolocation because the live hangout map
 *    relies on it.
 *  - Strict-Transport-Security: only kicks in over HTTPS, so localhost
 *    is unaffected.
 *
 * CSP is deliberately NOT hard-locked in headers: Next.js serves inline
 * styles for hydration and `next/image` wires up blob:/data: URLs; a
 * mis-tuned CSP would break the app. We rely on the strong defaults above
 * plus escaping at render sites instead.
 */
const securityHeaders: { key: string; value: string }[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), usb=(), payment=(), interest-cohort=(), geolocation=(self)",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=15552000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1:3000", "localhost:3000"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lksqqajmawxhunpxoiob.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
