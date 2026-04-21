"use client";
import Link from "next/link";
import type { Route } from "next";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Building2,
  Crown,
  LayoutDashboard,
  Search,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import UserMenu from "./user-menu";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { authClient } from "@/lib/auth/auth-client";
import { cn } from "@/lib/shared/utils";

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
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/40 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-[1680px] items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <Image
                src="/icon.png"
                alt="PhishGuard"
                width={40}
                height={40}
                className="h-full w-full object-cover brightness-110 saturate-125"
                priority
              />
            </div>
            <div className="leading-tight">
              <div className="font-semibold text-zinc-50">PhishGuard</div>
              <p className="text-xs text-zinc-400">Security Console</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <UserMenu />
          </div>
        </div>
        <div className="border-t border-white/10 px-4 py-2">
          <div className="mb-2">
            <Badge
              variant="outline"
              className="inline-flex border-white/10 text-zinc-300"
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
                      "shrink-0 text-zinc-200",
                      accent === "yellow" && !active && "text-yellow-500",
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
        className="hidden h-svh w-72 shrink-0 border-r border-white/10 bg-black/30 backdrop-blur-xl md:sticky md:top-0 md:flex md:flex-col"
      >
        <div className="flex h-full flex-col p-5">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="relative h-11 w-11 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <Image
                  src="/icon.png"
                  alt="PhishGuard"
                  width={44}
                  height={44}
                  className="h-full w-full object-cover brightness-110 saturate-125"
                  priority
                />
            </div>
            <div className="leading-tight">
              <div className="font-semibold text-zinc-50">PhishGuard</div>
              <p className="text-xs text-zinc-400">Security Console</p>
            </div>
          </Link>

          <nav className="mt-8 flex flex-1 flex-col gap-1 text-sm">
            {navLinks.map(({ to, label, icon: Icon, accent }) => {
              const active = isActive(to);
              return (
                <Link key={to} href={to}>
                  <Button
                    variant={active ? "secondary" : "ghost"}
                    className={cn(
                      "h-10 w-full text-zinc-200",
                      "justify-start px-3",
                      accent === "yellow" && !active && "text-yellow-500",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Button>
                </Link>
              );
            })}
          </nav>

          <div className="space-y-3 pt-6">
            <Badge
              variant="outline"
              className="inline-flex w-full justify-center border-white/10 text-zinc-300"
            >
              {`Plan: ${planLabel}`}
            </Badge>
            <div className="flex items-center gap-2">
              <UserMenu />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
