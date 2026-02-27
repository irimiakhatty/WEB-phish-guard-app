"use client";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import {
  Building2,
  Crown,
  FileText,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Shield,
  type LucideIcon,
} from "lucide-react";
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
  organizationSlug?: string | null;
  isOrgAdmin?: boolean;
};

type HeaderLink = {
  to: Route;
  label: string;
  icon: LucideIcon;
  accent?: "yellow";
};

export function Header() {
  const { data: session } = authClient.useSession();
  const pathname = usePathname();
  const [planData, setPlanData] = useState<HeaderPlanResponse | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const userId = session?.user?.id;
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const isSuperAdmin = userRole === "super_admin";
  const isOrgAdmin = userRole === "admin" || planData?.isOrgAdmin === true;
  const hasOrganization = Boolean(planData?.organizationSlug);
  const showOrganizationLink = !isSuperAdmin && (hasOrganization || isOrgAdmin);

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
  const compactPlanLabel = useMemo(() => {
    const words = planLabel.trim().split(/\s+/).filter(Boolean);
    if (words.length > 1) {
      return words.map((word) => word[0]).join("").toUpperCase().slice(0, 3);
    }
    return planLabel.slice(0, 3).toUpperCase() || "PLN";
  }, [planLabel]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("pg-sidebar-collapsed");
    if (stored === "1") {
      setIsCollapsed(true);
    }
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("pg-sidebar-collapsed", next ? "1" : "0");
      }
      return next;
    });
  };

  // Don't show header if user is not logged in
  if (!session?.user) {
    return null;
  }

  const links: HeaderLink[] = isSuperAdmin
    ? [
        { to: "/organizations" as Route, label: "Organizations", icon: Building2 },
        { to: "/settings" as Route, label: "Settings", icon: Settings },
      ]
    : [
        { to: "/dashboard" as Route, label: "Dashboard", icon: LayoutDashboard },
        { to: "/analyze" as Route, label: "Analyze", icon: Search },
        { to: "/scans" as Route, label: "My Scans", icon: FileText },
        ...(showOrganizationLink
          ? [{ to: "/organization" as Route, label: "Organization", icon: Building2 }]
          : []),
        { to: "/settings" as Route, label: "Settings", icon: Settings },
      ];

  const navLinks: HeaderLink[] = [
    ...links,
    ...(isSuperAdmin
      ? [{ to: "/admin" as Route, label: "Admin", icon: Crown, accent: "yellow" as const }]
      : []),
  ];

  const isActive = (to: string) => {
    if (to === "/organization") {
      return pathname === "/organization" || pathname.startsWith("/org/");
    }
    if (to === "/") {
      return pathname === "/";
    }
    return pathname === to || pathname.startsWith(`${to}/`);
  };

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/85 backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/80 md:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="rounded-xl bg-zinc-900 p-2 shadow-sm dark:bg-zinc-100">
              <Shield className="h-5 w-5 text-white dark:text-zinc-900" />
            </div>
            <div className="leading-tight">
              <div className="font-semibold text-zinc-900 dark:text-zinc-50">PhishGuard</div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Security Console</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <ModeToggle />
            <UserMenu />
          </div>
        </div>
        <div className="border-t border-zinc-200/80 px-4 py-2 dark:border-zinc-800/80">
          <div className="mb-2">
            <Badge
              variant="outline"
              className="inline-flex border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
            >
              Plan: {planLabel}
            </Badge>
          </div>
          <nav className="flex items-center gap-1 overflow-x-auto pb-1 text-sm">
            {navLinks.map(({ to, label, icon: Icon, accent }) => {
              const active = isActive(to);
              return (
                <Link key={to} href={to}>
                  <Button
                    variant={active ? "secondary" : "ghost"}
                    size="sm"
                    className={cn(
                      "shrink-0 dark:text-zinc-300",
                      accent === "yellow" && !active && "text-yellow-600 dark:text-yellow-500",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <aside
        className={cn(
          "hidden h-svh shrink-0 border-r border-zinc-200/80 bg-white/85 backdrop-blur-xl transition-[width,padding] duration-300 dark:border-zinc-800/80 dark:bg-zinc-950/80 md:sticky md:top-0 md:flex md:flex-col",
          isCollapsed ? "w-20" : "w-72",
        )}
      >
        <div className={cn("flex h-full flex-col", isCollapsed ? "p-3" : "p-5")}>
          <div className={cn("flex", isCollapsed ? "flex-col items-center gap-2" : "items-start justify-between")}>
            <Link
              href="/dashboard"
              className={cn("flex items-center gap-3", isCollapsed && "justify-center")}
              title={isCollapsed ? "PhishGuard" : undefined}
            >
              <div className="rounded-xl bg-zinc-900 p-2.5 shadow-sm dark:bg-zinc-100">
                <Shield className="h-5 w-5 text-white dark:text-zinc-900" />
              </div>
              {!isCollapsed ? (
                <div className="leading-tight">
                  <div className="font-semibold text-zinc-900 dark:text-zinc-50">PhishGuard</div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Security Console</p>
                </div>
              ) : null}
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={toggleSidebar}
              className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              <span className="sr-only">Toggle sidebar</span>
            </Button>
          </div>

          <nav className={cn("flex flex-1 flex-col gap-1 text-sm", isCollapsed ? "mt-6" : "mt-8")}>
            {navLinks.map(({ to, label, icon: Icon, accent }) => {
              const active = isActive(to);
              return (
                <Link key={to} href={to} title={isCollapsed ? label : undefined}>
                  <Button
                    variant={active ? "secondary" : "ghost"}
                    className={cn(
                      "h-10 w-full dark:text-zinc-300",
                      isCollapsed ? "justify-center px-0" : "justify-start px-3",
                      accent === "yellow" && !active && "text-yellow-600 dark:text-yellow-500",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {!isCollapsed ? label : <span className="sr-only">{label}</span>}
                  </Button>
                </Link>
              );
            })}
          </nav>

          <div className={cn("space-y-3 pt-6", isCollapsed && "space-y-2")}>
            <Badge
              variant="outline"
              className="inline-flex w-full justify-center border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
            >
              {isCollapsed ? compactPlanLabel : `Plan: ${planLabel}`}
            </Badge>
            <div className={cn("flex items-center gap-2", isCollapsed && "flex-col")}>
              <ModeToggle />
              <UserMenu compact={isCollapsed} />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
