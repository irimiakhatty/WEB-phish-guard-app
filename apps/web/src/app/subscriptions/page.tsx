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
    <div className="container mx-auto max-w-6xl py-10 px-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Subscriptions</h1>
        <p className="text-muted-foreground">
          Choose a plan or request more quota. Upgrades for teams require organization admin rights.
        </p>
      </div>

      <PricingPage
        currentPlanId={subInfo.planId}
        subscriptionType={subInfo.subscriptionType}
        organizationSlug={subInfo.organizationSlug}
        isOrgAdmin={subInfo.isOrgAdmin}
      />
    </div>
  );
}
