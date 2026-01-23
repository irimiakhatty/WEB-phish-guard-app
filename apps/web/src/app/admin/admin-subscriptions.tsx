"use client";

import { useEffect, useState } from "react";
import { getAllSubscriptions } from "../actions/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, User, Building2, Loader2 } from "lucide-react";
import Link from "next/link";

export default function AdminSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const loadSubscriptions = async () => {
    const data = await getAllSubscriptions();
    setSubscriptions(data);
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
        <CardTitle>Subscription Management</CardTitle>
        <CardDescription>View all active paid subscriptions</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="personal">
          <TabsList className="mb-4">
            <TabsTrigger value="personal">
              <User className="w-4 h-4 mr-2" />
              Personal ({subscriptions.personalSubscriptions.length})
            </TabsTrigger>
            <TabsTrigger value="team">
              <Building2 className="w-4 h-4 mr-2" />
              Team ({subscriptions.teamSubscriptions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="space-y-4">
            {subscriptions.personalSubscriptions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No personal subscriptions yet
              </p>
            ) : (
              subscriptions.personalSubscriptions.map((sub: any) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <CreditCard className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                      <p className="font-semibold">{sub.user.name || sub.user.email}</p>
                      <p className="text-sm text-muted-foreground">{sub.user.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="default">{sub.planId}</Badge>
                        <Badge variant={sub.status === "active" ? "default" : "secondary"}>
                          {sub.status}
                        </Badge>
                        {sub.stripeSubscriptionId && (
                          <Badge variant="outline" className="text-xs">
                            Stripe
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>{sub.scansPerMonth} scans/month</p>
                    <p>{sub.maxApiTokens} API tokens</p>
                    {sub.currentPeriodEnd && (
                      <p className="text-xs mt-1">
                        Renews {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="team" className="space-y-4">
            {subscriptions.teamSubscriptions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No team subscriptions yet
              </p>
            ) : (
              subscriptions.teamSubscriptions.map((sub: any) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                      <Building2 className="w-6 h-6 text-purple-500" />
                    </div>
                    <div>
                      <Link
                        href={`/org/${sub.organization.slug}`}
                        className="font-semibold hover:underline"
                      >
                        {sub.organization.name}
                      </Link>
                      <p className="text-sm text-muted-foreground">@{sub.organization.slug}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="default">{sub.planId}</Badge>
                        <Badge variant={sub.status === "active" ? "default" : "secondary"}>
                          {sub.status}
                        </Badge>
                        {sub.stripeSubscriptionId && (
                          <Badge variant="outline" className="text-xs">
                            Stripe
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>{sub.maxMembers} members max</p>
                    <p>{sub.scansPerMonth} scans/month</p>
                    <p>{sub.maxApiTokens} API tokens</p>
                    {sub.currentPeriodEnd && (
                      <p className="text-xs mt-1">
                        Renews {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
