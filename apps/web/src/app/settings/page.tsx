import { redirect } from "next/navigation";
import { auth } from "@phish-guard-app/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import AvatarUpload from "@/components/avatar-upload";
import { getUserOrganizations } from "@/app/actions/organizations";
import { getUserSubscriptionInfo } from "@/lib/subscription-helpers";
import { getPlanById } from "@/lib/subscription-plans";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type SettingsPageProps = {
  searchParams?: {
    billingError?: string;
  };
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const session = await auth.api.getSession({
    headers: await import("next/headers").then((m) => m.headers()),
  });

  if (!session) {
    redirect("/login");
  }

  const organizations = await getUserOrganizations();
  const subInfo = await getUserSubscriptionInfo(session.user.id);
  const currentPlan = getPlanById(subInfo.planId);
  const userRole = (session.user as any).role || "user";
  const isSuperAdmin = userRole === "super_admin";
  const isAnyOrgAdmin = organizations.some((org) => org.role === "admin") || userRole === "admin";
  const isTeamContext = subInfo.subscriptionType === "team";
  const isTeamAdmin = isSuperAdmin || subInfo.isOrgAdmin === true;
  const roleLabel = isSuperAdmin ? "Super Admin" : isAnyOrgAdmin ? "Organization's Admin" : "User";
  const stripePortalHref =
    subInfo.subscriptionType === "team" && subInfo.organizationSlug
      ? `/api/stripe/portal?organizationSlug=${encodeURIComponent(subInfo.organizationSlug)}`
      : "/api/stripe/portal";
  const canChangePlan = !isTeamContext || isTeamAdmin;
  const canOpenStripePortal =
    (subInfo.subscriptionType === "personal" && subInfo.planId !== "free") ||
    (subInfo.subscriptionType === "team" && subInfo.planId !== "team_free" && isTeamAdmin);
  const billingAccessNotice =
    isTeamContext && !isTeamAdmin
      ? "Doar adminul organizatiei poate modifica planul sau billing-ul Stripe pentru acest abonament."
      : undefined;
  const billingError =
    typeof searchParams?.billingError === "string"
      ? searchParams.billingError
      : undefined;

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 via-white to-zinc-100/60 dark:from-zinc-950 dark:via-zinc-950 dark:to-black">
      <div className="container mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your account settings and preferences</p>
        </div>

        <div className="space-y-6">
          <Card className="border border-gray-200/80 bg-white/80 backdrop-blur-xl dark:border-gray-800/80 dark:bg-gray-900/80">
            <CardHeader>
              <CardTitle>Subscription & Billing</CardTitle>
              <CardDescription>
                Upgrade, downgrade, or manage billing anytime. Stripe runs in test mode for development.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {billingError ? (
                <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
                  {billingError}
                </p>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Current plan
                  </p>
                  <p className="mt-1 text-base font-semibold text-gray-900 dark:text-white">
                    {currentPlan.name}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Subscription type
                  </p>
                  <p className="mt-1 text-base font-semibold capitalize text-gray-900 dark:text-white">
                    {subInfo.subscriptionType === "none" ? "personal" : subInfo.subscriptionType}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                {canChangePlan ? (
                  <Button
                    asChild
                    className="bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    <Link href="/subscriptions">Change plan</Link>
                  </Button>
                ) : (
                  <Button
                    disabled
                    className="bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                  >
                    Change plan
                  </Button>
                )}
                {canOpenStripePortal ? (
                  <Button variant="outline" asChild>
                    <a href={stripePortalHref}>Open Stripe billing portal</a>
                  </Button>
                ) : null}
              </div>
              {billingAccessNotice ? (
                <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  {billingAccessNotice}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border border-gray-200/80 bg-white/80 backdrop-blur-xl dark:border-gray-800/80 dark:bg-gray-900/80">
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your profile picture and personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="mb-4 text-sm font-medium">Profile Picture</h3>
                <AvatarUpload currentImageUrl={session.user.image} />
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium">Email</h3>
                <p className="text-sm text-muted-foreground">{session.user.email}</p>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium">Account Role</h3>
                <p className="text-sm capitalize text-muted-foreground">
                  {roleLabel}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200/80 bg-white/80 backdrop-blur-xl dark:border-gray-800/80 dark:bg-gray-900/80">
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>Manage your account security settings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Password</h3>
                <p className="text-sm text-muted-foreground">
                  Last changed: Never (Better-Auth handles password management)
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
