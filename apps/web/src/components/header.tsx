"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield } from "lucide-react";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";
import { Button } from "./ui/button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export function Header() {
  const { data: session } = authClient.useSession();
  const pathname = usePathname();
  
  // Don't show header if user is not logged in
  if (!session?.user) {
    return null;
  }
  
  const isSuperAdmin = session?.user?.role === "super_admin";
  const isOrgAdmin = session?.user?.role === "admin";

  const links = (isSuperAdmin
    ? [
        { to: "/organizations", label: "Organizations" },
        { to: "/settings", label: "Settings" },
      ]
    : [
        { to: "/dashboard", label: "Dashboard" },
        { to: "/analyze", label: "Analyze" },
        { to: "/scans", label: "My Scans" },
        ...(isOrgAdmin ? [{ to: "/organizations", label: "Organizations" }] : []),
        { to: "/settings", label: "Settings" },
      ]) as const;

  const navLinks = [
    ...links,
    ...(isSuperAdmin ? [{ to: "/admin", label: "Admin", accent: "yellow" }] : []),
  ];

  const isActive = (to: string) => {
    if (to === "/") {
      return pathname === "/";
    }
    return pathname === to || pathname.startsWith(`${to}/`);
  };

  return (
    <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 px-6 py-4">
      <div className="max-w-7xl mx-auto flex flex-row items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-2 rounded-lg">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-gray-900 dark:text-white font-semibold leading-tight">PhishGuard</div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Security Console</p>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm">
            {navLinks.map(({ to, label, accent }) => {
              const active = isActive(to);
              return (
                <Link key={to} href={to}>
                  <Button
                    variant={active ? "secondary" : "ghost"}
                    size="sm"
                    className={cn(
                      "dark:text-gray-300",
                      accent === "yellow" && !active && "text-yellow-600 dark:text-yellow-500",
                    )}
                  >
                    {label}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
