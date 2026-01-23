import prisma from "@phish-guard-app/db";
import {
  getPlanById,
  isPersonalPlan,
  isTeamPlan,
  PERSONAL_PLANS,
  TEAM_PLANS,
  type PlanId,
} from "./subscription-plans";

// ==========================================
// SUBSCRIPTION STATUS HELPERS
// ==========================================

export interface UserSubscriptionInfo {
  hasActiveSubscription: boolean;
  subscriptionType: "personal" | "team" | "none";
  planId: PlanId;
  limits: {
    scansPerMonth: number;
    scansPerHour: number;
    maxApiTokens: number;
    advancedAnalytics: boolean;
    prioritySupport: boolean;
    apiAccess: boolean;
  };
  organizationId?: string;
  organizationName?: string;
  isOrgAdmin?: boolean;
}

/**
 * Get comprehensive subscription info for a user
 * Checks both personal subscription and organization memberships
 * Returns the best available plan
 */
export async function getUserSubscriptionInfo(
  userId: string
): Promise<UserSubscriptionInfo> {
  // Fetch user with personal subscription and org memberships
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      personalSubscription: true,
      memberships: {
        include: {
          organization: {
            include: {
              subscription: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Check personal subscription
  const personalSub = user.personalSubscription;
  const hasPersonalSub = personalSub?.status === "active";

  // Check organization subscriptions
  const activeOrgMemberships = user.memberships.filter(
    (m) => m.organization.subscription?.status === "active"
  );

  // Determine best subscription
  if (activeOrgMemberships.length > 0) {
    // Use organization subscription (typically higher limits)
    const orgMembership = activeOrgMemberships[0]; // Take first active org
    const orgSub = orgMembership.organization.subscription!;
    const plan = getPlanById(orgSub.planId);

    // Calculate per-user limits for team plans
    const scansPerHourPerUser = isTeamPlan(orgSub.planId as any)
      ? (plan.features as any).scansPerHourPerUser
      : plan.features.scansPerHour;

    return {
      hasActiveSubscription: true,
      subscriptionType: "team",
      planId: orgSub.planId as PlanId,
      limits: {
        scansPerMonth: plan.features.scansPerMonth,
        scansPerHour: scansPerHourPerUser,
        maxApiTokens: plan.features.maxApiTokens,
        advancedAnalytics: plan.limits.advancedAnalytics,
        prioritySupport: plan.limits.prioritySupport,
        apiAccess: plan.limits.apiAccess,
      },
      organizationId: orgMembership.organizationId,
      organizationName: orgMembership.organization.name,
      isOrgAdmin: orgMembership.role === "admin",
    };
  } else if (hasPersonalSub) {
    // Use personal subscription
    const plan = getPlanById(personalSub.planId);

    return {
      hasActiveSubscription: true,
      subscriptionType: "personal",
      planId: personalSub.planId as PlanId,
      limits: {
        scansPerMonth: plan.features.scansPerMonth,
        scansPerHour: plan.features.scansPerHour,
        maxApiTokens: plan.features.maxApiTokens,
        advancedAnalytics: plan.limits.advancedAnalytics,
        prioritySupport: plan.limits.prioritySupport,
        apiAccess: plan.limits.apiAccess,
      },
    };
  } else {
    // Free tier (no subscription)
    const freePlan = PERSONAL_PLANS.free;

    return {
      hasActiveSubscription: false,
      subscriptionType: "none",
      planId: "free",
      limits: {
        scansPerMonth: freePlan.features.scansPerMonth,
        scansPerHour: freePlan.features.scansPerHour,
        maxApiTokens: freePlan.features.maxApiTokens,
        advancedAnalytics: freePlan.limits.advancedAnalytics,
        prioritySupport: freePlan.limits.prioritySupport,
        apiAccess: freePlan.limits.apiAccess,
      },
    };
  }
}

// ==========================================
// RATE LIMIT CHECKING
// ==========================================

/**
 * Check if user has exceeded their monthly scan limit
 */
export async function checkMonthlyLimit(
  userId: string
): Promise<{ allowed: boolean; scansUsed: number; scansLimit: number }> {
  const subInfo = await getUserSubscriptionInfo(userId);

  // Count scans this month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const scanCount = await prisma.scan.count({
    where: {
      userId,
      createdAt: {
        gte: startOfMonth,
      },
    },
  });

  return {
    allowed: scanCount < subInfo.limits.scansPerMonth,
    scansUsed: scanCount,
    scansLimit: subInfo.limits.scansPerMonth,
  };
}

/**
 * Check if user has exceeded their hourly scan limit
 */
export async function checkHourlyLimit(
  userId: string
): Promise<{ allowed: boolean; scansUsed: number; scansLimit: number }> {
  const subInfo = await getUserSubscriptionInfo(userId);

  // Count scans this hour
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const scanCount = await prisma.scan.count({
    where: {
      userId,
      createdAt: {
        gte: oneHourAgo,
      },
    },
  });

  return {
    allowed: scanCount < subInfo.limits.scansPerHour,
    scansUsed: scanCount,
    scansLimit: subInfo.limits.scansPerHour,
  };
}

/**
 * Check both monthly and hourly limits
 */
export async function checkScanLimits(userId: string): Promise<{
  allowed: boolean;
  reason?: string;
  limits: {
    monthly: { used: number; limit: number };
    hourly: { used: number; limit: number };
  };
}> {
  const [monthlyCheck, hourlyCheck] = await Promise.all([
    checkMonthlyLimit(userId),
    checkHourlyLimit(userId),
  ]);

  if (!monthlyCheck.allowed) {
    return {
      allowed: false,
      reason: `Monthly scan limit reached (${monthlyCheck.scansUsed}/${monthlyCheck.scansLimit})`,
      limits: {
        monthly: {
          used: monthlyCheck.scansUsed,
          limit: monthlyCheck.scansLimit,
        },
        hourly: { used: hourlyCheck.scansUsed, limit: hourlyCheck.scansLimit },
      },
    };
  }

  if (!hourlyCheck.allowed) {
    return {
      allowed: false,
      reason: `Hourly scan limit reached (${hourlyCheck.scansUsed}/${hourlyCheck.scansLimit})`,
      limits: {
        monthly: {
          used: monthlyCheck.scansUsed,
          limit: monthlyCheck.scansLimit,
        },
        hourly: { used: hourlyCheck.scansUsed, limit: hourlyCheck.scansLimit },
      },
    };
  }

  return {
    allowed: true,
    limits: {
      monthly: {
        used: monthlyCheck.scansUsed,
        limit: monthlyCheck.scansLimit,
      },
      hourly: { used: hourlyCheck.scansUsed, limit: hourlyCheck.scansLimit },
    },
  };
}

// ==========================================
// API TOKEN LIMITS
// ==========================================

/**
 * Check if user can create more API tokens
 */
export async function canCreateApiToken(userId: string): Promise<{
  allowed: boolean;
  tokensUsed: number;
  tokensLimit: number;
}> {
  const subInfo = await getUserSubscriptionInfo(userId);

  const tokenCount = await prisma.apiToken.count({
    where: {
      userId,
      isActive: true,
    },
  });

  return {
    allowed: tokenCount < subInfo.limits.maxApiTokens,
    tokensUsed: tokenCount,
    tokensLimit: subInfo.limits.maxApiTokens,
  };
}

// ==========================================
// FEATURE ACCESS CHECKS
// ==========================================

export async function hasFeatureAccess(
  userId: string,
  feature: "advancedAnalytics" | "prioritySupport" | "apiAccess"
): Promise<boolean> {
  const subInfo = await getUserSubscriptionInfo(userId);
  return subInfo.limits[feature];
}

/**
 * Check if user is part of any organization
 */
export async function isOrganizationMember(userId: string): Promise<boolean> {
  const count = await prisma.organizationMember.count({
    where: {
      userId,
      status: "active",
    },
  });
  return count > 0;
}

/**
 * Check if user is admin of at least one organization
 */
export async function isOrganizationAdmin(userId: string): Promise<boolean> {
  const count = await prisma.organizationMember.count({
    where: {
      userId,
      role: "admin",
      status: "active",
    },
  });
  return count > 0;
}

// ==========================================
// SUBSCRIPTION UPGRADE/DOWNGRADE
// ==========================================

export interface SubscriptionChangePreview {
  canChange: boolean;
  reason?: string;
  proratedAmount?: number;
  effectiveDate: Date;
}

/**
 * Preview what would happen if user changes their personal subscription
 */
export async function previewPersonalSubscriptionChange(
  userId: string,
  newPlanId: string
): Promise<SubscriptionChangePreview> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { personalSubscription: true },
  });

  if (!user) {
    return {
      canChange: false,
      reason: "User not found",
      effectiveDate: new Date(),
    };
  }

  if (!isPersonalPlan(newPlanId)) {
    return {
      canChange: false,
      reason: "Invalid personal plan",
      effectiveDate: new Date(),
    };
  }

  const currentPlan = user.personalSubscription?.planId || "free";
  const currentPlanPrice = getPlanById(currentPlan).price;
  const newPlanPrice = getPlanById(newPlanId).price;

  // Calculate prorated amount (simplified - in production use Stripe)
  const proratedAmount = Math.max(0, newPlanPrice - currentPlanPrice);

  return {
    canChange: true,
    proratedAmount,
    effectiveDate: new Date(), // Immediate
  };
}

/**
 * Get user's organization memberships with subscription info
 */
export async function getUserOrganizations(userId: string) {
  const memberships = await prisma.organizationMember.findMany({
    where: {
      userId,
      status: "active",
    },
    include: {
      organization: {
        include: {
          subscription: true,
          _count: {
            select: {
              members: true,
            },
          },
        },
      },
    },
  });

  return memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    role: m.role,
    planId: m.organization.subscription?.planId || "team_free",
    planName: getPlanById(
      m.organization.subscription?.planId || "team_free"
    ).name,
    memberCount: m.organization._count.members,
    joinedAt: m.joinedAt,
  }));
}
