"use client";
import Link from "next/link";
import type { Route } from "next";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  Crown,
  LayoutDashboard,
  LogOut,
  Search,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

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
  accent?: "cyan";
};

export function Header() {
  const { data: session } = authClient.useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [planData, setPlanData] = useState<HeaderPlanResponse | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const asideRef = useRef<HTMLElement | null>(null);
  const expandTimeoutRef = useRef<number | null>(null);
  const collapseTimeoutRef = useRef<number | null>(null);
  const userId = session?.user?.id;
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const isSuperAdmin = userRole === "super_admin";
  const isOrgAdmin = userRole === "admin" || planData?.isOrgAdmin === true;
  const hasOrganization = Boolean(planData?.organizationSlug);
  const showOrganizationLink = !isSuperAdmin && (hasOrganization || isOrgAdmin);

  const scheduleExpand = () => {
    if (collapseTimeoutRef.current) {
      window.clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }

    if (expandTimeoutRef.current) {
      window.clearTimeout(expandTimeoutRef.current);
    }

    expandTimeoutRef.current = window.setTimeout(() => {
      setIsExpanded(true);
    }, 90);
  };

  const scheduleCollapse = () => {
    if (expandTimeoutRef.current) {
      window.clearTimeout(expandTimeoutRef.current);
      expandTimeoutRef.current = null;
    }

    if (collapseTimeoutRef.current) {
      window.clearTimeout(collapseTimeoutRef.current);
    }

    collapseTimeoutRef.current = window.setTimeout(() => {
      setIsExpanded(false);
    }, 140);
  };

  const shouldKeepExpandedForFocus = () => {
    const active = document.activeElement;
    return Boolean(active && asideRef.current && asideRef.current.contains(active));
  };

  useEffect(() => {
    return () => {
      if (expandTimeoutRef.current) window.clearTimeout(expandTimeoutRef.current);
      if (collapseTimeoutRef.current) window.clearTimeout(collapseTimeoutRef.current);
    };
  }, []);

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

  const signOutLabel = useMemo(() => {
    const name = session?.user?.name?.trim();
    if (name) return `Sign out ${name}`;
    return "Sign out";
  }, [session?.user?.name]);

  const handleSignOut = () => {
    if (isSigningOut) return;
    setIsSigningOut(true);

    if (typeof window !== "undefined") {
      window.postMessage({ type: "PHISHGUARD_LOGOUT" }, "*");
      setTimeout(() => window.postMessage({ type: "PHISHGUARD_LOGOUT" }, "*"), 100);
    }

    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          setTimeout(() => {
            router.push("/");
          }, 500);
        },
        onError: () => {
          setIsSigningOut(false);
        },
      },
    });
  };

  // Don't show header if user is not logged in
  if (!session?.user) {
    return null;
  }

  const links: HeaderLink[] = isSuperAdmin
    ? [
        { to: "/organizations" as Route, label: "Organizations", icon: Building2 },
        { to: "/analyze" as Route, label: "Analyze", icon: Search },
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
      ? [{ to: "/admin" as Route, label: "Admin", icon: Crown, accent: "cyan" as const }]
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
      <header className="sticky top-0 z-50 border-b border-border bg-background md:hidden">
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
        <div className="border-t border-cyan-400/10 px-4 py-2">
          <div className="mb-2">
            <Badge
              variant="outline"
              className="inline-flex border-cyan-400/15 text-zinc-300"
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
                      "shrink-0 border border-transparent",
                      active
                        ? "border-primary/30 bg-primary/10 text-foreground"
                        : "text-zinc-200 hover:text-zinc-50",
                      accent === "cyan" && !active && "text-cyan-300 hover:text-cyan-200",
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
        ref={asideRef}
        onMouseEnter={scheduleExpand}
        onMouseLeave={() => {
          if (shouldKeepExpandedForFocus()) return;
          scheduleCollapse();
        }}
        onFocus={scheduleExpand}
        onBlur={(event) => {
          const nextFocusTarget = event.relatedTarget as Node | null;
          if (nextFocusTarget && event.currentTarget.contains(nextFocusTarget)) return;
          scheduleCollapse();
        }}
        className={cn(
          "group/side hidden h-svh shrink-0 border-r border-border bg-background",
          "md:sticky md:top-0 md:flex md:flex-col",
          isExpanded ? "md:w-72" : "md:w-[76px]",
          "md:transition-[width] md:duration-500 md:ease-[cubic-bezier(0.16,1,0.3,1)] md:will-change-[width]",
        )}
      >
        <div className="flex h-full flex-col px-4 py-5">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 md:justify-start md:gap-3"
          >
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <Image
                  src="/icon.png"
                  alt="PhishGuard"
                  width={44}
                  height={44}
                  className="h-full w-full object-cover brightness-110 saturate-125"
                  priority
                />
            </div>
            <div
              className={cn(
                "leading-tight whitespace-nowrap",
                isExpanded ? "max-w-[240px] opacity-100 translate-x-0" : "max-w-0 opacity-0 translate-x-1",
                "overflow-hidden",
                "transition-[max-width,opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                isExpanded ? "delay-150" : "delay-0",
              )}
            >
              <div className="font-semibold text-zinc-50">PhishGuard</div>
              <p className="text-xs text-zinc-400">Security Console</p>
            </div>
          </Link>

          <nav className="mt-8 flex flex-1 flex-col gap-1 text-sm">
            {navLinks.map(({ to, label, icon: Icon, accent }) => {
              const active = isActive(to);
              return (
                <Link key={to} href={to} aria-label={label}>
                  <Button
                    variant={active ? "secondary" : "ghost"}
                    className={cn(
                      "h-10 w-full border border-transparent",
                      active
                        ? "border-primary/30 bg-primary/10 text-foreground"
                        : "text-zinc-200 hover:text-zinc-50",
                      "md:justify-start md:gap-2 md:px-3",
                      accent === "cyan" && !active && "text-cyan-300 hover:text-cyan-200",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span
                      className={cn(
                        isExpanded ? "max-w-[220px] opacity-100 translate-x-0" : "max-w-0 opacity-0 translate-x-1",
                        "overflow-hidden",
                        "transition-[max-width,opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                        isExpanded ? "delay-150" : "delay-0",
                      )}
                    >
                      {label}
                    </span>
                  </Button>
                </Link>
              );
            })}
          </nav>

          <div className="space-y-3 pt-6">
            <div
              className={cn(
                "overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                isExpanded ? "max-h-10 opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-1",
              )}
            >
              <Badge variant="outline" className="w-full justify-center border-cyan-400/15 text-zinc-300">
                {`Plan: ${planLabel}`}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="h-10 w-full justify-start gap-2 px-3"
                aria-label={signOutLabel}
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span
                  className={cn(
                    isExpanded ? "max-w-[220px] opacity-100 translate-x-0" : "max-w-0 opacity-0 translate-x-1",
                    "overflow-hidden whitespace-nowrap",
                    "transition-[max-width,opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                    isExpanded ? "delay-150" : "delay-0",
                  )}
                >
                  {signOutLabel}
                </span>
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
