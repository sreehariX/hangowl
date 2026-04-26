import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { NotificationsProvider } from "@/lib/notifications-context";
import { LocationSharingProvider } from "@/lib/location-sharing-context";
import { Nav, AdminBar } from "@/components/Nav";
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
  title: "HangOwl · Who's free at IIT-B?",
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
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#000000",
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
            <LocationSharingProvider>
              <SWRegister />
              <InstallPrompt />
              <div className="flex min-h-dvh flex-col md:pl-[72px] xl:pl-[260px]">
                <AdminBar />
                <main className="flex-1">{children}</main>
                <Nav />
              </div>
            </LocationSharingProvider>
          </NotificationsProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
