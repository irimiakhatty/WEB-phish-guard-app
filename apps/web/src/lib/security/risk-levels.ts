export type RiskLevel = "safe" | "low" | "medium" | "high" | "critical";

export const RISK_THRESHOLDS = {
  low: 0.2,
  medium: 0.4,
  high: 0.6,
  critical: 0.8,
} as const;

export function getRiskLevel(score: number): RiskLevel {
  if (score < RISK_THRESHOLDS.low) return "safe";
  if (score < RISK_THRESHOLDS.medium) return "low";
  if (score < RISK_THRESHOLDS.high) return "medium";
  if (score < RISK_THRESHOLDS.critical) return "high";
  return "critical";
}

export function isPhishingScore(score: number): boolean {
  return score >= RISK_THRESHOLDS.high;
}
