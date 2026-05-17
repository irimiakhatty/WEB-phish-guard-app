import { Check, Sparkles } from "lucide-react";

import { cn } from "@/lib/shared/utils";

import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

type PricingCardProps = {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  buttonText: string;
  badge?: string;
  onSelect?: () => void;
  disabled?: boolean;
};

export default function PricingCard({
  name,
  price,
  period,
  description,
  features,
  highlighted = false,
  buttonText,
  badge,
  onSelect,
  disabled = false,
}: PricingCardProps) {
  return (
    <div
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-[28px] border p-7 shadow-sm",
        highlighted
          ? "border-cyan-400/22 bg-white shadow-[0_0_0_1px_rgba(0,229,255,0.16),0_0_40px_rgba(0,229,255,0.08)] dark:bg-zinc-950/82 dark:shadow-[0_0_0_1px_rgba(0,229,255,0.18),0_0_44px_rgba(0,229,255,0.1)]"
          : "border-border/80 bg-card/95 shadow-zinc-950/5 dark:bg-zinc-950/82"
      )}
    >
      {badge && (
        <Badge className="absolute left-7 top-6 border-0 bg-cyan-400 text-black shadow-[0_0_20px_rgba(0,229,255,0.18)]">
          <Sparkles className="mr-1 h-3 w-3" />
          {badge}
        </Badge>
      )}

      <div className={cn("flex h-full flex-col", badge ? "pt-8" : "")}>
        <div className="space-y-5">
          <div className="space-y-3">
            <h3 className="text-2xl font-semibold tracking-tight text-foreground">{name}</h3>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
          </div>

          <div className="flex items-end gap-2">
            <span className="text-4xl font-semibold leading-none tracking-tight text-foreground sm:text-5xl">
              {price}
            </span>
            {period ? (
              <span className="pb-1 text-sm text-muted-foreground">/ {period}</span>
            ) : null}
          </div>
        </div>

        <Button
          variant={highlighted ? "default" : "outline"}
          className={cn(
            "mt-7 w-full",
            highlighted
              ? "shadow-[0_0_0_1px_rgba(0,229,255,0.22),0_0_36px_rgba(0,229,255,0.12)] hover:shadow-[0_0_0_1px_rgba(0,229,255,0.28),0_0_44px_rgba(0,229,255,0.16)]"
              : "border-cyan-400/25 bg-background/90 hover:bg-cyan-400/10 hover:text-foreground dark:bg-zinc-950/60 dark:hover:bg-cyan-400/10"
          )}
          onClick={onSelect}
          disabled={disabled}
        >
          {buttonText}
        </Button>

        <div className="mt-7 space-y-3 border-t border-border/80 pt-6">
          {features.map((feature) => (
            <div key={feature} className="flex items-start gap-3">
              <div
                className={cn(
                  "flex-shrink-0 rounded-full p-1",
                  highlighted
                    ? "bg-cyan-100 text-cyan-950 dark:bg-cyan-400/15 dark:text-cyan-100"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Check className="h-3 w-3" />
              </div>
              <span className="text-sm leading-6 text-foreground/88">{feature}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
