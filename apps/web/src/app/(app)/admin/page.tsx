import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/auth-helpers";
import { getGlobalStats, getStripeCashReport } from "@/server/actions/admin";
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
  Wallet,
} from "lucide-react";
import { AdminManagementTabs } from "@/features/admin/components";
import { normalizeAdminTab } from "@/features/admin/components/types";

type AdminPageProps = {
  searchParams?: {
    tab?: string;
  };
};

function formatPercentDelta(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "No month-over-month baseline yet";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(0)}% vs last month`;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const { user } = await requireAuth();

  if (user.role !== "super_admin") {
    redirect("/dashboard");
  }

  const [stats, scans, stripeCash] = await Promise.all([
    getGlobalStats(),
    getAllScans(),
    getStripeCashReport(),
  ]);
  const initialTab = normalizeAdminTab(
    typeof searchParams?.tab === "string" ? searchParams.tab : undefined
  );
  const formatCurrency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: stripeCash.currency || "USD",
    maximumFractionDigits: 0,
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-[1680px] space-y-8 px-6 py-10 sm:px-8 lg:px-12">
        <div className="flex items-center gap-4">
          <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
            <Shield className="h-7 w-7 text-yellow-400" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-zinc-100">Super Admin Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Global overview of product usage, subscriptions, and startup economics
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Users</CardTitle>
              <Users className="h-4 w-4 text-zinc-300" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-zinc-100">{stats.totalUsers}</div>
              <p className="mt-1 text-xs text-muted-foreground">+{stats.recentUsers} in last 30 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-muted-foreground">Organizations</CardTitle>
              <Building2 className="h-4 w-4 text-zinc-300" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-zinc-100">{stats.totalOrganizations}</div>
              <p className="mt-1 text-xs text-muted-foreground">+{stats.recentOrganizations} in last 30 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Scans</CardTitle>
              <BarChart3 className="h-4 w-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-zinc-100">{stats.totalScans.toLocaleString()}</div>
              <p className="mt-1 text-xs text-muted-foreground">{stats.scansByDay} scans last 7 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-muted-foreground">Estimated MRR</CardTitle>
              <DollarSign className="h-4 w-4 text-amber-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-zinc-100">
                {formatCurrency.format(stats.billing.estimatedMonthlyRevenue)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatCurrency.format(stats.billing.personalMonthlyRevenue)} personal +{" "}
                {formatCurrency.format(stats.billing.teamMonthlyRevenue)} team
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Stripe Cash</CardTitle>
            <CardDescription>
              {stripeCash.available
                ? "These numbers come directly from Stripe invoices, so they reflect real collected cash instead of plan estimates."
                : stripeCash.note}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stripeCash.available ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Collected This Month</p>
                    <Wallet className="h-4 w-4 text-emerald-400" />
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-zinc-100">
                    {formatCurrency.format(stripeCash.thisMonth.collected)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stripeCash.thisMonth.paidInvoices} paid invoices from {stripeCash.thisMonth.payingCustomers} customer
                    {stripeCash.thisMonth.payingCustomers === 1 ? "" : "s"}
                  </p>
                </div>

                <div className="rounded-xl bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Collected Last Month</p>
                    <CreditCard className="h-4 w-4 text-amber-400" />
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-zinc-100">
                    {formatCurrency.format(stripeCash.lastMonth.collected)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Avg invoice {formatCurrency.format(stripeCash.lastMonth.averageInvoiceValue || 0)}
                  </p>
                </div>

                <div className="rounded-xl bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">MoM Cash Change</p>
                    <TrendingUp className="h-4 w-4 text-sky-400" />
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-zinc-100">
                    {formatPercentDelta(stripeCash.monthOverMonthChange)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Average paid invoice this month {formatCurrency.format(stripeCash.thisMonth.averageInvoiceValue || 0)}
                  </p>
                </div>

                <div className="rounded-xl bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Open Invoice Pipeline</p>
                    <TriangleAlert className="h-4 w-4 text-red-400" />
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-zinc-100">
                    {formatCurrency.format(stripeCash.openPipeline.amountOutstanding)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stripeCash.openPipeline.openInvoices} open invoice
                    {stripeCash.openPipeline.openInvoices === 1 ? "" : "s"} still waiting to be collected
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-4 text-sm text-muted-foreground">
                {stripeCash.error || "Stripe metrics are not available yet."}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Startup Economics</CardTitle>
            <CardDescription>
              Revenue estimates are derived from active plan pricing stored in the app.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">ARR Run Rate</p>
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="mt-3 text-2xl font-semibold text-zinc-100">
                {formatCurrency.format(stats.billing.projectedAnnualRevenue)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">12x estimated monthly recurring revenue</p>
            </div>

            <div className="rounded-xl bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Paid Plans</p>
                <CreditCard className="h-4 w-4 text-amber-400" />
              </div>
              <p className="mt-3 text-2xl font-semibold text-zinc-100">
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

            <div className="rounded-xl bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Revenue At Risk</p>
                <TriangleAlert className="h-4 w-4 text-red-400" />
              </div>
              <p className="mt-3 text-2xl font-semibold text-zinc-100">
                {formatCurrency.format(stats.billing.revenueAtRiskMonthly)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {stats.billing.subscriptionsCancelingAtPeriodEnd} subscription
                {stats.billing.subscriptionsCancelingAtPeriodEnd === 1 ? "" : "s"} set to cancel
              </p>
            </div>

            <div className="rounded-xl bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">ARPA</p>
                <DollarSign className="h-4 w-4 text-zinc-300" />
              </div>
              <p className="mt-3 text-2xl font-semibold text-zinc-100">
                {formatCurrency.format(stats.billing.avgRevenuePerPaidSubscription)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Average revenue per paid subscription</p>
            </div>
          </CardContent>
        </Card>

        <Card>
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
