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
          ? "border-indigo-300/80 bg-gradient-to-b from-white via-indigo-50/75 to-sky-50/65 shadow-indigo-950/10 dark:border-indigo-400/25 dark:from-zinc-950 dark:via-indigo-950/28 dark:to-sky-950/20"
          : "border-border/80 bg-card/95 shadow-zinc-950/5 dark:bg-zinc-950/82"
      )}
    >
      {badge && (
        <Badge className="absolute left-7 top-6 border-0 bg-indigo-950 text-white shadow-sm dark:bg-indigo-100 dark:text-indigo-950">
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
              ? "bg-indigo-950 text-white shadow-lg shadow-indigo-950/15 hover:bg-indigo-900 dark:bg-indigo-300 dark:text-indigo-950 dark:hover:bg-indigo-200"
              : "border-border/80 bg-background/90 hover:bg-indigo-50/70 hover:text-foreground dark:bg-zinc-950/60 dark:hover:bg-indigo-950/30"
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
                    ? "bg-indigo-100 text-indigo-950 dark:bg-indigo-400/20 dark:text-indigo-100"
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
