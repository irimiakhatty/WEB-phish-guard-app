"use client";

import { useTransition, useState, useMemo } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { TEAM_PLANS, type TeamPlanId, canUpgrade, canDowngrade } from "@/lib/subscription-plans";

type Props = {
  organizationSlug: string;
  currentPlan: string;
};

const teamPlanOptions = Object.values(TEAM_PLANS).map((plan) => ({
  id: plan.id,
  label: `${plan.name} — ${plan.features.scansPerMonth} scans/mo, ${plan.features.scansPerHourPerUser} scans/hr/user`,
}));

export default function UpgradePlanForm({ organizationSlug, currentPlan }: Props) {
  const [selectedPlan, setSelectedPlan] = useState<TeamPlanId>(
    (currentPlan as TeamPlanId) || "team_startup"
  );
  const [pending, startTransition] = useTransition();

  const label = useMemo(() => {
    if (selectedPlan === currentPlan) return "Current plan";
    if (canUpgrade(currentPlan as any, selectedPlan as any)) return "Upgrade";
    if (canDowngrade(currentPlan as any, selectedPlan as any)) return "Downgrade";
    return "Change plan";
  }, [currentPlan, selectedPlan]);

  const handleUpgrade = () => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId: selectedPlan,
            organizationSlug,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data?.error || "Checkout failed");
          return;
        }

        if (data?.url) {
          window.location.href = data.url;
        } else if (data?.message) {
          toast.success(data.message);
          window.location.reload();
        } else {
          toast.error("Could not start the billing flow.");
        }
      } catch (err: any) {
        toast.error(err?.message || "Upgrade failed");
        console.error(err);
      }
    });
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <Select
        value={selectedPlan}
        onValueChange={(value) => setSelectedPlan(value as TeamPlanId)}
        disabled={pending}
      >
        <SelectTrigger className="w-full sm:w-[420px] bg-white text-gray-900 border-gray-300 dark:bg-zinc-950 dark:text-zinc-100 dark:border-zinc-700">
          <SelectValue placeholder="Choose a team plan" />
        </SelectTrigger>
        <SelectContent className="bg-white text-gray-900 border-gray-200 dark:bg-zinc-950 dark:text-zinc-100 dark:border-zinc-800">
          {teamPlanOptions.map((plan) => (
            <SelectItem key={plan.id} value={plan.id}>
              {plan.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <Button onClick={handleUpgrade} disabled={pending || selectedPlan === currentPlan}>
          {pending ? "Saving..." : label}
        </Button>
        <Link href="/subscription">
          <Button type="button" variant="outline">
            Open billing page
          </Button>
        </Link>
      </div>
    </div>
  );
}
