import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { NotificationsProvider } from "@/lib/notifications-context";
import { Nav } from "@/components/Nav";
import { SWRegister } from "@/components/SWRegister";
import { InstallPrompt } from "@/components/InstallPrompt";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HangOwl — Who's free at IIT-B?",
  description:
    "Anonymous campus hangout board for IIT Bombay. Find people free right now, drop in on plans, stay private.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.png",
    apple: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "HangOwl",
  },
  other: {
    // Helps mobile browsers pick the right status-bar tint
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#05070D",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="font-sans antialiased">
        <AuthProvider>
          <NotificationsProvider>
            <SWRegister />
            <InstallPrompt />
            <div
              aria-hidden
              className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
            >
              <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl" />
              <div className="absolute right-0 top-24 h-80 w-80 rounded-full bg-amber/10 blur-3xl" />
              <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-brand-600/15 blur-[120px]" />
            </div>
            <div className="flex min-h-dvh flex-col">
              <main className="flex-1">{children}</main>
              <Nav />
            </div>
          </NotificationsProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
