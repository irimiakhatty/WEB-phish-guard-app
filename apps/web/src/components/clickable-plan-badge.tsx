"use client";

import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { getPlanById } from "@/lib/billing/subscription-plans";

interface ClickablePlanBadgeProps {
  plan: string;
  orgSlug: string;
}

export function ClickablePlanBadge({ plan, orgSlug }: ClickablePlanBadgeProps) {
  const router = useRouter();
  const planLabel = getPlanById(plan).name;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/org/${orgSlug}#settings`);
  };

  return (
    <Badge 
      variant="outline" 
      className="cursor-pointer hover:bg-accent transition-colors"
      onClick={handleClick}
    >
      {planLabel}
    </Badge>
  );
}
