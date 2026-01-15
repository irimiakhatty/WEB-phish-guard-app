"use client";

import Link from "next/link";
import { Shield, Activity, CheckCircle, AlertTriangle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Dashboard({ session }: { session: typeof authClient.$Infer.Session }) {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {session.user.name}! Monitor your security activity.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              Analyze Content
            </CardTitle>
            <CardDescription>
              Check URLs and text for phishing threats
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/analyze">
              <Button className="w-full">Start Analysis</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-600" />
              Recent Activity
            </CardTitle>
            <CardDescription>
              View your scan history
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">View History</Button>
          </CardContent>
        </Card>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Scans
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">0</div>
            <p className="text-xs text-muted-foreground mt-1">
              All time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                Threats Blocked
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">0</div>
            <p className="text-xs text-muted-foreground mt-1">
              Phishing attempts detected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                Safe Sites
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">0</div>
            <p className="text-xs text-muted-foreground mt-1">
              Verified as legitimate
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
