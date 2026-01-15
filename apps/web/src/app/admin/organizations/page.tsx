import { redirect } from "next/navigation";
import { auth } from "@phish-guard-app/auth";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Users, Plus } from "lucide-react";
import { getAllOrganizations } from "@/app/actions/organizations";

export default async function OrganizationsPage() {
  const session = await auth.api.getSession({
    headers: await import("next/headers").then((m) => m.headers()),
  });

  if (!session || session.user.role !== "admin") {
    redirect("/dashboard");
  }

  const organizations = await getAllOrganizations();

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Organizations</h1>
          <p className="text-muted-foreground">Manage organizations and their members</p>
        </div>
        <Link href="/admin/organizations/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Organization
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {organizations.map((org) => (
          <Link key={org.id} href={`/admin/organizations/${org.id}`}>
            <Card className="hover:border-blue-500 transition-colors cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="truncate">{org.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {org._count.users} / {org.maxUsers} users
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              {org.description && (
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {org.description}
                  </p>
                </CardContent>
              )}
            </Card>
          </Link>
        ))}

        {organizations.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No organizations yet</h3>
              <p className="text-muted-foreground mb-4">Create your first organization to get started</p>
              <Link href="/admin/organizations/new">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Organization
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
