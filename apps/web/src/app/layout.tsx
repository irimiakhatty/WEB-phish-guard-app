import type { Metadata } from "next";

import { Geist, Geist_Mono } from "next/font/google";

import "../index.css";
import { Header } from "@/components/header";
import Providers from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PhishGuard",
  description: "Advanced phishing detection and protection platform",
  icons: {
    icon: [{ url: "/icon.png", type: "image/png", sizes: "64x64" }],
    shortcut: ["/icon.png"],
    apple: [{ url: "/icon.png", sizes: "64x64", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} relative min-h-svh overflow-x-hidden bg-background text-foreground antialiased`}
      >
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[-2] bg-[radial-gradient(circle_at_top,_rgba(124,58,237,0.12),transparent_60%),radial-gradient(circle_at_bottom_left,_rgba(59,130,246,0.08),transparent_58%),linear-gradient(180deg,rgba(0,0,0,0.86),rgba(0,0,0,1))]"
        />
        <Providers>
          <div className="flex min-h-svh flex-col md:flex-row">
            <Header />
            <main className="min-w-0 flex-1">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
