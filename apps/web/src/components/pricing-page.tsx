"use client";

import { useTransition } from "react";
import {
  PERSONAL_PLANS,
  TEAM_PLANS,
  SUBSCRIPTION_PLANS,
  type PlanId,
  canUpgrade,
  canDowngrade,
} from "@/lib/subscription-plans";
import { toast } from "sonner";
import PricingCard from "./pricing-card";
import { Mail, Zap, Eye } from "lucide-react";

type Props = {
  currentPlanId: string;
  subscriptionType: "personal" | "team" | "none";
  organizationSlug?: string;
  isOrgAdmin?: boolean;
  isAuthenticated?: boolean;
};

export default function PricingPage({
  currentPlanId,
  subscriptionType,
  organizationSlug,
  isOrgAdmin,
  isAuthenticated = true,
}: Props) {
  const [pending, startTransition] = useTransition();
  const hasTeamContext = subscriptionType === "team";

  const handleCheckout = (planId: PlanId) => {
    if (!isAuthenticated) {
      window.location.href = "/login?next=/subscriptions";
      return;
    }

    const plan = SUBSCRIPTION_PLANS[planId];
    if (!plan || plan.price === 0 || !plan.stripePriceId) {
      toast.info("This plan does not require checkout.");
      return;
    }

    if (plan.category === "team") {
      if (!organizationSlug) {
        toast.error("Create or select an organization before upgrading.");
        return;
      }
      if (!isOrgAdmin) {
        toast.error("Only organization admins can upgrade.");
        return;
      }
    }

    startTransition(async () => {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          organizationSlug: plan.category === "team" ? organizationSlug : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "Checkout failed");
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error("Stripe session missing redirect URL.");
      }
    });
  };

  const getButtonText = (planId: PlanId) => {
    if (!isAuthenticated) {
      return "Sign in to continue";
    }
    if (planId === currentPlanId) {
      return "Current plan";
    }
    if (canUpgrade(currentPlanId as PlanId, planId)) {
      return "Upgrade";
    }
    if (canDowngrade(currentPlanId as PlanId, planId)) {
      return "Downgrade";
    }
    return "Change plan";
  };

  const renderPlanCards = (plans: Array<(typeof SUBSCRIPTION_PLANS)[PlanId]>, highlightedPlanId: PlanId) =>
    plans.map((plan) => (
      <PricingCard
        key={plan.id}
        name={plan.name}
        price={plan.price === 0 ? "Free" : `$${plan.price}`}
        period={plan.price === 0 ? undefined : plan.interval ?? undefined}
        description={plan.description}
        features={[...plan.features.features]}
        highlighted={plan.id === highlightedPlanId}
        badge={plan.id === highlightedPlanId ? "Recommended" : undefined}
        buttonText={getButtonText(plan.id as PlanId)}
        disabled={pending || (isAuthenticated && plan.id === currentPlanId)}
        onSelect={() => handleCheckout(plan.id as PlanId)}
      />
    ));

  const personalPlans = Object.values(PERSONAL_PLANS);
  const teamPlans = Object.values(TEAM_PLANS);

  return (
    <div className="space-y-12">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-semibold text-gray-900 dark:text-white">
            Choose the plan that fits your needs
          </h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl">
            Compare all available plans below. Personal and Team tiers are displayed together so
            you can decide faster.
          </p>
          {hasTeamContext ? (
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Your account is currently on a team context.
            </p>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-start gap-3">
            <div className="bg-blue-600 p-3 rounded-xl">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="text-gray-900 dark:text-white">Real-time protection</h4>
              <p className="text-sm text-gray-600 dark:text-blue-200/80">
                AI scans links, emails, and attachments instantly.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="bg-blue-600 p-3 rounded-xl">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="text-gray-900 dark:text-white">Email monitoring</h4>
              <p className="text-sm text-gray-600 dark:text-blue-200/80">
                Protect Gmail and Outlook in-browser with warnings.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="bg-blue-600 p-3 rounded-xl">
              <Eye className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="text-gray-900 dark:text-white">Business intelligence</h4>
              <p className="text-sm text-gray-600 dark:text-blue-200/80">
                Heatmaps, risky users, and ROI-ready reporting.
              </p>
            </div>
          </div>
        </div>
      </div>

      <section className="space-y-5">
        <div>
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">Personal plans</h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            For individuals who want browser-level scam protection.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {renderPlanCards(personalPlans as Array<(typeof SUBSCRIPTION_PLANS)[PlanId]>, "personal_plus")}
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Teams and organizations
          </h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            For admins who need analytics, member controls, and organization visibility.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {renderPlanCards(teamPlans as Array<(typeof SUBSCRIPTION_PLANS)[PlanId]>, "team_startup")}
        </div>
      </section>
    </div>
  );
}
