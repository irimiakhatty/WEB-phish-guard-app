import { requireAuth } from "@/lib/auth-helpers";
import { getUserOrganizations } from "../actions/organizations";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, Users, Shield, Calendar, Building2, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { redirect } from "next/navigation";
import { ClickablePlanBadge } from "@/components/clickable-plan-badge";

export default async function OrganizationsPage() {
  const { user } = await requireAuth();
  const organizations = await getUserOrganizations();

  // Non-super admins should only see their organization in settings
  if (user.role !== "super_admin" && organizations.length > 0) {
    redirect(`/org/${organizations[0].slug}`);
  }

  // Calculate statistics for super admin
  const totalMembers = organizations.reduce((sum, org) => sum + org.memberCount, 0);
  const totalScans = organizations.reduce((sum, org) => sum + org.scanCount, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/20 to-purple-50/20 dark:from-gray-950 dark:via-blue-950/20 dark:to-purple-950/20">
      <div className="container mx-auto py-10 px-4 max-w-7xl">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Platform Overview</h1>
          <p className="text-muted-foreground mt-2">
            Manage all organizations and monitor platform statistics
          </p>
        </div>
        <Link href="/organizations/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Create Organization
          </Button>
        </Link>
      </div>

      {/* Statistics Overview for Super Admin */}
      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{organizations.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMembers}</div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Scans</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalScans}</div>
          </CardContent>
        </Card>
      </div>

      {organizations.length === 0 ? (
        <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80">
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No organizations yet</h3>
            <p className="text-muted-foreground mb-4">
              Create an organization to collaborate with your team
            </p>
            <Link href="/organizations/new">
              <Button>Create Your First Organization</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {organizations.map((org) => (
            <Link key={org.id} href={`/org/${org.slug}`}>
              <Card className="hover:shadow-2xl transition-shadow cursor-pointer h-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">{org.name}</CardTitle>
                      <CardDescription className="mt-1">
                        @{org.slug}
                      </CardDescription>
                    </div>
                    <Badge variant={org.role === "admin" || org.role === "Super Admin" ? "default" : "secondary"}>
                      {org.role === "admin" ? (
                        <>
                          <Shield className="w-3 h-3 mr-1" />
                          Org Admin
                        </>
                      ) : org.role === "Super Admin" ? (
                        <>
                          <Shield className="w-3 h-3 mr-1" />
                          Super Admin
                        </>
                      ) : (
                        "Member"
                      )}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Plan</span>
                    <ClickablePlanBadge 
                      plan={org.subscription?.plan || "free"}
                      orgSlug={org.slug}
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center">
                      <Users className="w-4 h-4 mr-1" />
                      Members
                    </span>
                    <span className="font-medium">{org.memberCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Scans</span>
                    <span className="font-medium">{org.scanCount}</span>
                  </div>
                  
                  {/* Admins List */}
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground font-medium flex items-center">
                       <Shield className="w-3 h-3 mr-1" />
                       Admins
                    </span>
                    <div className="flex flex-wrap gap-1">
                        {org.admins?.length > 0 ? org.admins.map((admin: any) => (
                             <span key={admin.id} className="text-xs bg-muted px-2 py-0.5 rounded border">
                                 {admin.name || admin.email}
                             </span>
                        )) : <span className="text-xs text-muted-foreground italic">No admins found</span>}
                    </div>
                  </div>

                  <div className="flex items-center text-xs text-muted-foreground pt-2 border-t">
                    <Calendar className="w-3 h-3 mr-1" />
                    Joined {new Date(org.joinedAt).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
    </div>
  );
}
