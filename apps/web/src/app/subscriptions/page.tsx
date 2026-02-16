import { requireAuth } from "@/lib/auth-helpers";
import { getUserSubscriptionInfo } from "@/lib/subscription-helpers";
import PricingPage from "@/components/pricing-page";
import { redirect } from "next/navigation";

export default async function SubscriptionsPage() {
  const session = await requireAuth();

  if (!session?.user) {
    redirect("/login");
  }

  const subInfo = await getUserSubscriptionInfo(session.user.id);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/20 to-purple-50/20 dark:from-gray-950 dark:via-blue-950/20 dark:to-purple-950/20">
      <div className="container mx-auto max-w-6xl px-4 py-12 space-y-10">
        <div className="rounded-2xl border border-blue-200/60 dark:border-blue-900/40 bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl px-6 py-8">
          <h1 className="text-4xl font-semibold text-gray-900 dark:text-white">Subscriptions</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2 max-w-2xl">
            Pick a plan that matches your needs. Stripe checkout runs in test mode for now.
          </p>
        </div>

        <PricingPage
          currentPlanId={subInfo.planId}
          subscriptionType={subInfo.subscriptionType}
          organizationSlug={subInfo.organizationSlug}
          isOrgAdmin={subInfo.isOrgAdmin}
        />
      </div>
    </div>
  );
}
