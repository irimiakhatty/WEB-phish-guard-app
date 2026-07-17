import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/shared/utils";
import { getPlanById, isValidPlan } from "@/lib/billing/subscription-plans";

const PLAN_BADGE_STYLES: Record<string, string> = {
  free: "border-zinc-500/30 bg-zinc-500/10 text-zinc-600 dark:text-zinc-300",
  personal_plus: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  personal_pro: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  team_free: "border-zinc-500/30 bg-zinc-500/10 text-zinc-600 dark:text-zinc-300",
  team_startup: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  team_business: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  team_enterprise: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  super_admin: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
};

const DEFAULT_PLAN_STYLE = "border-border bg-muted text-muted-foreground";

export function getPlanBadgeClassName(planId: string) {
  return PLAN_BADGE_STYLES[planId] ?? DEFAULT_PLAN_STYLE;
}

export function getPlanLabel(planId: string) {
  if (isValidPlan(planId)) {
    return getPlanById(planId).name;
  }

  return planId.replace(/_/g, " ");
}

type AdminPlanBadgeProps = {
  planId: string;
  className?: string;
};

export function AdminPlanBadge({ planId, className }: AdminPlanBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("text-xs", getPlanBadgeClassName(planId), className)}
    >
      {getPlanLabel(planId)}
    </Badge>
  );
}
