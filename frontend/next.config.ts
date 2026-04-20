import type { NextConfig } from "next";

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
};

export default nextConfig;
