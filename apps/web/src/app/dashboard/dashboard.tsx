"use client";

import Link from "next/link";
import { Shield, Activity, CheckCircle, AlertTriangle, Sparkles } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Dashboard({ session }: { session: typeof authClient.$Infer.Session }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto max-w-7xl px-4 py-12">
        {/* Welcome Section */}
        <div className="mb-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-3 text-gray-900 dark:text-white">
            Welcome back, {session.user.name}!
          </h1>
          <p className="text-base text-gray-600 dark:text-gray-400">
            Monitor your security activity and stay protected.
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Scans
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-gray-900 dark:text-white mb-1">
                0
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
                  Threats Blocked
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-red-600 mb-1">
                0
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
                  Safe Sites
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-green-600 mb-1">
                0
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Verified as legitimate
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
