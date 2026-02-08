"use client";

import { useMemo, useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { PERSONAL_PLANS, TEAM_PLANS, type PlanId, canUpgrade, canDowngrade } from "@/lib/subscription-plans";
import { upgradeOrgPlanAction } from "@/app/actions/subscription-upgrade";
import { toast } from "sonner";

type Props = {
  currentPlanId: string;
  subscriptionType: "personal" | "team" | "none";
  organizationSlug?: string;
  isOrgAdmin?: boolean;
};

export default function PricingPage({ currentPlanId, subscriptionType, organizationSlug, isOrgAdmin }: Props) {
  const [billing, setBilling] = useState<"personal" | "team">(
    subscriptionType === "team" ? "team" : "personal"
  );
  const [pending, startTransition] = useTransition();

  const plans = useMemo(() => (billing === "team" ? TEAM_PLANS : PERSONAL_PLANS), [billing]);

  const handleUpgrade = (planId: PlanId) => {
    if (billing === "personal") {
      toast.info("Upgrade/downgrade pentru cont personal va fi disponibil în curând.");
      return;
    }
    if (!organizationSlug) {
      toast.error("Creează sau selectează o organizație pentru a face upgrade.");
      return;
    }
    if (!isOrgAdmin) {
      toast.error("Doar un admin al organizației poate face upgrade.");
      return;
    }

    startTransition(async () => {
      const res = await upgradeOrgPlanAction({
        organizationSlug,
        planId: planId as string,
      });
      if (!res?.success) {
        toast.error(res?.error || "Upgrade failed");
        return;
      }
      toast.success(`Plan schimbat la ${(planId as string).replace("team_", "").toUpperCase()}`);
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Button variant={billing === "personal" ? "default" : "outline"} onClick={() => setBilling("personal")}>
          Cont personal
        </Button>
        <Button variant={billing === "team" ? "default" : "outline"} onClick={() => setBilling("team")}>
          Echipe / Organizații
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Object.values(plans).map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          return (
            <Card key={plan.id} className={isCurrent ? "border-primary" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{plan.name}</CardTitle>
                  {isCurrent && <Badge>Current</Badge>}
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-2xl font-semibold">
                  {plan.price === 0 ? "Free" : `$${plan.price}/${plan.interval}`}
                </div>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  {plan.features.features.map((f: string) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={isCurrent ? "outline" : "default"}
                  disabled={pending || isCurrent}
                  onClick={() => handleUpgrade(plan.id as PlanId)}
                >
                  {isCurrent
                    ? "Current plan"
                    : canUpgrade(currentPlanId as any, plan.id as any)
                    ? "Upgrade"
                    : canDowngrade(currentPlanId as any, plan.id as any)
                    ? "Downgrade"
                    : "Change plan"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
