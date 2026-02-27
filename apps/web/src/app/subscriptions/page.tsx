import { getSession } from "@/lib/auth-helpers";
import { getUserSubscriptionInfo } from "@/lib/subscription-helpers";
import PricingPage from "@/components/pricing-page";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";

export default async function SubscriptionsPage() {
  const session = await getSession();
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const isSuperAdmin = userRole === "super_admin";
  const backHref = session?.user ? "/settings" : "/";
  const subInfo = session?.user
    ? await getUserSubscriptionInfo(session.user.id)
    : {
        planId: "free",
        subscriptionType: "none" as const,
        organizationSlug: undefined,
        isOrgAdmin: false,
      };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 via-white to-zinc-100/70 text-zinc-900 dark:from-zinc-950 dark:via-zinc-950 dark:to-black dark:text-zinc-100">
      {!session?.user ? (
        <div className="fixed right-4 top-4 z-50">
          <ModeToggle />
        </div>
      ) : null}

      <div className="container mx-auto max-w-7xl px-4 py-10 space-y-10">
        <div className="flex items-center justify-start">
          <Button variant="outline" asChild>
            <Link href={backHref}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>

        <div className="rounded-2xl border border-zinc-200/70 bg-white/90 backdrop-blur-xl px-6 py-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/75">
          <h1 className="text-4xl font-semibold text-zinc-900 dark:text-zinc-100">Subscriptions</h1>
          <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
            {session?.user
              ? "Pick a plan that matches your needs. Stripe checkout runs in test mode for now."
              : "Compare all personal and organization plans. Sign in when you are ready to start checkout."}
          </p>
        </div>

        <PricingPage
          currentPlanId={subInfo.planId}
          subscriptionType={subInfo.subscriptionType}
          organizationSlug={subInfo.organizationSlug}
          canManageTeamBilling={Boolean(subInfo.isOrgAdmin) || isSuperAdmin}
          canManageCurrentSubscription={
            subInfo.subscriptionType !== "team" ||
            Boolean(subInfo.isOrgAdmin) ||
            isSuperAdmin
          }
          isAuthenticated={Boolean(session?.user)}
        />
      </div>
    </div>
  );
}
