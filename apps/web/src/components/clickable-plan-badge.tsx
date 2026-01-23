"use client";

import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";

interface ClickablePlanBadgeProps {
  plan: string;
  orgSlug: string;
}

export function ClickablePlanBadge({ plan, orgSlug }: ClickablePlanBadgeProps) {
  const router = useRouter();

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
      {plan.replace("team_", "").toUpperCase() || "FREE"}
    </Badge>
  );
}
