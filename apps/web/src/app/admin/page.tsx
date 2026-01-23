import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth-helpers";
import { getGlobalStats } from "../actions/admin";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Users, Building2, Activity, CreditCard, BarChart3 } from "lucide-react";
import AdminUsers from "./admin-users";
import AdminOrganizations from "./admin-organizations";
import AdminSubscriptions from "./admin-subscriptions";
import AdminActivity from "./admin-activity";

export default async function AdminPage() {
  const { user } = await requireAuth();

  // Check if user is super admin
  if (user.role !== "admin") {
    redirect("/dashboard");
  }

  const stats = await getGlobalStats();

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <div className="p-3 bg-yellow-500/10 rounded-lg">
            <Shield className="w-8 h-8 text-yellow-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Manage users, organizations, and platform settings
            </p>
          </div>
        </div>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Total Users</CardDescription>
              <Users className="w-4 h-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-3xl">{stats.totalUsers}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              +{stats.recentUsers} in last 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Organizations</CardDescription>
              <Building2 className="w-4 h-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-3xl">{stats.totalOrganizations}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              +{stats.recentOrganizations} in last 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Total Scans</CardDescription>
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-3xl">{stats.totalScans.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {stats.scansByDay} scans last 7 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Active Subscriptions</CardDescription>
              <CreditCard className="w-4 h-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-3xl">{stats.activeSubscriptions}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Paid plans (Personal + Team)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users" className="space-y-6">
        <TabsList>
          <TabsTrigger value="users">
            <Users className="w-4 h-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="organizations">
            <Building2 className="w-4 h-4 mr-2" />
            Organizations
          </TabsTrigger>
          <TabsTrigger value="subscriptions">
            <CreditCard className="w-4 h-4 mr-2" />
            Subscriptions
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Activity className="w-4 h-4 mr-2" />
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <AdminUsers />
        </TabsContent>

        <TabsContent value="organizations">
          <AdminOrganizations />
        </TabsContent>

        <TabsContent value="subscriptions">
          <AdminSubscriptions />
        </TabsContent>

        <TabsContent value="activity">
          <AdminActivity />
        </TabsContent>
      </Tabs>
    </div>
  );
}
