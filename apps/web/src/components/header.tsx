"use client";
import Link from "next/link";
import { Shield } from "lucide-react";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";
import { Button } from "./ui/button";
import { authClient } from "@/lib/auth-client";

export function Header() {
  const { data: session } = authClient.useSession();
  
  // Don't show header if user is not logged in
  if (!session?.user) {
    return null;
  }
  
  const links = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/analyze", label: "Analyze" },
    { to: "/scans", label: "My Scans" },
    ...(session?.user?.role === "admin" ? [{ to: "/organizations", label: "Organizations" }] : []),
    { to: "/settings", label: "Settings" },
  ] as const;

  return (
    <div className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div className="flex flex-row items-center justify-between px-6 py-4">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="flex items-center gap-3 text-lg font-bold">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-gray-900 dark:text-white">PhishGuard</span>
          </Link>
          <nav className="hidden md:flex gap-1 text-sm">
            {links.map(({ to, label }) => {
              return (
                <Link key={to} href={to}>
                  <Button 
                    variant="ghost" 
                    size="sm"
                  >
                    {label}
                  </Button>
                </Link>
              );
            })}
            {session?.user?.role === "admin" && (
              <Link href="/admin">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-yellow-600 dark:text-yellow-500 font-semibold"
                >
                  <Shield className="w-4 h-4 mr-1" />
                  Admin
                </Button>
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
    </div>
  );
}
