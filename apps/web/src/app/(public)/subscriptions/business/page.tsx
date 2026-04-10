import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Building2, ShieldCheck, Users } from "lucide-react";
import type { Route } from "next";

import PricingPage from "@/components/pricing-page";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { getUserOrganizations } from "@/server/actions/organizations";
import { getSession } from "@/lib/auth/auth-helpers";
import { getUserBillingSummaries } from "@/lib/billing/billing-helpers";
import { getPlanById, isValidPlan, type PlanId } from "@/lib/billing/subscription-plans";

const PAGE_SHELL =
  "mx-auto w-full max-w-[1680px] px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20";

const TEAM_HIGHLIGHTS = [
  {
    icon: ShieldCheck,
    title: "Shared phishing visibility",
    description: "Move from individual warnings to organization-wide follow-up and review.",
  },
  {
    icon: Users,
    title: "Admin controls",
    description: "Invite members, manage access, and keep rollout simple as the team grows.",
  },
  {
    icon: Building2,
    title: "Plan for scale",
    description: "Start with a trial team and upgrade cleanly into business or enterprise tiers.",
  },
] as const;

function formatPeriodEnd(date?: Date | null) {
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

type BusinessPageChromeProps = {
  backHref: Route;
  backLabel: string;
  badge: string;
  title: string;
  description: string;
  asideTitle: string;
  asideDescription: string;
  primaryAction?: {
    href: Route;
    label: string;
  };
  secondaryAction?: {
    href: Route;
    label: string;
  };
  showModeToggle?: boolean;
  children: ReactNode;
};

function BusinessPageChrome({
  backHref,
  backLabel,
  badge,
  title,
  description,
  asideTitle,
  asideDescription,
  primaryAction,
  secondaryAction,
  showModeToggle = false,
  children,
}: BusinessPageChromeProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {showModeToggle ? (
        <div className="fixed right-4 top-4 z-50">
          <ModeToggle />
        </div>
      ) : null}

      <main className="pb-14">
        <section className="relative overflow-hidden border-b border-border">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(49,46,129,0.12),transparent_30%),radial-gradient(circle_at_top_right,_rgba(79,70,229,0.16),transparent_42%),linear-gradient(180deg,rgba(238,242,255,0.68),transparent_58%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(129,140,248,0.14),transparent_32%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.16),transparent_42%),linear-gradient(180deg,rgba(17,24,39,0.58),transparent_58%)]" />
          <div className={`${PAGE_SHELL} relative space-y-10 pb-12 pt-10 lg:pb-14 lg:pt-12`}>
            <Button
              variant="outline"
              className="border-indigo-200/80 bg-white/72 text-indigo-950 hover:bg-indigo-50 dark:border-indigo-400/20 dark:bg-indigo-950/28 dark:text-indigo-100 dark:hover:bg-indigo-900/45"
              asChild
            >
              <Link href={backHref}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {backLabel}
              </Link>
            </Button>

            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)] lg:items-start">
              <div className="max-w-3xl space-y-6">
                <p className="inline-flex rounded-full border border-indigo-200/80 bg-white/80 px-4 py-1.5 text-xs font-semibold text-indigo-950 shadow-sm shadow-indigo-950/5 backdrop-blur dark:border-indigo-400/20 dark:bg-indigo-950/40 dark:text-indigo-100">
                  {badge}
                </p>
                <div className="space-y-3">
                  <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                    {title}
                  </h1>
                  <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                    {description}
                  </p>
                </div>

                {primaryAction || secondaryAction ? (
                  <div className="flex flex-wrap items-center gap-3">
                    {primaryAction ? (
                      <Button
                        className="bg-indigo-950 text-white shadow-lg shadow-indigo-950/15 hover:bg-indigo-900 dark:bg-indigo-300 dark:text-indigo-950 dark:hover:bg-indigo-200"
                        asChild
                      >
                        <Link href={primaryAction.href}>{primaryAction.label}</Link>
                      </Button>
                    ) : null}
                    {secondaryAction ? (
                      <Button
                        variant="outline"
                        className="border-indigo-200/80 bg-white/72 text-indigo-950 hover:bg-indigo-50 dark:border-indigo-400/20 dark:bg-indigo-950/28 dark:text-indigo-100 dark:hover:bg-indigo-900/45"
                        asChild
                      >
                        <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="rounded-[28px] border border-indigo-200/70 bg-white/82 p-6 shadow-xl shadow-indigo-950/8 backdrop-blur dark:border-indigo-400/20 dark:bg-zinc-950/82">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-950/55 dark:text-indigo-100/50">
                  What you unlock
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                  {asideTitle}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{asideDescription}</p>

                <div className="mt-6 space-y-4">
                  {TEAM_HIGHLIGHTS.map((item) => {
                    const Icon = item.icon;

                    return (
                      <div
                        key={item.title}
                        className="rounded-[22px] border border-indigo-200/70 bg-indigo-50/45 p-4 dark:border-indigo-400/18 dark:bg-indigo-950/24"
                      >
                        <div className="flex items-start gap-3">
                          <div className="rounded-2xl bg-indigo-950 p-2.5 shadow-sm shadow-indigo-950/10 dark:bg-indigo-300">
                            <Icon className="h-4 w-4 text-white dark:text-indigo-950" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-foreground">{item.title}</p>
                            <p className="text-sm leading-6 text-muted-foreground">
                              {item.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={`${PAGE_SHELL} py-12`}>{children}</section>
      </main>
    </div>
  );
}

export default async function BusinessSubscriptionsPage() {
  const session = await getSession();

  if (!session?.user) {
    return (
      <BusinessPageChrome
        backHref="/"
        backLabel="Back"
        badge="Business plans"
        title="Choose the right rollout plan for your team"
        description="Compare business tiers before you create an organization. You can start with a small trial, then move into higher limits and admin visibility when the team is ready."
        asideTitle="Team billing, without the detour"
        asideDescription="This page stays public so buyers can compare first and only create an account when they are ready to start setup."
        primaryAction={{
          href: "/login?mode=signup&account=organization&next=%2Fsubscriptions%2Fbusiness",
          label: "Create organization",
        }}
        secondaryAction={{ href: "/subscriptions", label: "Compare all plans" }}
        showModeToggle
      >
        <PricingPage
          mode="landing"
          visibleCategories={["team"]}
          isAuthenticated={false}
          landingActions={{
            team: {
              unauthenticatedLabel: "Create organization",
            },
          }}
        />
      </BusinessPageChrome>
    );
  }

  const billing = await getUserBillingSummaries(session.user.id);
  const organizations = await getUserOrganizations();
  const adminOrganizations = organizations.filter(
    (org) => org.role === "admin" || org.role === "Super Admin"
  );
  const selectedOrganization =
    adminOrganizations.find((org) => org.slug === billing.business?.organizationSlug) ??
    adminOrganizations[0];

  if (!selectedOrganization) {
    return (
      <BusinessPageChrome
        backHref="/dashboard"
        backLabel="Back to dashboard"
        badge="Business plans"
        title="Set up your organization before you start billing"
        description="You are signed in, but you do not have an admin organization selected yet. Create one first, then return here to choose the plan that fits your rollout."
        asideTitle="Start with workspace setup"
        asideDescription="Organization billing is tied to a workspace slug, so admins can manage members, invites, and upgrades from one place."
        primaryAction={{ href: "/organizations/new", label: "Create organization" }}
        secondaryAction={{ href: "/subscriptions", label: "Compare all plans" }}
      >
        <PricingPage
          mode="landing"
          visibleCategories={["team"]}
          isAuthenticated
          landingActions={{
            team: {
              authenticatedHref: "/organizations/new",
              authenticatedLabel: "Create organization",
            },
          }}
        />
      </BusinessPageChrome>
    );
  }

  const teamPlanId = isValidPlan(selectedOrganization.subscription?.plan ?? "")
    ? (selectedOrganization.subscription?.plan as PlanId)
    : "team_free";
  const currentPlan = getPlanById(teamPlanId);

  return (
    <BusinessPageChrome
      backHref="/settings"
      backLabel="Back to settings"
      badge="Business billing"
      title={`Manage ${selectedOrganization.name}`}
      description={`Review plan limits, upgrade paths, and renewal timing for ${selectedOrganization.name}. Current plan: ${currentPlan.name}.`}
      asideTitle="Billing stays tied to your workspace"
      asideDescription="Upgrades, downgrades, and renewals apply to the selected organization so admins can keep rollout and billing in sync."
      secondaryAction={{ href: "/organizations/new", label: "Create another organization" }}
    >
      <PricingPage
        mode="manage"
        visibleCategories={["team"]}
        currentPlanId={teamPlanId}
        subscriptionType="team"
        cancelAtPeriodEnd={
          Boolean(selectedOrganization.subscription?.cancelAtPeriodEnd) && currentPlan.price > 0
        }
        currentPeriodEndLabel={formatPeriodEnd(selectedOrganization.subscription?.currentPeriodEnd)}
        organizationSlug={selectedOrganization.slug}
        canManageTeamBilling
        canManageCurrentSubscription
        isAuthenticated
      />
    </BusinessPageChrome>
  );
}
