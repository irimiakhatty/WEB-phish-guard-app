import { redirect } from "next/navigation";
import { auth } from "@phish-guard-app/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getOrganizationStats } from "@/app/actions/organizations";
import { Building2, Users, Shield, AlertTriangle, CheckCircle, Activity } from "lucide-react";
import prisma from "@phish-guard-app/db";

export default async function OrganizationDashboardPage({ params }: { params: { id: string } }) {
  const session = await auth.api.getSession({
    headers: await import("next/headers").then((m) => m.headers()),
  });

  if (!session || session.user.role !== "admin") {
    redirect("/dashboard");
  }

  const organization = await prisma.organization.findUnique({
    where: { id: params.id },
  });

  if (!organization) {
    redirect("/admin/organizations");
  }

  const stats = await getOrganizationStats(params.id);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{organization.name}</h1>
        <p className="text-muted-foreground">{organization.description || "Organization Dashboard"}</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              of {organization.maxUsers} max capacity
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Scans</CardTitle>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalScans}</div>
            <p className="text-xs text-muted-foreground">
              Across all users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Threats Blocked</CardTitle>
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.totalThreats}</div>
            <p className="text-xs text-muted-foreground">
              Phishing attempts detected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Safe Sites</CardTitle>
            <CheckCircle className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.totalSafeSites}</div>
            <p className="text-xs text-muted-foreground">
              Verified as safe
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Users Activity</CardTitle>
            <CardDescription>Scan activity per user</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.users.map((user) => (
                <div key={user.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center overflow-hidden">
                    {user.image ? (
                      <img src={user.image} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      <Users className="w-5 h-5 text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{user.totalScans}</p>
                    <p className="text-xs text-muted-foreground">scans</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-red-600">{user.threatsBlocked}</p>
                    <p className="text-xs text-muted-foreground">threats</p>
                  </div>
                </div>
              ))}
              {stats.users.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No users in this organization yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Scans */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Scans</CardTitle>
            <CardDescription>Latest scan activity across organization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recentScans.map((scan: any) => (
                <div key={scan.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <Shield className={`w-5 h-5 ${
                    scan.riskLevel === 'safe' ? 'text-green-600' :
                    scan.riskLevel === 'low' ? 'text-blue-600' :
                    scan.riskLevel === 'medium' ? 'text-yellow-600' :
                    scan.riskLevel === 'high' ? 'text-orange-600' :
                    'text-red-600'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{scan.userName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {scan.url || scan.textContent?.substring(0, 50) || 'Image scan'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-bold capitalize ${
                      scan.riskLevel === 'safe' ? 'text-green-600' :
                      scan.riskLevel === 'low' ? 'text-blue-600' :
                      scan.riskLevel === 'medium' ? 'text-yellow-600' :
                      scan.riskLevel === 'high' ? 'text-orange-600' :
                      'text-red-600'
                    }`}>
                      {scan.riskLevel}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(scan.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
              {stats.recentScans.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No scans yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
