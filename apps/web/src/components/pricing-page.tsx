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
} from "@/lib/billing/subscription-plans";

import PricingCard from "./pricing-card";

type LandingActionConfig = {
  authenticatedHref?: string;
  authenticatedLabel?: string;
  unauthenticatedHref?: string;
  unauthenticatedLabel?: string;
};

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
  landingActions?: Partial<Record<"personal" | "team", LandingActionConfig>>;
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
  landingActions,
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
  const comparisonDescription =
    showPersonalPlans && showTeamPlans
      ? "Compare personal coverage and team rollout plans in one place, then move into the billing flow that matches your setup."
      : showTeamPlans
        ? "Compare team tiers for rollout, admin control, and shared phishing visibility before you start setup."
        : "Compare personal plans for daily browser protection, higher scan limits, and a faster individual setup.";

  const highlightItems = showTeamPlans && !showPersonalPlans
    ? [
        {
          icon: Zap,
          title: "Fast rollout",
          description: "Start with a small team trial, then upgrade without changing your workflow.",
        },
        {
          icon: Mail,
          title: "Inbox coverage",
          description: "Protect Gmail and Outlook in the browser where users already work.",
        },
        {
          icon: Eye,
          title: "Admin visibility",
          description: "See member activity, shared risk, and plan fit from one billing surface.",
        },
      ]
    : [
        {
          icon: Zap,
          title: "Real-time protection",
          description: "Catch suspicious links and messages before the click.",
        },
        {
          icon: Mail,
          title: "Browser email checks",
          description: "Use Gmail and Outlook with warnings that stay readable and fast.",
        },
        {
          icon: Eye,
          title: "Clear upgrade path",
          description: "Start personal, then add team rollout when you need shared visibility.",
        },
      ];

  const getLandingHref = (category: "personal" | "team") => {
    const action = landingActions?.[category];

    if (isAuthenticated) {
      return action?.authenticatedHref ?? getBillingRoute(category);
    }

    return action?.unauthenticatedHref ?? getSignInHref(category);
  };

  const navigateToBillingEntry = (category: "personal" | "team") => {
    window.location.href = getLandingHref(category);
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
      const action = landingActions?.[plan.category];

      if (!isAuthenticated) {
        return (
          action?.unauthenticatedLabel ??
          (plan.category === "team"
            ? "Create organization"
            : planId === "free"
              ? "Start free"
              : "Create account")
        );
      }

      return (
        action?.authenticatedLabel ??
        (plan.category === "team" ? "Open business billing" : "Open personal billing")
      );
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
      <div className="space-y-6">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-950/55 dark:text-indigo-100/50">
            Plan comparison
          </p>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Choose the protection level that fits
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            {comparisonDescription}
          </p>
          {mode === "landing" && !isAuthenticated ? (
            <p className="text-sm text-indigo-950/75 dark:text-indigo-100/75">
              You can compare every tier first. Account setup only starts when you choose a plan.
            </p>
          ) : null}
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

        <div className="grid gap-4 lg:grid-cols-3">
          {highlightItems.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="rounded-[24px] border border-indigo-200/70 bg-white/78 p-5 shadow-sm shadow-indigo-950/5 backdrop-blur dark:border-indigo-400/18 dark:bg-indigo-950/24"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-indigo-950 p-2.5 shadow-sm shadow-indigo-950/10 dark:bg-indigo-300">
                    <Icon className="h-4 w-4 text-white dark:text-indigo-950" />
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
                    <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showPersonalPlans ? (
        <section className="space-y-5">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-950/55 dark:text-indigo-100/50">
              Personal protection
            </p>
            <h3 className="text-2xl font-semibold tracking-tight text-foreground">
              Plans for individual coverage
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              For people who want browser-level phishing checks, history, and higher scan limits.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {renderPlanCards(
              personalPlans as Array<(typeof SUBSCRIPTION_PLANS)[PlanId]>,
              "personal_plus"
            )}
          </div>
        </section>
      ) : null}

      {showTeamPlans ? (
        <section className="space-y-5">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-950/55 dark:text-indigo-100/50">
              Team rollout
            </p>
            <h3 className="text-2xl font-semibold tracking-tight text-foreground">
              Plans for admins and organizations
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              For teams that need shared visibility, member controls, and a scalable phishing
              protection rollout.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
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
