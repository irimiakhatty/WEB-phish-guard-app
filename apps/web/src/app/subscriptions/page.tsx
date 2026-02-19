import { getSession } from "@/lib/auth-helpers";
import { getUserSubscriptionInfo } from "@/lib/subscription-helpers";
import PricingPage from "@/components/pricing-page";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";

export default async function SubscriptionsPage() {
  const session = await getSession();
  const subInfo = session?.user
    ? await getUserSubscriptionInfo(session.user.id)
    : {
        planId: "free",
        subscriptionType: "none" as const,
        organizationSlug: undefined,
        isOrgAdmin: false,
      };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-slate-50 to-blue-100 text-slate-900 dark:from-[#081846] dark:via-[#07163f] dark:to-[#061233] dark:text-slate-100">
      <div className="fixed right-4 top-4 z-50">
        <ModeToggle />
      </div>

      <div className="container mx-auto max-w-7xl px-4 py-10 space-y-10">
        <div className="flex items-center justify-start">
          <Button variant="outline" asChild>
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to landing page
            </Link>
          </Button>
        </div>

        <div className="rounded-2xl border border-blue-200/60 bg-white/90 backdrop-blur-xl px-6 py-8 dark:border-blue-700/40 dark:bg-[#08163a]/75">
          <h1 className="text-4xl font-semibold text-gray-900 dark:text-white">Subscriptions</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2 max-w-2xl">
            {session?.user
              ? "Pick a plan that matches your needs. Stripe checkout runs in test mode for now."
              : "Compare all personal and organization plans. Sign in when you are ready to start checkout."}
          </p>
        </div>

        <PricingPage
          currentPlanId={subInfo.planId}
          subscriptionType={subInfo.subscriptionType}
          organizationSlug={subInfo.organizationSlug}
          isOrgAdmin={subInfo.isOrgAdmin}
          isAuthenticated={Boolean(session?.user)}
        />
      </div>
    </div>
  );
}
