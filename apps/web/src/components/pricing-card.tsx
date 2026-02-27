import { Check, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

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
      className={`relative rounded-2xl p-8 border-2 transition-all hover:scale-[1.01] ${
        highlighted
          ? "border-zinc-900 bg-gradient-to-br from-zinc-100 to-white shadow-xl dark:border-zinc-100 dark:from-zinc-900 dark:to-zinc-950"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/80"
      }`}
    >
      {badge && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 border-0 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
          <Sparkles className="w-3 h-3 mr-1" />
          {badge}
        </Badge>
      )}

      <div className="space-y-4">
        <div>
          <h3 className="text-gray-900 dark:text-white mb-2 text-xl font-semibold">{name}</h3>
          <p className="text-gray-600 dark:text-gray-400">{description}</p>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-gray-900 dark:text-white text-5xl font-semibold leading-none">
            {price}
          </span>
          {period && <span className="text-gray-500 dark:text-gray-400">/ {period}</span>}
        </div>

        <Button
          className={`w-full ${
            highlighted
              ? "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              : "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          }`}
          onClick={onSelect}
          disabled={disabled}
        >
          {buttonText}
        </Button>

        <div className="pt-6 space-y-3 border-t border-zinc-200 dark:border-zinc-800">
          {features.map((feature) => (
            <div key={feature} className="flex items-start gap-3">
              <div
                className={`rounded-full p-1 flex-shrink-0 ${
                  highlighted
                    ? "bg-zinc-200 dark:bg-zinc-700"
                    : "bg-zinc-100 dark:bg-zinc-800"
                }`}
              >
                <Check
                  className={`w-3 h-3 ${
                    highlighted
                      ? "text-zinc-900 dark:text-zinc-100"
                      : "text-zinc-600 dark:text-zinc-300"
                  }`}
                />
              </div>
              <span className="text-gray-700 dark:text-gray-300">{feature}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
