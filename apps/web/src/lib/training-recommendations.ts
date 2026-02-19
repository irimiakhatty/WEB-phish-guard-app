import prisma from "@phish-guard-app/db";
import { ATTACK_TYPES, classifyAttackType, type AttackType } from "./attack-types";

const DEFAULT_ATTACK_TYPE: AttackType = "Other";
const WINDOW_DAYS = 90;

const ATTACK_HINT_MAP: Record<string, AttackType> = {
  "ceo fraud": "CEO Fraud",
  ceo_fraud: "CEO Fraud",
  bec: "CEO Fraud",
  business_email_compromise: "CEO Fraud",

  "credential harvesting": "Credential Harvesting",
  credential_harvesting: "Credential Harvesting",
  credential_phishing: "Credential Harvesting",
  credentials: "Credential Harvesting",
  "credential theft": "Credential Harvesting",

  "invoice/payment": "Invoice/Payment",
  invoice_payment: "Invoice/Payment",
  invoice: "Invoice/Payment",
  payment: "Invoice/Payment",
  payment_fraud: "Invoice/Payment",

  "account suspension": "Account Suspension",
  account_suspension: "Account Suspension",
  account_locked: "Account Suspension",
  lockout: "Account Suspension",

  "delivery/logistics": "Delivery/Logistics",
  delivery_logistics: "Delivery/Logistics",
  delivery: "Delivery/Logistics",
  logistics: "Delivery/Logistics",
  package: "Delivery/Logistics",
  shipment: "Delivery/Logistics",
};

const TRAINING_PLAYBOOK: Record<AttackType, string> = {
  "CEO Fraud":
    "Run impersonation drills: require callback verification for payment requests and enforce two-person approval for urgent transfers.",
  "Credential Harvesting":
    "Focus on login-page phishing simulations: teach URL validation, enforce MFA, and verify password-reset requests out of band.",
  "Invoice/Payment":
    "Strengthen finance controls: train users to confirm bank-account changes through a second channel and match invoices to approved vendors.",
  "Account Suspension":
    "Train users to ignore panic alerts sent by email links; access accounts only from bookmarked portals and report lockout-themed messages.",
  "Delivery/Logistics":
    "Train on parcel scams: avoid unknown tracking links, expand shortened URLs, and validate courier domains before opening.",
  Other:
    "Continue baseline phishing training with monthly simulations and mandatory reporting of suspicious messages.",
};

export interface UserTrainingRecommendation {
  dominantAttackType: AttackType;
  recommendation: string;
  incidentsReviewed: number;
  windowDays: number;
}

function normalizeAttackHint(rawHint: string): AttackType | null {
  const normalized = rawHint
    .replace(/^attack_type:/i, "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");

  return ATTACK_HINT_MAP[normalized] ?? null;
}

function extractAttackTypeFromScan(
  detectedThreats: string[],
  analysis: string | null
): AttackType {
  const hintedThreat = detectedThreats.find((t) =>
    t.toLowerCase().startsWith("attack_type:")
  );

  if (hintedThreat) {
    const mapped = normalizeAttackHint(hintedThreat);
    if (mapped) return mapped;
  }

  return classifyAttackType(`${analysis || ""} ${detectedThreats.join(" ")}`);
}

export async function getUserTrainingRecommendation(
  userId: string
): Promise<UserTrainingRecommendation> {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - WINDOW_DAYS);

  const riskyScans = await prisma.scan.findMany({
    where: {
      userId,
      isDeleted: false,
      createdAt: { gte: windowStart },
      OR: [{ isPhishing: true }, { riskLevel: { in: ["high", "critical"] } }],
    },
    select: {
      detectedThreats: true,
      analysis: true,
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  if (riskyScans.length === 0) {
    return {
      dominantAttackType: DEFAULT_ATTACK_TYPE,
      recommendation: TRAINING_PLAYBOOK[DEFAULT_ATTACK_TYPE],
      incidentsReviewed: 0,
      windowDays: WINDOW_DAYS,
    };
  }

  const counts = new Map<AttackType, number>();
  ATTACK_TYPES.forEach((type) => counts.set(type, 0));

  for (const scan of riskyScans) {
    const attackType = extractAttackTypeFromScan(
      scan.detectedThreats || [],
      scan.analysis
    );
    counts.set(attackType, (counts.get(attackType) || 0) + 1);
  }

  const ranked = ATTACK_TYPES.map((type) => ({
    type,
    count: counts.get(type) || 0,
  })).sort((a, b) => b.count - a.count);

  const topNonOther = ranked.find((entry) => entry.type !== "Other" && entry.count > 0);
  const dominantAttackType = (topNonOther?.type || ranked[0]?.type || DEFAULT_ATTACK_TYPE) as AttackType;

  return {
    dominantAttackType,
    recommendation: TRAINING_PLAYBOOK[dominantAttackType],
    incidentsReviewed: riskyScans.length,
    windowDays: WINDOW_DAYS,
  };
}
