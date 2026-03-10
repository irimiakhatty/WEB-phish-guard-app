"use client";

import { useTransition } from "react";
import { Eye, Mail, Zap } from "lucide-react";
import { toast } from "sonner";

import {
  PERSONAL_PLANS,
  SUBSCRIPTION_PLANS,
  TEAM_PLANS,
  canDowngrade,
  canUpgrade,
  type PlanId,
} from "@/lib/subscription-plans";

import PricingCard from "./pricing-card";

type Props = {
  currentPlanId?: string;
  subscriptionType?: "personal" | "team" | "none";
  mode?: "landing" | "manage";
  visibleCategories?: Array<"personal" | "team">;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEndLabel?: string | null;
  organizationSlug?: string;
  canManageTeamBilling?: boolean;
  canManageCurrentSubscription?: boolean;
  isAuthenticated?: boolean;
};

function getBillingRoute(category: "personal" | "team"): string {
  return category === "team"
    ? "/subscriptions/business"
    : "/subscriptions/personal";
}

function getSignInHref(category: "personal" | "team"): string {
  const account = category === "team" ? "organization" : "personal";
  const next = getBillingRoute(category);
  return `/login?mode=signup&account=${account}&next=${encodeURIComponent(
    next
  )}`;
}

export default function PricingPage({
  currentPlanId,
  subscriptionType = "none",
  mode = "manage",
  visibleCategories = ["personal", "team"],
  cancelAtPeriodEnd = false,
  currentPeriodEndLabel,
  organizationSlug,
  canManageTeamBilling = false,
  canManageCurrentSubscription = true,
  isAuthenticated = true,
}: Props) {
  const [pending, startTransition] = useTransition();
  const activePlanId =
    currentPlanId && currentPlanId in SUBSCRIPTION_PLANS
      ? (currentPlanId as PlanId)
      : undefined;
  const currentPlan = activePlanId ? SUBSCRIPTION_PLANS[activePlanId] : null;
  const hasTeamContext = subscriptionType === "team";
  const hasScheduledDowngrade =
    mode === "manage" &&
    cancelAtPeriodEnd &&
    Boolean(currentPlan && currentPlan.price > 0);
  const canModifyTeamPlans = !hasTeamContext || canManageCurrentSubscription;
  const showPersonalPlans = visibleCategories.includes("personal");
  const showTeamPlans = visibleCategories.includes("team");

  const navigateToBillingEntry = (category: "personal" | "team") => {
    const href = isAuthenticated
      ? getBillingRoute(category)
      : getSignInHref(category);

    window.location.href = href;
  };

  const handleCheckout = (planId: PlanId) => {
    const plan = SUBSCRIPTION_PLANS[planId];
    if (!plan) {
      toast.error("Plan not found.");
      return;
    }

    if (mode === "landing") {
      navigateToBillingEntry(plan.category);
      return;
    }

    if (!isAuthenticated) {
      navigateToBillingEntry(plan.category);
      return;
    }

    if (plan.category === "team") {
      if (!canModifyTeamPlans) {
        toast.error("Only organization admins can modify this team subscription.");
        return;
      }
      if (!organizationSlug) {
        toast.error("Create or select an organization before upgrading.");
        return;
      }
      if (!canManageTeamBilling) {
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
      } else if (data?.message) {
        toast.success(data.message);
        window.location.reload();
      } else {
        toast.error("Could not start the billing flow.");
      }
    });
  };

  const getButtonText = (planId: PlanId) => {
    const plan = SUBSCRIPTION_PLANS[planId];
    const isCurrentPlan = activePlanId === planId;

    if (mode === "landing") {
      if (!isAuthenticated) {
        return "Create account";
      }

      return plan.category === "team" ? "Open business plans" : "Open personal plans";
    }

    if (!isAuthenticated) {
      return "Sign in to continue";
    }
    if (plan.category === "team" && !canModifyTeamPlans) {
      return "Admin only";
    }
    if (isCurrentPlan && hasScheduledDowngrade) {
      return "Keep plan";
    }
    if (isCurrentPlan) {
      return "Current plan";
    }
    if (
      activePlanId &&
      SUBSCRIPTION_PLANS[activePlanId].category === plan.category &&
      canUpgrade(activePlanId, planId)
    ) {
      return "Upgrade";
    }
    if (
      activePlanId &&
      SUBSCRIPTION_PLANS[activePlanId].category === plan.category &&
      canDowngrade(activePlanId, planId)
    ) {
      return "Downgrade";
    }
    return "Change plan";
  };

  const renderPlanCards = (
    plans: Array<(typeof SUBSCRIPTION_PLANS)[PlanId]>,
    highlightedPlanId: PlanId
  ) =>
    plans.map((plan) => {
      const planId = plan.id as PlanId;
      const isCurrentPlan = activePlanId === planId;
      const isResumeAction = isCurrentPlan && hasScheduledDowngrade;
      const teamPlanReadOnly =
        mode === "manage" &&
        plan.category === "team" &&
        !canModifyTeamPlans;

      return (
        <PricingCard
          key={plan.id}
          name={plan.name}
          price={plan.price === 0 ? "Free" : `$${plan.price}`}
          period={plan.price === 0 ? undefined : plan.interval ?? undefined}
          description={plan.description}
          features={[...plan.features.features]}
          highlighted={plan.id === highlightedPlanId}
          badge={plan.id === highlightedPlanId ? "Recommended" : undefined}
          buttonText={getButtonText(planId)}
          disabled={
            pending ||
            teamPlanReadOnly ||
            (mode === "manage" &&
              isAuthenticated &&
              isCurrentPlan &&
              !isResumeAction)
          }
          onSelect={() => handleCheckout(planId)}
        />
      );
    });

  const personalPlans = Object.values(PERSONAL_PLANS);
  const teamPlans = Object.values(TEAM_PLANS);

  return (
    <div className="space-y-12">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-semibold text-gray-900 dark:text-white">
            Choose the plan that fits your needs
          </h2>
          <p className="max-w-2xl text-gray-600 dark:text-gray-400">
            Compare all available plans below. Personal and Team tiers are displayed together so
            you can decide faster.
          </p>
          {hasScheduledDowngrade ? (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {currentPeriodEndLabel
                ? `You switched back to Free, but ${currentPlan?.name ?? "your paid plan"} stays active until ${currentPeriodEndLabel}. After that date, the account moves to Free with no further charges.`
                : `You switched back to Free, but ${currentPlan?.name ?? "your paid plan"} stays active until the current billing period ends. After that, the account moves to Free with no further charges.`}
            </p>
          ) : null}
          {mode === "manage" && !canModifyTeamPlans ? (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              You are a member of this organization. Only organization admins can change team
              billing.
            </p>
          ) : mode === "manage" && hasTeamContext ? (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Your account is currently on a business billing context.
            </p>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-gradient-to-r from-zinc-50 to-white p-6 dark:border-zinc-800 dark:from-zinc-900/60 dark:to-zinc-950/60">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-zinc-900 p-3 dark:bg-zinc-100">
              <Zap className="h-5 w-5 text-white dark:text-zinc-900" />
            </div>
            <div>
              <h4 className="text-zinc-900 dark:text-zinc-100">Real-time protection</h4>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                AI scans links, emails, and attachments instantly.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-zinc-900 p-3 dark:bg-zinc-100">
              <Mail className="h-5 w-5 text-white dark:text-zinc-900" />
            </div>
            <div>
              <h4 className="text-zinc-900 dark:text-zinc-100">Email monitoring</h4>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Protect Gmail and Outlook in-browser with warnings.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-zinc-900 p-3 dark:bg-zinc-100">
              <Eye className="h-5 w-5 text-white dark:text-zinc-900" />
            </div>
            <div>
              <h4 className="text-zinc-900 dark:text-zinc-100">Business intelligence</h4>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Heatmaps, risky users, and ROI-ready reporting.
              </p>
            </div>
          </div>
        </div>
      </div>

      {showPersonalPlans ? (
        <section className="space-y-5">
          <div>
            <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Personal plans
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              For individuals who want browser-level scam protection.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {renderPlanCards(
              personalPlans as Array<(typeof SUBSCRIPTION_PLANS)[PlanId]>,
              "personal_plus"
            )}
          </div>
        </section>
      ) : null}

      {showTeamPlans ? (
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
            {renderPlanCards(
              teamPlans as Array<(typeof SUBSCRIPTION_PLANS)[PlanId]>,
              "team_startup"
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
