import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { Nav } from "@/components/Nav";
import { SWRegister } from "@/components/SWRegister";
import { InstallPrompt } from "@/components/InstallPrompt";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "HangOwl - Who's free at IIT-B?",
  description:
    "Hyperlocal campus hangout board. See who's free, make plans, stay anonymous.",
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
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#1A1A2E",
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
          <SWRegister />
          <InstallPrompt />
          <div className="flex min-h-dvh flex-col">
            <main className="flex-1">{children}</main>
            <Nav />
          </div>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
