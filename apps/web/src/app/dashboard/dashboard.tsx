"use client";

import Link from "next/link";
import { Shield, Activity, CheckCircle, AlertTriangle, Users, Globe } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import dynamic from "next/dynamic";
const AdminRiskReport = dynamic(() => import("./AdminRiskReport"), { ssr: false });

type UserStats = {
  totalScans: number;
  threatsDetected: number;
  safeScans: number;
};

type AdminStats = {
  totalUsers: number;
  totalScans: number;
  threatsDetected: number;
  safeScans: number;
  recentScans: any[];
  userScansStats: any[];
};

export default function Dashboard({ 
  session, 
  stats 
}: { 
  session: typeof authClient.$Infer.Session;
  stats: UserStats | AdminStats;
}) {
  const isSuperAdmin = session.user.role === "super_admin";
  const adminStats = isSuperAdmin ? (stats as AdminStats) : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto max-w-7xl px-4 py-12">
        {/* Welcome Section */}
        <div className="mb-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-3 text-gray-900 dark:text-white">
            Welcome back, {session.user.name}!
            {isSuperAdmin && (
              <span className="ml-3 text-base font-normal text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                Super Admin
              </span>
            )}
          </h1>
          <p className="text-base text-gray-600 dark:text-gray-400">
            {isSuperAdmin 
              ? "Monitor platform activity and manage security."
              : "Monitor your security activity and stay protected."
            }
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="bg-blue-600 p-3 rounded-lg">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                Analyze Content
              </CardTitle>
              <CardDescription>
                Check URLs and text for phishing threats
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/analyze">
                <Button className="w-full bg-blue-600 hover:bg-blue-700">
                  Start Analysis
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="bg-green-600 p-3 rounded-lg">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                Recent Activity
              </CardTitle>
              <CardDescription>
                View your scan history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/scans">
                <Button variant="outline" className="w-full">
                  View History
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Stats Overview */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            {isSuperAdmin ? "Platform Statistics" : "Your Statistics"}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {isSuperAdmin ? "Total Platform Scans" : "Your Scans"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-gray-900 dark:text-white mb-1">
                {stats.totalScans}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                All time
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  Threats {isSuperAdmin ? "Detected" : "Blocked"}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-red-600 mb-1">
                {stats.threatsDetected}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Phishing attempts detected
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Safe {isSuperAdmin ? "Scans" : "Sites"}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-green-600 mb-1">
                {stats.safeScans}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Verified as legitimate
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Admin-only statistics */}
        {isSuperAdmin && (
          <>
            <div className="mt-12 mb-8">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                User Management
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="hover:shadow-lg transition-shadow border-blue-200 dark:border-blue-800">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-600" />
                      Total Users
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-blue-600 mb-1">
                    {adminStats?.totalUsers || 0}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Registered accounts
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow border-purple-200 dark:border-purple-800">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-purple-600" />
                      Active Today
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-purple-600 mb-1">
                    0
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Users active in 24h
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow border-orange-200 dark:border-orange-800">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-orange-600" />
                      Detection Rate
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-orange-600 mb-1">
                    {adminStats && adminStats.totalScans > 0 
                      ? Math.round((adminStats.threatsDetected / adminStats.totalScans) * 100)
                      : 0}%
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Threats caught
                  </p>
                </CardContent>
              </Card>
            </div>

              {/* Raport de risc pentru admini */}
              <AdminRiskReport />
          </>
        )}
      </div>
    </div>
  );
}
