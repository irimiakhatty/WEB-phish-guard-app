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

  if (user.role !== "super_admin") {
    redirect("/dashboard");
  }

  const stats = await getGlobalStats();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="container mx-auto py-8 px-6 max-w-7xl space-y-8">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-gradient-to-br from-yellow-400/20 to-orange-500/20">
            <Shield className="w-7 h-7 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
              Super Admin Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Global overview of users, organizations, and subscriptions
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="dark:bg-gray-900 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-gray-600 dark:text-gray-400">
                Total Users
              </CardTitle>
              <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                {stats.totalUsers}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                +{stats.recentUsers} in last 30 days
              </p>
            </CardContent>
          </Card>

          <Card className="dark:bg-gray-900 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-gray-600 dark:text-gray-400">
                Organizations
              </CardTitle>
              <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                {stats.totalOrganizations}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                +{stats.recentOrganizations} in last 30 days
              </p>
            </CardContent>
          </Card>

          <Card className="dark:bg-gray-900 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-gray-600 dark:text-gray-400">
                Total Scans
              </CardTitle>
              <BarChart3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                {stats.totalScans.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.scansByDay} scans last 7 days
              </p>
            </CardContent>
          </Card>

          <Card className="dark:bg-gray-900 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-gray-600 dark:text-gray-400">
                Active Subscriptions
              </CardTitle>
              <CreditCard className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                {stats.activeSubscriptions}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Paid plans (Personal + Team)
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="dark:bg-gray-900 dark:border-gray-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Platform Management</CardTitle>
                <CardDescription className="mt-1">
                  Review and manage everything from one place
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="users" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 bg-gray-100 dark:bg-gray-800">
                <TabsTrigger value="users" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700">
                  <Users className="w-4 h-4 mr-2" />
                  Users
                </TabsTrigger>
                <TabsTrigger value="organizations" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700">
                  <Building2 className="w-4 h-4 mr-2" />
                  Organizations
                </TabsTrigger>
                <TabsTrigger value="subscriptions" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Subscriptions
                </TabsTrigger>
                <TabsTrigger value="activity" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700">
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
