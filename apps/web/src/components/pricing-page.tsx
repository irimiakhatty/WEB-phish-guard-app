"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "./ui/button";
import { PERSONAL_PLANS, TEAM_PLANS, type PlanId, canUpgrade, canDowngrade } from "@/lib/subscription-plans";
import { toast } from "sonner";
import PricingCard from "./pricing-card";
import { Mail, Zap, Eye } from "lucide-react";

type Props = {
  currentPlanId: string;
  subscriptionType: "personal" | "team" | "none";
  organizationSlug?: string;
  isOrgAdmin?: boolean;
};

export default function PricingPage({ currentPlanId, subscriptionType, organizationSlug, isOrgAdmin }: Props) {
  const [billing, setBilling] = useState<"personal" | "team">(
    subscriptionType === "team" ? "team" : "personal"
  );
  const [pending, startTransition] = useTransition();

  const plans = useMemo(
    () => (billing === "team" ? Object.values(TEAM_PLANS) : Object.values(PERSONAL_PLANS)),
    [billing]
  );
  const highlightedPlanId = billing === "team" ? "team_startup" : "personal_plus";

  const handleCheckout = (planId: PlanId) => {
    const plan = billing === "team" ? TEAM_PLANS[planId as keyof typeof TEAM_PLANS] : PERSONAL_PLANS[planId as keyof typeof PERSONAL_PLANS];
    if (!plan || plan.price === 0 || !plan.stripePriceId) {
      toast.info("This plan does not require checkout.");
      return;
    }

    if (billing === "team") {
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
          organizationSlug: billing === "team" ? organizationSlug : undefined,
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

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-semibold text-gray-900 dark:text-white">
            Choose the plan that fits your team
          </h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl">
            Upgrade to unlock advanced phishing defense, organization analytics, and higher scan limits.
          </p>
        </div>

        <div className="inline-flex w-fit rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-1">
          <Button
            variant={billing === "personal" ? "default" : "ghost"}
            onClick={() => setBilling("personal")}
            className="rounded-full px-6"
          >
            Personal
          </Button>
          <Button
            variant={billing === "team" ? "default" : "ghost"}
            onClick={() => setBilling("team")}
            className="rounded-full px-6"
          >
            Teams and Organizations
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6 rounded-2xl border border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 p-6">
          <div className="flex items-start gap-3">
            <div className="bg-blue-600 p-3 rounded-xl">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="text-gray-900 dark:text-white">Real-time protection</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
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
              <p className="text-sm text-gray-600 dark:text-gray-400">
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
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Heatmaps, risky users, and ROI-ready reporting.
              </p>
            </div>
          </div>
        </div>

        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const priceLabel = plan.price === 0 ? "Free" : `$${plan.price}`;
          const period = plan.price === 0 ? undefined : plan.interval;
          const buttonText = isCurrent
            ? "Current plan"
            : canUpgrade(currentPlanId as any, plan.id as any)
            ? "Upgrade"
            : canDowngrade(currentPlanId as any, plan.id as any)
            ? "Downgrade"
            : "Change plan";

          return (
            <PricingCard
              key={plan.id}
              name={plan.name}
              price={priceLabel}
              period={period}
              description={plan.description}
              features={[...plan.features.features]}
              highlighted={plan.id === highlightedPlanId}
              badge={plan.id === highlightedPlanId ? "Recommended" : undefined}
              buttonText={buttonText}
              disabled={pending || isCurrent}
              onSelect={() => handleCheckout(plan.id as PlanId)}
            />
          );
        })}
      </div>
    </div>
  );
}
