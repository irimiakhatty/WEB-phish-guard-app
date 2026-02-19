"use client";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { Shield } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type HeaderPlanResponse = {
  planId: string;
  planLabel: string;
  status?: string;
};

type HeaderLink = {
  to: Route;
  label: string;
  accent?: "yellow";
};

export function Header() {
  const { data: session } = authClient.useSession();
  const pathname = usePathname();
  const [planData, setPlanData] = useState<HeaderPlanResponse | null>(null);
  const userId = session?.user?.id;
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const isSuperAdmin = userRole === "super_admin";
  const isOrgAdmin = userRole === "admin";

  useEffect(() => {
    if (!userId) {
      setPlanData(null);
      return;
    }

    let mounted = true;

    const loadPlan = async () => {
      try {
        const response = await fetch("/api/user/subscription", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          if (mounted) setPlanData(null);
          return;
        }

        const payload = (await response.json()) as HeaderPlanResponse;
        if (mounted) {
          setPlanData(payload);
        }
      } catch {
        if (mounted) setPlanData(null);
      }
    };

    loadPlan();

    return () => {
      mounted = false;
    };
  }, [userId]);

  const planLabel = useMemo(() => {
    if (isSuperAdmin) return "Super Admin";
    return planData?.planLabel || "Free";
  }, [isSuperAdmin, planData?.planLabel]);

  // Don't show header if user is not logged in
  if (!session?.user) {
    return null;
  }

  const links: HeaderLink[] = isSuperAdmin
    ? [
        { to: "/organizations" as Route, label: "Organizations" },
        { to: "/settings" as Route, label: "Settings" },
      ]
    : [
        { to: "/dashboard" as Route, label: "Dashboard" },
        { to: "/analyze" as Route, label: "Analyze" },
        { to: "/scans" as Route, label: "My Scans" },
        ...(isOrgAdmin ? [{ to: "/organization" as Route, label: "Organization" }] : []),
        { to: "/settings" as Route, label: "Settings" },
      ];

  const navLinks: HeaderLink[] = [
    ...links,
    ...(isSuperAdmin
      ? [{ to: "/admin" as Route, label: "Admin", accent: "yellow" as const }]
      : []),
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
          <Badge
            variant="outline"
            className="inline-flex border-blue-200 text-blue-700 dark:border-blue-700 dark:text-blue-300"
          >
            Plan: {planLabel}
          </Badge>
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
