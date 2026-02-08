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

  const currentUserMembership = organization.members.find(
    (m) => m.userId === user.id
  );
  const isAdmin = currentUserMembership?.role === "admin";

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
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
                  {isAdmin ? (
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
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Current Plan</CardDescription>
              <CardTitle className="text-2xl">
                {(organization.subscription?.plan ?? organization.subscription?.planId ?? "team_free")
                  .replace("team_", "")
                  .toUpperCase()}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Team Members</CardDescription>
              <CardTitle className="text-2xl">
                {organization.members.length} / {organization.subscription?.maxMembers || 3}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Scans</CardDescription>
              <CardTitle className="text-2xl">{organization._count.scans}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="members" className="space-y-6">
        <TabsList>
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
            currentUserId={(await requireAuth()).user.id}
          />
        </TabsContent>

        {isAdmin && (
          <>
            <TabsContent value="settings">
              <OrganizationSettings organization={organization} />
            </TabsContent>

            <TabsContent value="billing">
              <Card>
                <CardHeader>
                  <CardTitle>Billing & Subscription</CardTitle>
                  <CardDescription>
                    Manage your organization's subscription and billing
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
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
                        organizationId={organization.id}
                        currentPlan={organization.subscription?.plan ?? organization.subscription?.planId ?? "team_free"}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Stripe integration coming soon. You'll be able to upgrade to paid plans and manage billing here.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
