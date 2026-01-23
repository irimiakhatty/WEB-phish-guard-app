"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Users, Shield, AlertTriangle, CheckCircle, Activity, Building2, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function FormattedDate({ date }: { date: Date }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Return a consistent format for SSR
    return <>{new Date(date).toISOString().slice(0, 19).replace('T', ' ')}</>;
  }

  return <>{new Date(date).toLocaleString()}</>;
}

type AdminStats = {
  totalUsers: number;
  totalScans: number;
  threatsDetected: number;
  safeScans: number;
  recentScans: Array<{
    id: string;
    riskLevel: string;
    isPhishing: boolean;
    createdAt: Date;
    user: {
      name: string;
      email: string;
    };
  }>;
  userScansStats: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    _count: {
      scans: number;
    };
    scans: Array<{
      isPhishing: boolean;
      riskLevel: string;
      createdAt: Date;
    }>;
  }>;
};

export default function AdminDashboard({ stats }: { stats: AdminStats }) {
  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Manage users, scans, and monitor platform activity
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Link href="/admin/organizations">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-600" />
                Organizations
              </CardTitle>
              <CardDescription>
                Manage organizations
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/users">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Manage Users
              </CardTitle>
              <CardDescription>
                View and edit user roles
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/scans">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-600" />
                Manage Scans
              </CardTitle>
              <CardDescription>
                Review and moderate scans
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/settings">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-orange-600" />
                Settings
              </CardTitle>
              <CardDescription>
                Platform configuration
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Registered accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Scans
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalScans}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Analyses performed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                Threats Detected
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats.threatsDetected}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Phishing attempts blocked
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                Safe Scans
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.safeScans}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Verified legitimate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Scans</CardTitle>
          <CardDescription>Latest platform activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.recentScans.map((scan) => (
              <div
                key={scan.id}
                className="flex items-center justify-between py-3 border-b last:border-0"
              >
                <div>
                  <p className="font-medium">{scan.user.name}</p>
                  <p className="text-sm text-muted-foreground">{scan.user.email}</p>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                      scan.isPhishing
                        ? "bg-red-100 text-red-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {scan.riskLevel.toUpperCase()}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">
                    <FormattedDate date={scan.createdAt} />
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* User Scan Statistics */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            User Scan Activity
          </CardTitle>
          <CardDescription>Overview of scans performed by each user</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {stats.userScansStats.map((user) => {
              const threats = user.scans.filter((s) => s.isPhishing).length;
              const safe = user.scans.filter((s) => !s.isPhishing).length;
              
              return (
                <div key={user.id} className="border-b pb-4 last:border-0">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold">{user.name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{user._count.scans}</p>
                      <p className="text-xs text-muted-foreground">Total Scans</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="bg-red-50 dark:bg-red-950 p-3 rounded-lg">
                      <p className="text-sm text-muted-foreground">Threats Detected</p>
                      <p className="text-xl font-bold text-red-600">{threats}</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                      <p className="text-sm text-muted-foreground">Safe Scans</p>
                      <p className="text-xl font-bold text-green-600">{safe}</p>
                    </div>
                  </div>
                  
                  {user.scans.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-muted-foreground mb-2">Recent Activity:</p>
                      <div className="flex flex-wrap gap-2">
                        {user.scans.slice(0, 5).map((scan, idx) => (
                          <span
                            key={idx}
                            className={`text-xs px-2 py-1 rounded ${
                              scan.isPhishing
                                ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200"
                                : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200"
                            }`}
                          >
                            {scan.riskLevel}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            
            {stats.userScansStats.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No scan activity yet. Users will appear here once they start scanning.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
