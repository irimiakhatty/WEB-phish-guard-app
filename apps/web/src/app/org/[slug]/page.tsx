import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth-helpers";
import { getOrganization } from "@/app/actions/organizations";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Users, CreditCard, Settings2, Shield, ArrowLeft } from "lucide-react";
import Link from "next/link";
import OrganizationMembers from "./organization-members";
import OrganizationSettings from "./organization-settings";
import UpgradePlanForm from "@/components/upgrade-plan";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function OrganizationPage({ params }: PageProps) {
  const { user } = await requireAuth();
  const { slug } = await params;
  
  const organization = await getOrganization(slug);

  if (!organization) {
    notFound();
  }

  const isSuperAdmin = user.role === "super_admin";
  const currentUserMembership = organization.members.find(
    (m) => m.userId === user.id
  );
  const isAdmin = isSuperAdmin || currentUserMembership?.role === "admin";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/20 to-purple-50/20 dark:from-gray-950 dark:via-blue-950/20 dark:to-purple-950/20">
      <div className="container mx-auto py-10 px-4 max-w-7xl">
      <Link href="/organizations">
        <Button variant="ghost" className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Organizations
        </Button>
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Building2 className="w-8 h-8 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">{organization.name}</h1>
                <Badge variant={isAdmin ? "default" : "secondary"}>
                  {isSuperAdmin ? (
                    <>
                      <Shield className="w-3 h-3 mr-1" />
                      Super Admin
                    </>
                  ) : isAdmin ? (
                    <>
                      <Shield className="w-3 h-3 mr-1" />
                      Admin
                    </>
                  ) : (
                    "Member"
                  )}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1">@{organization.slug}</p>
            </div>
          </div>
          {isAdmin && (
            <Link href={`/org/${organization.slug}/members`}>
              <Button variant="outline" className="mt-2">
                <Users className="w-4 h-4 mr-2" />
                Members Dashboard
              </Button>
            </Link>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80">
            <CardHeader className="pb-3">
              <CardDescription>Current Plan</CardDescription>
              <CardTitle className="text-2xl">
                {(organization.subscription?.plan ?? organization.subscription?.planId ?? "team_free")
                  .replace("team_", "")
                  .toUpperCase()}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80">
            <CardHeader className="pb-3">
              <CardDescription>Team Members</CardDescription>
              <CardTitle className="text-2xl">
                {organization.members.length} / {organization.subscription?.maxMembers || 3}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80">
            <CardHeader className="pb-3">
              <CardDescription>Total Scans</CardDescription>
              <CardTitle className="text-2xl">{organization._count.scans}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="members" className="space-y-6">
        <TabsList className="bg-white/80 dark:bg-gray-900/80 border border-gray-200/80 dark:border-gray-800/80">
          <TabsTrigger value="members">
            <Users className="w-4 h-4 mr-2" />
            Members
          </TabsTrigger>
          {isAdmin && (
            <>
              <TabsTrigger value="settings">
                <Settings2 className="w-4 h-4 mr-2" />
                Settings
              </TabsTrigger>
              <TabsTrigger value="billing">
                <CreditCard className="w-4 h-4 mr-2" />
                Billing
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="members">
          <OrganizationMembers
            organization={organization}
            isAdmin={isAdmin}
            currentUserId={user.id}
          />
        </TabsContent>

        {isAdmin && (
          <>
            <TabsContent value="settings">
              <OrganizationSettings organization={organization} />
            </TabsContent>

            <TabsContent value="billing">
              <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80">
                <CardHeader>
                  <CardTitle>Billing & Subscription</CardTitle>
                  <CardDescription>
                    Manage your organization's subscription and billing
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border border-gray-200/70 dark:border-gray-800/70 rounded-lg bg-white/60 dark:bg-gray-900/60">
                      <div>
                        <p className="font-semibold">
                          {(organization.subscription?.plan ?? organization.subscription?.planId ?? "team_free")
                            .replace("team_", "")
                            .toUpperCase()}{" "}
                          Plan
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {organization.subscription?.maxMembers || 3} members, {organization.subscription?.scansPerMonth || 500} scans/month
                        </p>
                      </div>
                      <UpgradePlanForm
                        organizationSlug={organization.slug}
                        currentPlan={organization.subscription?.plan ?? organization.subscription?.planId ?? "team_free"}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Stripe checkout is enabled in test mode. Complete payment to activate the new plan.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
    </div>
  );
}
