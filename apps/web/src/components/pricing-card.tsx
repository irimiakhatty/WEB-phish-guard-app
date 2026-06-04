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
          ? "border-primary/40 bg-card"
          : "border-border bg-card"
      )}
    >
      {badge && (
        <Badge className="absolute left-7 top-6 border-0 bg-primary text-primary-foreground">
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
              ? ""
              : "border-border bg-background hover:bg-muted"
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
