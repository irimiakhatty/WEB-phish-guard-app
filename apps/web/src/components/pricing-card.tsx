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
          ? "border-blue-500 bg-gradient-to-br from-blue-50 to-white shadow-xl dark:border-blue-600 dark:from-blue-900/25 dark:to-[#08163a]"
          : "border-gray-200 bg-white dark:border-blue-900/40 dark:bg-[#08163a]/80"
      }`}
    >
      {badge && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-blue-700 text-white border-0">
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
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-gray-900 hover:bg-gray-800 dark:bg-blue-100 dark:text-blue-950 dark:hover:bg-blue-200"
          }`}
          onClick={onSelect}
          disabled={disabled}
        >
          {buttonText}
        </Button>

        <div className="pt-6 space-y-3 border-t border-gray-200 dark:border-blue-900/50">
          {features.map((feature) => (
            <div key={feature} className="flex items-start gap-3">
              <div
                className={`rounded-full p-1 flex-shrink-0 ${
                  highlighted
                    ? "bg-blue-100 dark:bg-blue-900/50"
                    : "bg-gray-100 dark:bg-blue-900/40"
                }`}
              >
                <Check
                  className={`w-3 h-3 ${
                    highlighted
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-gray-600 dark:text-blue-300"
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
