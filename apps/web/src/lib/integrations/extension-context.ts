import prisma from "@phish-guard-app/db";
import { getPlanById } from "@/lib/billing/subscription-plans";
import { getUserSubscriptionInfo } from "@/lib/billing/subscription-helpers";

export type ExtensionRecentScan = {
  id: string;
  url: string | null;
  riskLevel: string;
  overallScore: number;
  isPhishing: boolean;
  source: string | null;
  createdAt: string;
};

export type ExtensionAccountContext = {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  account: {
    workspaceType: "personal" | "organization";
    organizationId: string | null;
    organizationName: string | null;
    organizationSlug: string | null;
    isOrgAdmin: boolean;
  };
  subscription: {
    subscriptionType: "personal" | "team" | "none";
    planId: string;
    planName: string;
    status: string | null;
    isPaid: boolean;
    usageScope: "personal" | "organization";
    scansUsed: number;
    scansRemaining: number;
    scansLimit: number;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    maxApiTokens: number;
    advancedAnalytics: boolean;
    apiAccess: boolean;
  };
  activity: {
    scansThisMonth: number;
    threatsThisMonth: number;
    safeScansThisMonth: number;
  };
  recentScans: ExtensionRecentScan[];
  keys: {
    deepScanPublicKey: string | null;
    analyzePayloadPublicKey: string | null;
  };
};

function getStartOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function serializeDate(date?: Date | null) {
  return date ? date.toISOString() : null;
}

export async function getExtensionContextForUser(
  userId: string
): Promise<ExtensionAccountContext> {
  const [user, subscriptionInfo] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    }),
    getUserSubscriptionInfo(userId),
  ]);

  if (!user) {
    throw new Error("User not found");
  }

  const now = new Date();
  const startOfMonth = getStartOfMonth(now);
  const usageScope =
    subscriptionInfo.subscriptionType === "team" && subscriptionInfo.organizationId
      ? "organization"
      : "personal";
  const usageWhere =
    usageScope === "organization"
      ? {
          organizationId: subscriptionInfo.organizationId,
          isDeleted: false,
          createdAt: { gte: startOfMonth },
        }
      : {
          userId,
          organizationId: null,
          isDeleted: false,
          createdAt: { gte: startOfMonth },
        };

  const [usageScans, scansThisMonth, threatsThisMonth, recentScans] = await Promise.all([
    prisma.scan.count({ where: usageWhere }),
    prisma.scan.count({
      where: {
        userId,
        isDeleted: false,
        createdAt: { gte: startOfMonth },
      },
    }),
    prisma.scan.count({
      where: {
        userId,
        isDeleted: false,
        isPhishing: true,
        createdAt: { gte: startOfMonth },
      },
    }),
    prisma.scan.findMany({
      where: {
        userId,
        isDeleted: false,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
      select: {
        id: true,
        url: true,
        riskLevel: true,
        overallScore: true,
        isPhishing: true,
        source: true,
        createdAt: true,
      },
    }),
  ]);

  const plan = getPlanById(subscriptionInfo.planId);
  const scansLimit = subscriptionInfo.limits.scansPerMonth;
  const scansRemaining = Math.max(0, scansLimit - usageScans);
  const workspaceType = usageScope === "organization" ? "organization" : "personal";

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    account: {
      workspaceType,
      organizationId: subscriptionInfo.organizationId ?? subscriptionInfo.preferredOrganizationId ?? null,
      organizationName:
        subscriptionInfo.organizationName ?? subscriptionInfo.preferredOrganizationName ?? null,
      organizationSlug:
        subscriptionInfo.organizationSlug ?? subscriptionInfo.preferredOrganizationSlug ?? null,
      isOrgAdmin: Boolean(subscriptionInfo.isOrgAdmin || subscriptionInfo.isAnyOrgAdmin),
    },
    subscription: {
      subscriptionType: subscriptionInfo.subscriptionType,
      planId: subscriptionInfo.planId,
      planName: plan.name,
      status: subscriptionInfo.status ?? null,
      isPaid: subscriptionInfo.hasActiveSubscription,
      usageScope,
      scansUsed: usageScans,
      scansRemaining,
      scansLimit,
      currentPeriodEnd: serializeDate(subscriptionInfo.currentPeriodEnd ?? null),
      cancelAtPeriodEnd: Boolean(subscriptionInfo.cancelAtPeriodEnd),
      maxApiTokens: subscriptionInfo.limits.maxApiTokens,
      advancedAnalytics: subscriptionInfo.limits.advancedAnalytics,
      apiAccess: subscriptionInfo.limits.apiAccess,
    },
    activity: {
      scansThisMonth,
      threatsThisMonth,
      safeScansThisMonth: Math.max(0, scansThisMonth - threatsThisMonth),
    },
    recentScans: recentScans.map((scan) => ({
      id: scan.id,
      url: scan.url ?? null,
      riskLevel: scan.riskLevel,
      overallScore: scan.overallScore,
      isPhishing: scan.isPhishing,
      source: scan.source ?? null,
      createdAt: scan.createdAt.toISOString(),
    })),
    keys: {
      deepScanPublicKey: process.env.DEEP_SCAN_PUBLIC_KEY || null,
      analyzePayloadPublicKey:
        process.env.ANALYZE_PAYLOAD_PUBLIC_KEY || process.env.DEEP_SCAN_PUBLIC_KEY || null,
    },
  };
}