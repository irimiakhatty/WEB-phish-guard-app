"use client";

import { useTransition, useState, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { upgradeOrganizationPlan } from "@/app/actions/organizations";
import { TEAM_PLANS, type TeamPlanId, canUpgrade, canDowngrade } from "@/lib/subscription-plans";

type Props = {
  organizationId: string;
  currentPlan: string;
};

const teamPlanOptions = Object.values(TEAM_PLANS).map((plan) => ({
  id: plan.id,
  label: `${plan.name} — ${plan.features.scansPerMonth} scans/mo, ${plan.features.scansPerHourPerUser} scans/hr/user`,
}));

export default function UpgradePlanForm({ organizationId, currentPlan }: Props) {
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
        const res = await upgradeOrganizationPlan(organizationId, selectedPlan);
        if (!res?.success) {
          toast.error(res?.error || "Upgrade failed");
          return;
        }
        toast.success(`Plan changed to ${selectedPlan.replace("team_", "").toUpperCase()}`);
      } catch (err: any) {
        toast.error(err?.message || "Upgrade failed");
        console.error(err);
      }
    });
  };

  return (
    <div className="flex items-center gap-3">
      <select
        value={selectedPlan}
        onChange={(e) => setSelectedPlan(e.target.value as TeamPlanId)}
        className="border rounded-md px-3 py-2 text-sm"
        disabled={pending}
      >
        {teamPlanOptions.map((plan) => (
          <option key={plan.id} value={plan.id}>
            {plan.label}
          </option>
        ))}
      </select>
      <Button onClick={handleUpgrade} disabled={pending || selectedPlan === currentPlan}>
        {pending ? "Saving..." : label}
      </Button>
    </div>
  );
}
