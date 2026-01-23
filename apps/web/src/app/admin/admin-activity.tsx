"use client";

import { useEffect, useState } from "react";
import { getRecentActivity } from "../actions/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, UserPlus, Shield, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import Link from "next/link";

export default function AdminActivity() {
  const [activity, setActivity] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivity();
  }, []);

  const loadActivity = async () => {
    const data = await getRecentActivity(50);
    setActivity(data);
    setLoading(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>View recent platform activity and events</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="scans">
          <TabsList className="mb-4">
            <TabsTrigger value="scans">
              <Activity className="w-4 h-4 mr-2" />
              Recent Scans
            </TabsTrigger>
            <TabsTrigger value="users">
              <UserPlus className="w-4 h-4 mr-2" />
              New Users
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scans" className="space-y-3">
            {activity.recentScans.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No recent scans</p>
            ) : (
              activity.recentScans.map((scan: any) => (
                <div
                  key={scan.id}
                  className="flex items-start justify-between p-3 border rounded-lg text-sm"
                >
                  <div className="flex items-start space-x-3">
                    <div className={`p-1.5 rounded-lg ${
                      scan.isPhishing 
                        ? "bg-red-500/10" 
                        : "bg-green-500/10"
                    }`}>
                      {scan.isPhishing ? (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{scan.user.name || scan.user.email}</span>
                        <Badge variant={scan.isPhishing ? "destructive" : "default"} className="text-xs">
                          {scan.isPhishing ? "Phishing" : "Safe"}
                        </Badge>
                        {scan.organization && (
                          <Link href={`/org/${scan.organization.name}`}>
                            <Badge variant="outline" className="text-xs">
                              {scan.organization.name}
                            </Badge>
                          </Link>
                        )}
                      </div>
                      {scan.url && (
                        <p className="text-xs text-muted-foreground mt-1 truncate max-w-md">
                          {scan.url}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(scan.createdAt).toLocaleString()} • {scan.source}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium">
                      {(scan.confidence * 100).toFixed(0)}% confidence
                    </p>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="users" className="space-y-3">
            {activity.recentUsers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No recent users</p>
            ) : (
              activity.recentUsers.map((user: any) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-1.5 bg-blue-500/10 rounded-lg">
                      <UserPlus className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {user.name || "Unnamed User"}
                      </p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
