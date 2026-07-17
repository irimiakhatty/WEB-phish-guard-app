"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/shared/utils";
import { useRouter } from "next/navigation";
import {
  getPlanBadgeClassName,
  getPlanLabel,
} from "@/features/admin/components/admin-plan-badge";

interface ClickablePlanBadgeProps {
  plan: string;
  orgSlug: string;
}

export function ClickablePlanBadge({ plan, orgSlug }: ClickablePlanBadgeProps) {
  const router = useRouter();
  const planLabel = getPlanLabel(plan);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/org/${orgSlug}#settings`);
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        "cursor-pointer text-xs transition-colors hover:bg-accent/70",
        getPlanBadgeClassName(plan)
      )}
      onClick={handleClick}
    >
      {planLabel}
    </Badge>
  );
}
