import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ShieldCheck, Zap, Eye } from "lucide-react";
import { redirect } from "next/navigation";
import type { Route } from "next";

import PricingPage from "@/components/pricing-page";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/auth-helpers";
import { getUserBillingSummaries } from "@/lib/billing/billing-helpers";
import { getPlanById, isValidPlan, type PlanId } from "@/lib/billing/subscription-plans";

const PAGE_SHELL =
  "mx-auto w-full max-w-[1680px] px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20";

const PERSONAL_HIGHLIGHTS = [
  {
    icon: ShieldCheck,
    title: "Daily browser protection",
    description: "See phishing warnings in the browser while reading suspicious messages.",
  },
  {
    icon: Zap,
    title: "Fast personal setup",
    description: "Start with a free tier, then upgrade only when you need more scans and limits.",
  },
  {
    icon: Eye,
    title: "Clear individual history",
    description: "Review scans, verdicts, and risky content without opening a team workspace.",
  },
] as const;

function formatPeriodEnd(date?: Date | null) {
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

type PersonalPageChromeProps = {
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
  children: ReactNode;
};

function PersonalPageChrome({
  backHref,
  backLabel,
  badge,
  title,
  description,
  asideTitle,
  asideDescription,
  primaryAction,
  secondaryAction,
  children,
}: PersonalPageChromeProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="pb-14">
        <section className="border-b border-border bg-background">
          <div className={`${PAGE_SHELL} space-y-10 pb-12 pt-10 lg:pb-14 lg:pt-12`}>
            <Button
              variant="outline"
              className="border-cyan-400/25 bg-background/70 text-foreground hover:bg-cyan-400/10 dark:bg-black/15 dark:text-cyan-100 dark:hover:bg-cyan-400/10"
              asChild
            >
              <Link href={backHref}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {backLabel}
              </Link>
            </Button>

            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)] lg:items-start">
              <div className="max-w-3xl space-y-6">
                <p className="inline-flex rounded-full border border-border bg-muted px-4 py-1.5 text-xs font-semibold text-foreground">
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
                      <Button asChild>
                        <Link href={primaryAction.href}>{primaryAction.label}</Link>
                      </Button>
                    ) : null}
                    {secondaryAction ? (
                      <Button
                        variant="outline"
                        className="border-cyan-400/25 bg-background/70 text-foreground hover:bg-cyan-400/10 dark:bg-black/15 dark:text-cyan-100 dark:hover:bg-cyan-400/10"
                        asChild
                      >
                        <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border border-border bg-card p-6 shadow-none">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-950/55 dark:text-cyan-100/55">
                  Why personal works
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                  {asideTitle}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{asideDescription}</p>

                <div className="mt-6 space-y-4">
                  {PERSONAL_HIGHLIGHTS.map((item) => {
                    const Icon = item.icon;

                    return (
                      <div
                        key={item.title}
                        className="rounded-[22px] border border-cyan-200/70 bg-cyan-50/45 p-4 dark:border-cyan-400/18 dark:bg-black/15"
                      >
                        <div className="flex items-start gap-3">
                          <div className="rounded-2xl bg-cyan-400 p-2.5 shadow-sm shadow-cyan-500/15 dark:bg-cyan-400">
                            <Icon className="h-4 w-4 text-black" />
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

export default async function PersonalSubscriptionsPage() {
  const session = await getSession();

  if (!session?.user) {
    return (
      <PersonalPageChrome
        backHref="/"
        backLabel="Back"
        badge="Personal plans"
        title="Pick the protection level that fits your daily browsing"
        description="Compare personal tiers before you create an account. Start free, then move into higher scan limits and deeper browser coverage when you need more."
        asideTitle="Clean setup for individual use"
        asideDescription="Personal billing keeps the extension, scans, and verdict history tied to your own account without pushing you into a team workspace."
        primaryAction={{
          href: "/login?mode=signup&account=personal&next=%2Fsubscriptions%2Fpersonal",
          label: "Create account",
        }}
        secondaryAction={{ href: "/subscriptions", label: "Compare all plans" }}
      >
        <PricingPage mode="landing" visibleCategories={["personal"]} isAuthenticated={false} />
      </PersonalPageChrome>
    );
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
    <PersonalPageChrome
      backHref="/settings"
      backLabel="Back to settings"
      badge="Personal billing"
      title="Manage your personal protection plan"
      description={`Review scan limits, upgrade paths, and renewal timing for your individual account. Current plan: ${currentPlan.name}.`}
      asideTitle="Everything stays tied to your account"
      asideDescription="Personal billing keeps upgrades and renewals simple when you only need individual protection and scan history."
      secondaryAction={{ href: "/subscriptions/business", label: "View business plans" }}
    >
      <PricingPage
        mode="manage"
        visibleCategories={["personal"]}
        currentPlanId={personalPlanId}
        subscriptionType="personal"
        cancelAtPeriodEnd={billing.personal.cancelAtPeriodEnd && currentPlan.price > 0}
        currentPeriodEndLabel={formatPeriodEnd(billing.personal.currentPeriodEnd)}
        isAuthenticated
      />
    </PersonalPageChrome>
  );
}
