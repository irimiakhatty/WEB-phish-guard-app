import { auth } from "@phish-guard-app/auth";
import prisma from "../src/index";

export type RiskTier = "safe" | "low" | "medium" | "high" | "critical";

export type AttackType =
  | "CEO Fraud"
  | "Credential Harvesting"
  | "Invoice/Payment"
  | "Account Suspension"
  | "Delivery/Logistics"
  | "Other";

export type ScanFixture = {
  daysAgo: number;
  riskLevel: RiskTier;
  isPhishing: boolean;
  overallScore: number;
  urlScore: number;
  textScore: number;
  confidence: number;
  url?: string;
  textContent?: string;
  analysis: string;
  detectedThreats: string[];
  source: "web" | "extension" | "api";
  attackType?: AttackType;
};

export function daysAgo(days: number, hourOffset = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(10 + hourOffset, 30, 0, 0);
  return date;
}

export function getRiskTier(score: number): RiskTier {
  if (score >= 0.8) return "critical";
  if (score >= 0.6) return "high";
  if (score >= 0.4) return "medium";
  if (score >= 0.2) return "low";
  return "safe";
}

export function withAttackType(
  threats: string[],
  attackType?: AttackType
): string[] {
  if (!attackType || attackType === "Other") {
    return threats;
  }
  return [`attack_type:${attackType}`, ...threats];
}

export async function createUserWithPassword(params: {
  email: string;
  password: string;
  name: string;
  emailVerified?: boolean;
  role?: string;
}) {
  const existing = await prisma.user.findUnique({
    where: { email: params.email },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: params.name,
        emailVerified: params.emailVerified ?? true,
        role: params.role ?? existing.role,
      },
    });
    return existing;
  }

  const result = await auth.api.signUpEmail({
    body: {
      email: params.email,
      password: params.password,
      name: params.name,
    },
  });

  if (!result) {
    throw new Error(`Failed to create user: ${params.email}`);
  }

  return prisma.user.update({
    where: { email: params.email },
    data: {
      emailVerified: params.emailVerified ?? true,
      role: params.role ?? "user",
    },
  });
}

export async function upsertDashboardStatsForUser(userId: string) {
  const scans = await prisma.scan.findMany({
    where: { userId, isDeleted: false },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const totalScans = scans.length;
  const threatsBlocked = scans.filter((scan) => scan.isPhishing).length;
  const safeSites = totalScans - threatsBlocked;
  const scansThisWeek = scans.filter((scan) => scan.createdAt >= weekStart).length;
  const scansThisMonth = scans.filter((scan) => scan.createdAt >= monthStart).length;
  const lastScanAt = scans[0]?.createdAt ?? null;

  await prisma.dashboardStats.upsert({
    where: { userId },
    create: {
      userId,
      totalScans,
      threatsBlocked,
      safeSites,
      scansThisWeek,
      scansThisMonth,
      lastScanAt,
    },
    update: {
      totalScans,
      threatsBlocked,
      safeSites,
      scansThisWeek,
      scansThisMonth,
      lastScanAt,
    },
  });
}

export function toDepartmentNameKey(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
