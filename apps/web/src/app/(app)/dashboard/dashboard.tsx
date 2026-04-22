"use client";

import Link from "next/link";
import type { Route } from "next";
import { Shield, Activity, CheckCircle, AlertTriangle, Users, Globe } from "lucide-react";
import { authClient } from "@/lib/auth/auth-client";
import { getPlanById } from "@/lib/billing/subscription-plans";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import dynamic from "next/dynamic";
const AdminRiskReport = dynamic(() => import("./AdminRiskReport"), { ssr: false });

type UserStats = {
  totalScans: number;
  threatsDetected: number;
  safeScans: number;
};

type AdminStats = {
  totalUsers: number;
  totalScans: number;
  threatsDetected: number;
  safeScans: number;
  recentScans: any[];
  userScansStats: any[];
};

type OrgAdminStats = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  threatsThisMonth: number;
  scansThisMonth: number;
  attackHeatmap: { type: string; count: number }[];
  riskyUsers: { id: string; name: string; email: string; riskyCount: number }[];
};

type SubscriptionInfo = {
  subscriptionType: "personal" | "team" | "none";
  planId: string;
  status?: string;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  personalPlanId?: string;
  personalPlanName?: string;
  personalPlanStatus?: string | null;
  preferredOrganizationPlanId?: string;
  preferredOrganizationPlanName?: string;
  preferredOrganizationPlanStatus?: string | null;
  adminOrganizationPlanId?: string;
  adminOrganizationPlanName?: string;
  adminOrganizationPlanStatus?: string | null;
};

