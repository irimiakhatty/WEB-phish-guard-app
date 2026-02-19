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
    icon: [
      { url: "/icon.png", type: "image/png", sizes: "64x64" },
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
    shortcut: ["/favicon.ico"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-50 text-slate-900 dark:bg-[#061233] dark:text-slate-100`}
      >
        <Providers>
          <div className="grid min-h-svh grid-rows-[auto_1fr]">
            <Header />
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
