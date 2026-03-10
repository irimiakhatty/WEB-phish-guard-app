import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getUserOrganizations } from "@/app/actions/organizations";
import PricingPage from "@/components/pricing-page";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth-helpers";
import { getUserBillingSummaries } from "@/lib/billing-helpers";
import { getPlanById, isValidPlan, type PlanId } from "@/lib/subscription-plans";

function formatPeriodEnd(date?: Date | null) {
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

export default async function BusinessSubscriptionsPage() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login?mode=signup&account=organization&next=%2Fsubscriptions%2Fbusiness");
  }

  const isSuperAdmin = session.user.role === "super_admin";
  const billing = await getUserBillingSummaries(session.user.id);
  const organizations = await getUserOrganizations();
  const adminOrganizations = organizations.filter(
    (org) => org.role === "admin" || org.role === "Super Admin"
  );

  if (!isSuperAdmin && !billing.business) {
    redirect("/subscriptions/personal");
  }

  const selectedOrganization =
    adminOrganizations.find((org) => org.slug === billing.business?.organizationSlug) ??
    adminOrganizations[0];

  if (!selectedOrganization) {
    redirect("/subscriptions");
  }

  const teamPlanId = isValidPlan(selectedOrganization.subscription?.plan ?? "")
    ? (selectedOrganization.subscription?.plan as PlanId)
    : "team_free";
  const currentPlan = getPlanById(teamPlanId);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 via-white to-zinc-100/70 text-zinc-900 dark:from-zinc-950 dark:via-zinc-950 dark:to-black dark:text-zinc-100">
      <div className="container mx-auto max-w-7xl space-y-10 px-4 py-10">
        <div className="flex items-center justify-start">
          <Button variant="outline" asChild>
            <Link href="/settings">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>

        <div className="rounded-2xl border border-zinc-200/70 bg-white/90 px-6 py-8 shadow-sm backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/75">
          <h1 className="text-4xl font-semibold text-zinc-900 dark:text-zinc-100">
            Business subscriptions
          </h1>
          <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
            Manage organization billing for {selectedOrganization.name}. Current plan:{" "}
            {currentPlan.name}.
          </p>
        </div>

        <PricingPage
          mode="manage"
          visibleCategories={["team"]}
          currentPlanId={teamPlanId}
          subscriptionType="team"
          cancelAtPeriodEnd={
            Boolean(selectedOrganization.subscription?.cancelAtPeriodEnd) &&
            currentPlan.price > 0
          }
          currentPeriodEndLabel={formatPeriodEnd(selectedOrganization.subscription?.currentPeriodEnd)}
          organizationSlug={selectedOrganization.slug}
          canManageTeamBilling
          canManageCurrentSubscription
          isAuthenticated
        />
      </div>
    </div>
  );
}