export default function Dashboard({
  session,
  stats,
  orgAdminStats,
  subscriptionInfo,
}: {
  session: typeof authClient.$Infer.Session;
  stats: UserStats | AdminStats;
  orgAdminStats: OrgAdminStats | null;
  subscriptionInfo: SubscriptionInfo | null;
}) {
  const userRole = (session.user as { role?: string }).role;
  const isSuperAdmin = userRole === "super_admin";
  const adminStats = isSuperAdmin ? (stats as AdminStats) : null;
  const isOrgAdmin = Boolean(orgAdminStats);
  const orgMembersHref: Route = orgAdminStats?.organizationSlug
    ? (`/org/${orgAdminStats.organizationSlug}/members` as Route)
    : "/organizations";
  const personalPlanId = subscriptionInfo?.personalPlanId ?? null;
  const personalPlanName =
    subscriptionInfo?.personalPlanName ||
    (personalPlanId ? getPlanById(personalPlanId).name : null);
  const workspacePlanId =
    subscriptionInfo?.adminOrganizationPlanId ??
    subscriptionInfo?.preferredOrganizationPlanId ??
    null;
  const workspacePlanName =
    subscriptionInfo?.adminOrganizationPlanName ||
    subscriptionInfo?.preferredOrganizationPlanName ||
    (workspacePlanId ? getPlanById(workspacePlanId).name : null);
  const hasDistinctWorkspacePlan =
    Boolean(workspacePlanId && personalPlanId && workspacePlanId !== personalPlanId);
  const activePlanName = subscriptionInfo ? getPlanById(subscriptionInfo.planId).name : "Free";
  const subscriptionStatus = hasDistinctWorkspacePlan
    ? subscriptionInfo?.adminOrganizationPlanStatus ??
      subscriptionInfo?.preferredOrganizationPlanStatus ??
      null
    : subscriptionInfo?.status || "active";
  const renewalDate =
    !hasDistinctWorkspacePlan && subscriptionInfo?.currentPeriodEnd
      ? new Date(subscriptionInfo.currentPeriodEnd).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
      : null;
  const threatPercent =
    stats.totalScans > 0
      ? Math.min(100, Math.round((stats.threatsDetected / stats.totalScans) * 100))
      : 0;
  const safePercent =
    stats.totalScans > 0
      ? Math.min(100, Math.round((stats.safeScans / stats.totalScans) * 100))
      : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-[1680px] px-6 py-10 sm:px-8 lg:px-12">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-3 text-gray-900 dark:text-white">
            Welcome back, {session.user.name}!
            {isSuperAdmin && (
              <span className="ml-3 rounded-full bg-zinc-100 px-3 py-1 text-base font-normal text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                Super Admin
              </span>
            )}
          </h1>
          {!isSuperAdmin && subscriptionInfo ? (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {hasDistinctWorkspacePlan && workspacePlanName ? (
                <>
                  <Badge variant="secondary">Workspace: {workspacePlanName}</Badge>
                  {personalPlanName ? (
                    <Badge variant="outline">Personal: {personalPlanName}</Badge>
                  ) : null}
                </>
              ) : (
                <Badge variant="secondary">Plan: {activePlanName}</Badge>
              )}
              {subscriptionStatus ? (
                <Badge variant="outline" className="capitalize">
                  {subscriptionStatus.replace("_", " ")}
                </Badge>
              ) : null}
              {renewalDate ? (
                <span className="text-xs text-muted-foreground">Renews on {renewalDate}</span>
              ) : null}
            </div>
          ) : null}
          <p className="text-base text-gray-600 dark:text-gray-400">
            {isSuperAdmin
              ? "Monitor platform activity and manage security."
              : "Monitor your security activity and stay protected."}
          </p>
        </div>

        <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-12">
          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="rounded-lg bg-primary/15 p-3">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                Analyze Content
              </CardTitle>
              <CardDescription>Check URLs and text for phishing threats</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/analyze">
                <Button className="w-full">Start Analysis</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="rounded-lg bg-emerald-500/15 p-3">
                  <Activity className="h-5 w-5 text-emerald-300" />
                </div>
                Recent Activity
              </CardTitle>
              <CardDescription>View your scan history</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/analyze#history">
                <Button variant="outline" className="w-full">
                  View History
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {isSuperAdmin ? "Platform statistics" : "Your statistics"}
        </p>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-12">
          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {isSuperAdmin ? "Total Platform Scans" : "Your Scans"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-1 text-4xl font-semibold tracking-tight text-foreground">
                {stats.totalScans}
              </div>
              <p className="text-sm text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-200/80" />
                  Threats {isSuperAdmin ? "Detected" : "Blocked"}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-1 text-4xl font-semibold tracking-tight text-foreground">
                {stats.threatsDetected}
              </div>
              <p className="text-sm text-muted-foreground">Phishing attempts detected</p>
              <div className="mt-4 h-1.5 w-full rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-red-400/70"
                  style={{ width: `${threatPercent}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{threatPercent}% of scans flagged</p>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-200/80" />
                  Safe {isSuperAdmin ? "Scans" : "Sites"}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-1 text-4xl font-semibold tracking-tight text-foreground">
                {stats.safeScans}
              </div>
              <p className="text-sm text-muted-foreground">Verified as legitimate</p>
              <div className="mt-4 h-1.5 w-full rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-emerald-400/70"
                  style={{ width: `${safePercent}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{safePercent}% of scans safe</p>
            </CardContent>
          </Card>

        </div>

        {isSuperAdmin && (
          <>
            <div className="mt-12 mb-8">
              <h2 className="text-xl font-semibold mb-4 text-zinc-100">User Management</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-zinc-300" />
                      Total Users
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-zinc-100 mb-1">
                    {adminStats?.totalUsers || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">Registered accounts</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-zinc-300" />
                      Active Today
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-zinc-100 mb-1">0</div>
                  <p className="text-sm text-muted-foreground">Users active in 24h</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-zinc-300" />
                      Detection Rate
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-zinc-100 mb-1">
                    {adminStats && adminStats.totalScans > 0
                      ? Math.round((adminStats.threatsDetected / adminStats.totalScans) * 100)
                      : 0}%
                  </div>
                  <p className="text-sm text-muted-foreground">Threats caught</p>
                </CardContent>
              </Card>
            </div>

            <AdminRiskReport />
          </>
        )}

        {isOrgAdmin && !isSuperAdmin && orgAdminStats && (
          <div className="mt-12">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-zinc-100">
                  Organization Intelligence
                </h2>
                <p className="text-sm text-muted-foreground">
                  Actionable insights for {orgAdminStats.organizationName || "your team"}
                </p>
              </div>
              <Link href={orgMembersHref}>
                <Button variant="outline">Members Dashboard</Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <Card className="bg-red-500/5">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Threats Blocked This Month
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-red-400 mb-1">{orgAdminStats.threatsThisMonth}</div>
                  <p className="text-sm text-muted-foreground">High-risk events stopped</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Emails Analyzed This Month
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-zinc-100 mb-1">{orgAdminStats.scansThisMonth}</div>
                  <p className="text-sm text-muted-foreground">Activity across the organization</p>
                </CardContent>
              </Card>

              <Card className="bg-emerald-500/5">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Most Targeted Employee
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {orgAdminStats.riskyUsers.length > 0 ? (
                    <>
                      <div className="text-lg font-semibold text-zinc-100">
                        {orgAdminStats.riskyUsers[0].name}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {orgAdminStats.riskyUsers[0].email}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {orgAdminStats.riskyUsers[0].riskyCount} high-risk events
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No high-risk activity yet</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle>Attack Type Heatmap</CardTitle>
                  <CardDescription>Most common attack vectors</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {orgAdminStats.attackHeatmap.map((item) => {
                      const maxCount = Math.max(
                        1,
                        ...orgAdminStats.attackHeatmap.map((i) => i.count)
                      );
                      const intensity = item.count / maxCount;
                      const intensityPct = Math.round(intensity * 100);
                      const barWidth = intensityPct === 0 ? 0 : Math.max(4, intensityPct);

                      return (
                        <div
                          key={item.type}
                          className="group relative overflow-hidden rounded-xl bg-muted/30 p-4 transition-colors hover:bg-muted/40"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-foreground">
                                {item.type}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {item.count} incidents
                              </p>
                            </div>
                            <span className="shrink-0 rounded-full bg-muted/50 px-2 py-1 text-[11px] font-semibold text-foreground/80">
                              {intensityPct}%
                            </span>
                          </div>

                          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-violet-400/70 via-indigo-400/60 to-sky-400/55"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Risky Users</CardTitle>
                  <CardDescription>Members with the highest recent exposure</CardDescription>
                </CardHeader>
                <CardContent>
                  {orgAdminStats.riskyUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No risky users identified yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {orgAdminStats.riskyUsers.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between rounded-lg bg-muted/30 px-4 py-3"
                        >
                          <div>
                            <p className="font-semibold text-zinc-100">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-red-400">{user.riskyCount}</p>
                            <p className="text-xs text-muted-foreground">high-risk events</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
