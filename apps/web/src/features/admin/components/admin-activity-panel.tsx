"use client";

import { useEffect, useState } from "react";
import { getRecentActivity } from "@/server/actions/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, UserPlus, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import type { AdminActivityData, AdminRecentScan, AdminRecentUser } from "./types";

export default function AdminActivityPanel() {
  const [activity, setActivity] = useState<AdminActivityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadActivity = async () => {
      const data = await getRecentActivity(50);
      setActivity(data);
      setLoading(false);
    };

    void loadActivity();
  }, []);

  if (loading || !activity) {
    return (
      <Card>
        <CardContent className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Track recent scans and newly created accounts.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="scans">
          <TabsList className="mb-4">
            <TabsTrigger value="scans">
              <Activity className="mr-2 h-4 w-4" />
              Recent Scans
            </TabsTrigger>
            <TabsTrigger value="users">
              <UserPlus className="mr-2 h-4 w-4" />
              New Users
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scans" className="space-y-3">
            {activity.recentScans.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No recent scans</p>
            ) : (
              activity.recentScans.map((scan: AdminRecentScan) => (
                <div key={scan.id} className="flex items-start justify-between rounded-lg border p-3 text-sm">
                  <div className="flex items-start space-x-3">
                    <div className={`rounded-lg p-1.5 ${scan.isPhishing ? "bg-red-500/10" : "bg-green-500/10"}`}>
                      {scan.isPhishing ? (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{scan.user.name || scan.user.email}</span>
                        <Badge variant={scan.isPhishing ? "destructive" : "default"} className="text-xs">
                          {scan.isPhishing ? "Phishing" : "Safe"}
                        </Badge>
                        {scan.organization ? (
                          <Link href={`/org/${scan.organization.slug}`}>
                            <Badge variant="outline" className="text-xs">
                              {scan.organization.name}
                            </Badge>
                          </Link>
                        ) : null}
                      </div>
                      {scan.url ? (
                        <p className="mt-1 max-w-md truncate text-xs text-muted-foreground">{scan.url}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(scan.createdAt).toLocaleString()} - {scan.source}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium">{(scan.confidence * 100).toFixed(0)}% confidence</p>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="users" className="space-y-3">
            {activity.recentUsers.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No recent users</p>
            ) : (
              activity.recentUsers.map((user: AdminRecentUser) => (
                <div key={user.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center space-x-3">
                    <div className="rounded-lg bg-zinc-500/10 p-1.5 dark:bg-zinc-400/10">
                      <UserPlus className="h-4 w-4 text-zinc-700 dark:text-zinc-300" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{user.name || "Unnamed User"}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{new Date(user.createdAt).toLocaleDateString()}</p>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}