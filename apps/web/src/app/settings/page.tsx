import { redirect } from "next/navigation";
import { auth } from "@phish-guard-app/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import AvatarUpload from "@/components/avatar-upload";
import { getUserOrganizations } from "@/app/actions/organizations";
import Link from "next/link";
import { Shield, Users, TrendingUp, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ClickablePlanBadge } from "@/components/clickable-plan-badge";

export default async function SettingsPage() {
  const session = await auth.api.getSession({
    headers: await import("next/headers").then((m) => m.headers()),
  });

  if (!session) {
    redirect("/login");
  }

  const organizations = await getUserOrganizations();
  const isSuperAdmin = (session.user as any).role === "admin";

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      <div className="space-y-6">
        {/* Profile Section */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Update your profile picture and personal details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-sm font-medium mb-4">Profile Picture</h3>
              <AvatarUpload currentImageUrl={session.user.image} />
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Email</h3>
              <p className="text-sm text-muted-foreground">{session.user.email}</p>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Account Role</h3>
              <p className="text-sm text-muted-foreground capitalize">
                {(session.user as any).role || "user"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Organizations Section */}
        {!isSuperAdmin && organizations.length > 0 && (
          <div className="space-y-4">
             <h2 className="text-xl font-semibold">My Organizations</h2>
             <div className="grid gap-6">
              {organizations.map((org) => (
                <Link key={org.id} href={`/org/${org.slug}`}>
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-xl">{org.name}</CardTitle>
                          <CardDescription className="mt-1">
                            @{org.slug}
                          </CardDescription>
                        </div>
                        <Badge variant={org.role === "admin" ? "default" : "secondary"}>
                          {org.role === "admin" ? (
                            <>
                              <Shield className="w-3 h-3 mr-1" />
                              Admin
                            </>
                          ) : (
                            "Member"
                          )}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center text-sm">
                          <div className="flex items-center text-muted-foreground">
                            <Users className="w-4 h-4 mr-2" />
                            Members
                          </div>
                          <span className="font-medium">{org.memberCount} / {org.subscription?.maxMembers || 3}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <div className="flex items-center text-muted-foreground">
                            <TrendingUp className="w-4 h-4 mr-2" />
                            Scans
                          </div>
                          <span className="font-medium">{org.scanCount}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <div className="flex items-center text-muted-foreground">
                            <Calendar className="w-4 h-4 mr-2" />
                            Joined
                          </div>
                          <span className="font-medium">
                            {new Date(org.joinedAt).toLocaleDateString()}
                          </span>
                        </div>
                        {org.subscription && (
                          <div className="pt-2">
                             <ClickablePlanBadge
                                 plan={org.subscription.plan || "free"}
                                 orgSlug={org.slug}
                             />
                           </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
             </div>
          </div>
        )}

        {/* Security Section */}
        <Card>
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
  );
}
