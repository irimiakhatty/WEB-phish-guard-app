import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

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

export default async function PersonalSubscriptionsPage() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login?mode=signup&account=personal&next=%2Fsubscriptions%2Fpersonal");
  }

  if (session.user.role === "super_admin") {
    redirect("/subscriptions/business");
  }

  const billing = await getUserBillingSummaries(session.user.id);
  if (billing.business) {
    redirect("/subscriptions/business");
  }

  const personalPlanId = isValidPlan(billing.personal.planId)
    ? (billing.personal.planId as PlanId)
    : "free";
  const currentPlan = getPlanById(personalPlanId);

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
            Personal subscriptions
          </h1>
          <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
            Manage personal billing for your individual account. Current plan: {currentPlan.name}.
          </p>
        </div>

        <PricingPage
          mode="manage"
          visibleCategories={["personal"]}
          currentPlanId={personalPlanId}
          subscriptionType="personal"
          cancelAtPeriodEnd={billing.personal.cancelAtPeriodEnd && currentPlan.price > 0}
          currentPeriodEndLabel={formatPeriodEnd(billing.personal.currentPeriodEnd)}
          isAuthenticated
        />
      </div>
    </div>
  );
}
