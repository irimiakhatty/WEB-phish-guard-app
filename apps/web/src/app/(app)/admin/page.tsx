import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/auth-helpers";
import { getGlobalStats } from "@/server/actions/admin";
import { getAllScans } from "@/server/actions/scans";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Shield,
  Users,
  Building2,
  BarChart3,
  CreditCard,
  DollarSign,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { AdminManagementTabs } from "@/features/admin/components";
import { normalizeAdminTab } from "@/features/admin/components/types";

type AdminPageProps = {
  searchParams?: {
    tab?: string;
  };
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const { user } = await requireAuth();

  if (user.role !== "super_admin") {
    redirect("/dashboard");
  }

  const [stats, scans] = await Promise.all([getGlobalStats(), getAllScans()]);
  const initialTab = normalizeAdminTab(
    typeof searchParams?.tab === "string" ? searchParams.tab : undefined
  );
  const formatCurrency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-7xl space-y-8 px-6 py-10">
        <div className="flex items-center gap-4">
          <div className="rounded-lg bg-gradient-to-br from-yellow-400/20 to-orange-500/20 p-3">
            <Shield className="h-7 w-7 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Super Admin Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Global overview of product usage, subscriptions, and startup economics
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border border-gray-200/80 bg-white/80 backdrop-blur-xl dark:border-gray-800/80 dark:bg-gray-900/80">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-gray-600 dark:text-gray-400">Total Users</CardTitle>
              <Users className="h-4 w-4 text-zinc-700 dark:text-zinc-300" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.totalUsers}</div>
              <p className="mt-1 text-xs text-muted-foreground">+{stats.recentUsers} in last 30 days</p>
            </CardContent>
          </Card>

          <Card className="border border-gray-200/80 bg-white/80 backdrop-blur-xl dark:border-gray-800/80 dark:bg-gray-900/80">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-gray-600 dark:text-gray-400">Organizations</CardTitle>
              <Building2 className="h-4 w-4 text-zinc-700 dark:text-zinc-300" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.totalOrganizations}</div>
              <p className="mt-1 text-xs text-muted-foreground">+{stats.recentOrganizations} in last 30 days</p>
            </CardContent>
          </Card>

          <Card className="border border-gray-200/80 bg-white/80 backdrop-blur-xl dark:border-gray-800/80 dark:bg-gray-900/80">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-gray-600 dark:text-gray-400">Total Scans</CardTitle>
              <BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.totalScans.toLocaleString()}</div>
              <p className="mt-1 text-xs text-muted-foreground">{stats.scansByDay} scans last 7 days</p>
            </CardContent>
          </Card>

          <Card className="border border-gray-200/80 bg-white/80 backdrop-blur-xl dark:border-gray-800/80 dark:bg-gray-900/80">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-gray-600 dark:text-gray-400">Estimated MRR</CardTitle>
              <DollarSign className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                {formatCurrency.format(stats.billing.estimatedMonthlyRevenue)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatCurrency.format(stats.billing.personalMonthlyRevenue)} personal +{" "}
                {formatCurrency.format(stats.billing.teamMonthlyRevenue)} team
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border border-gray-200/80 bg-white/80 backdrop-blur-xl dark:border-gray-800/80 dark:bg-gray-900/80">
          <CardHeader className="pb-3">
            <CardTitle>Startup Economics</CardTitle>
            <CardDescription>
              Revenue estimates are derived from active plan pricing stored in the app.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-gray-200/80 p-4 dark:border-gray-800/80">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">ARR Run Rate</p>
                <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="mt-3 text-2xl font-semibold text-gray-900 dark:text-white">
                {formatCurrency.format(stats.billing.projectedAnnualRevenue)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">12x estimated monthly recurring revenue</p>
            </div>

            <div className="rounded-xl border border-gray-200/80 p-4 dark:border-gray-800/80">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">Paid Plans</p>
                <CreditCard className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="mt-3 text-2xl font-semibold text-gray-900 dark:text-white">
                {stats.activeSubscriptions}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {stats.billing.activePersonalSubscriptions} personal, {stats.billing.activeTeamSubscriptions} team
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Paid coverage: {(stats.billing.paidUserRate * 100).toFixed(0)}% users, {" "}
                {(stats.billing.paidOrganizationRate * 100).toFixed(0)}% orgs
              </p>
            </div>

            <div className="rounded-xl border border-gray-200/80 p-4 dark:border-gray-800/80">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">Revenue At Risk</p>
                <TriangleAlert className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <p className="mt-3 text-2xl font-semibold text-gray-900 dark:text-white">
                {formatCurrency.format(stats.billing.revenueAtRiskMonthly)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {stats.billing.subscriptionsCancelingAtPeriodEnd} subscription
                {stats.billing.subscriptionsCancelingAtPeriodEnd === 1 ? "" : "s"} set to cancel
              </p>
            </div>

            <div className="rounded-xl border border-gray-200/80 p-4 dark:border-gray-800/80">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">ARPA</p>
                <DollarSign className="h-4 w-4 text-zinc-700 dark:text-zinc-300" />
              </div>
              <p className="mt-3 text-2xl font-semibold text-gray-900 dark:text-white">
                {formatCurrency.format(stats.billing.avgRevenuePerPaidSubscription)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Average revenue per paid subscription</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-gray-200/80 bg-white/80 backdrop-blur-xl dark:border-gray-800/80 dark:bg-gray-900/80">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Platform Management</CardTitle>
                <CardDescription className="mt-1">Review and manage everything from one place</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <AdminManagementTabs initialScans={scans} initialTab={initialTab} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}