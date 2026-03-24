"use client";

import { useEffect, useState } from "react";
import { getAllSubscriptions } from "@/server/actions/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, User, Building2, Loader2 } from "lucide-react";
import Link from "next/link";
import type { AdminPersonalSubscription, AdminSubscriptionsData, AdminTeamSubscription } from "./types";

export default function AdminSubscriptionsPanel() {
  const [subscriptions, setSubscriptions] = useState<AdminSubscriptionsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSubscriptions = async () => {
      const data = await getAllSubscriptions();
      setSubscriptions(data);
      setLoading(false);
    };

    void loadSubscriptions();
  }, []);

  if (loading || !subscriptions) {
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
        <CardTitle>Subscription Management</CardTitle>
        <CardDescription>Inspect every active paid subscription on the platform.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="personal">
          <TabsList className="mb-4">
            <TabsTrigger value="personal">
              <User className="mr-2 h-4 w-4" />
              Personal ({subscriptions.personalSubscriptions.length})
            </TabsTrigger>
            <TabsTrigger value="team">
              <Building2 className="mr-2 h-4 w-4" />
              Team ({subscriptions.teamSubscriptions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="space-y-4">
            {subscriptions.personalSubscriptions.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No personal subscriptions yet</p>
            ) : (
              subscriptions.personalSubscriptions.map((subscription: AdminPersonalSubscription) => (
                <div key={subscription.id} className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center space-x-4">
                    <div className="rounded-lg bg-zinc-500/10 p-2 dark:bg-zinc-400/10">
                      <CreditCard className="h-6 w-6 text-zinc-700 dark:text-zinc-300" />
                    </div>
                    <div>
                      <p className="font-semibold">{subscription.user.name || subscription.user.email}</p>
                      <p className="text-sm text-muted-foreground">{subscription.user.email}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant="default">{subscription.plan}</Badge>
                        <Badge variant={subscription.status === "active" ? "default" : "secondary"}>
                          {subscription.status}
                        </Badge>
                        {subscription.stripeSubscriptionId ? (
                          <Badge variant="outline" className="text-xs">Stripe</Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>{subscription.scansPerMonth} scans/month</p>
                    <p>{subscription.maxApiTokens} API tokens</p>
                    {subscription.currentPeriodEnd ? (
                      <p className="mt-1 text-xs">
                        Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="team" className="space-y-4">
            {subscriptions.teamSubscriptions.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No team subscriptions yet</p>
            ) : (
              subscriptions.teamSubscriptions.map((subscription: AdminTeamSubscription) => (
                <div key={subscription.id} className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center space-x-4">
                    <div className="rounded-lg bg-zinc-500/10 p-2 dark:bg-zinc-400/10">
                      <Building2 className="h-6 w-6 text-zinc-700 dark:text-zinc-300" />
                    </div>
                    <div>
                      <Link href={`/org/${subscription.organization.slug}`} className="font-semibold hover:underline">
                        {subscription.organization.name}
                      </Link>
                      <p className="text-sm text-muted-foreground">@{subscription.organization.slug}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant="default">{subscription.plan}</Badge>
                        <Badge variant={subscription.status === "active" ? "default" : "secondary"}>
                          {subscription.status}
                        </Badge>
                        {subscription.stripeSubscriptionId ? (
                          <Badge variant="outline" className="text-xs">Stripe</Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>{subscription.maxMembers} members max</p>
                    <p>{subscription.scansPerMonth} scans/month</p>
                    <p>{subscription.maxApiTokens} API tokens</p>
                    {subscription.currentPeriodEnd ? (
                      <p className="mt-1 text-xs">
                        Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                      </p>
                    ) : null}
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