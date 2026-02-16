"use client";

import Link from "next/link";
import { Shield, Activity, CheckCircle, AlertTriangle, Users, Globe } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
  const isSuperAdmin = session.user.role === "super_admin";
  const adminStats = isSuperAdmin ? (stats as AdminStats) : null;
  const isOrgAdmin = Boolean(orgAdminStats);
  const orgMembersHref = orgAdminStats?.organizationSlug
    ? `/org/${orgAdminStats.organizationSlug}/members`
    : "/organizations";
  const subscriptionLabel = subscriptionInfo
    ? subscriptionInfo.planId.replace("team_", "").replace("personal_", "").toUpperCase()
    : "FREE";
  const subscriptionStatus = subscriptionInfo?.status || "active";
  const renewalDate = subscriptionInfo?.currentPeriodEnd
    ? new Date(subscriptionInfo.currentPeriodEnd).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;
  const statsGridClass = isSuperAdmin
    ? "grid grid-cols-1 md:grid-cols-3 gap-6"
    : "grid grid-cols-1 md:grid-cols-4 gap-6";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/20 to-purple-50/20 dark:from-gray-950 dark:via-blue-950/20 dark:to-purple-950/20">
      <div className="container mx-auto max-w-7xl px-4 py-12">
        {/* Welcome Section */}
        <div className="mb-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-3 text-gray-900 dark:text-white">
            Welcome back, {session.user.name}!
            {isSuperAdmin && (
              <span className="ml-3 text-base font-normal text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                Super Admin
              </span>
            )}
          </h1>
          <p className="text-base text-gray-600 dark:text-gray-400">
            {isSuperAdmin 
              ? "Monitor platform activity and manage security."
              : "Monitor your security activity and stay protected."
            }
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <Card className="hover:shadow-2xl transition-shadow bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="bg-blue-600 p-3 rounded-lg">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                Analyze Content
              </CardTitle>
              <CardDescription>
                Check URLs and text for phishing threats
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/analyze">
                <Button className="w-full bg-blue-600 hover:bg-blue-700">
                  Start Analysis
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-2xl transition-shadow bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="bg-green-600 p-3 rounded-lg">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                Recent Activity
              </CardTitle>
              <CardDescription>
                View your scan history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/scans">
                <Button variant="outline" className="w-full">
                  View History
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Stats Overview */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            {isSuperAdmin ? "Platform Statistics" : "Your Statistics"}
          </h2>
        </div>

        <div className={statsGridClass}>
          <Card className="hover:shadow-2xl transition-shadow bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {isSuperAdmin ? "Total Platform Scans" : "Your Scans"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-gray-900 dark:text-white mb-1">
                {stats.totalScans}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                All time
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-2xl transition-shadow bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  Threats {isSuperAdmin ? "Detected" : "Blocked"}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-red-600 mb-1">
                {stats.threatsDetected}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Phishing attempts detected
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-2xl transition-shadow bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Safe {isSuperAdmin ? "Scans" : "Sites"}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-green-600 mb-1">
                {stats.safeScans}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Verified as legitimate
              </p>
            </CardContent>
          </Card>

          {!isSuperAdmin && (
            <Card className="hover:shadow-2xl transition-shadow bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Subscription
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {subscriptionLabel}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                  {subscriptionStatus.replace("_", " ")}
                </p>
                {renewalDate && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Renews on {renewalDate}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Admin-only statistics */}
        {isSuperAdmin && (
          <>
            <div className="mt-12 mb-8">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                User Management
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="hover:shadow-2xl transition-shadow bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-blue-200 dark:border-blue-800">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-600" />
                      Total Users
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-blue-600 mb-1">
                    {adminStats?.totalUsers || 0}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Registered accounts
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-2xl transition-shadow bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-purple-200 dark:border-purple-800">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-purple-600" />
                      Active Today
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-purple-600 mb-1">
                    0
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Users active in 24h
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-2xl transition-shadow bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-orange-200 dark:border-orange-800">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-orange-600" />
                      Detection Rate
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-orange-600 mb-1">
                    {adminStats && adminStats.totalScans > 0 
                      ? Math.round((adminStats.threatsDetected / adminStats.totalScans) * 100)
                      : 0}%
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Threats caught
                  </p>
                </CardContent>
              </Card>
            </div>

              {/* Raport de risc pentru admini */}
              <AdminRiskReport />
          </>
        )}

        {/* Organization Admin BI */}
        {isOrgAdmin && !isSuperAdmin && orgAdminStats && (
          <div className="mt-12">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                  Organization Intelligence
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Actionable insights for {orgAdminStats.organizationName || "your team"}
                </p>
              </div>
              <Link href={orgMembersHref}>
                <Button variant="outline">Members Dashboard</Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <Card className="hover:shadow-2xl transition-shadow bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-red-200 dark:border-red-800">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Threats Blocked This Month
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-red-600 mb-1">
                    {orgAdminStats.threatsThisMonth}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    High-risk events stopped
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-2xl transition-shadow bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-blue-200 dark:border-blue-800">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Emails Analyzed This Month
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-blue-600 mb-1">
                    {orgAdminStats.scansThisMonth}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Activity across the organization
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-2xl transition-shadow bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-green-200 dark:border-green-800">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Most Targeted Employee
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {orgAdminStats.riskyUsers.length > 0 ? (
                    <>
                      <div className="text-lg font-semibold text-gray-900 dark:text-white">
                        {orgAdminStats.riskyUsers[0].name}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {orgAdminStats.riskyUsers[0].email}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        {orgAdminStats.riskyUsers[0].riskyCount} high-risk events
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      No high-risk activity yet
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80">
                <CardHeader>
                  <CardTitle>Attack Type Heatmap</CardTitle>
                  <CardDescription>Most common attack vectors</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {orgAdminStats.attackHeatmap.map((item) => {
                      const maxCount = Math.max(
                        1,
                        ...orgAdminStats.attackHeatmap.map((i) => i.count)
                      );
                      const intensity = item.count / maxCount;
                      const bg = `rgba(239, 68, 68, ${0.15 + 0.55 * intensity})`;
                      return (
                        <div
                          key={item.type}
                          className="rounded-lg border border-gray-200 dark:border-gray-700 p-4"
                          style={{ backgroundColor: bg }}
                        >
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {item.type}
                          </p>
                          <p className="text-xs text-gray-700 dark:text-gray-300">
                            {item.count} incidents
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80">
                <CardHeader>
                  <CardTitle>Risky Users</CardTitle>
                  <CardDescription>Employees who need extra training</CardDescription>
                </CardHeader>
                <CardContent>
                  {orgAdminStats.riskyUsers.length === 0 ? (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      No risky users identified yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {orgAdminStats.riskyUsers.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3"
                        >
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {user.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {user.email}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-red-600">
                              {user.riskyCount}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              high-risk events
                            </p>
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
