import prisma from "@phish-guard-app/db";
import {
  getPlanById,
  isPersonalPlan,
  PERSONAL_PLANS,
  isValidPlan,
  type PlanId,
} from "./subscription-plans";

// ==========================================
// SUBSCRIPTION STATUS HELPERS
// ==========================================

export interface UserSubscriptionInfo {
  hasActiveSubscription: boolean;
  subscriptionType: "personal" | "team" | "none";
  planId: PlanId;
  status?: string;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
  expiredPaidSubscription?: {
    subscriptionType: "personal" | "team";
    planId: PlanId;
    status?: string | null;
    currentPeriodEnd?: Date | null;
    organizationSlug?: string;
  };
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
  organizationSlug?: string;
  isOrgAdmin?: boolean;
  preferredOrganizationId?: string;
  preferredOrganizationName?: string;
  preferredOrganizationSlug?: string;
  preferredOrganizationRole?: string;
  adminOrganizationId?: string;
  adminOrganizationName?: string;
  adminOrganizationSlug?: string;
  isAnyOrgAdmin?: boolean;
}

function getScansPerHourLimit(planId: PlanId): number {
  const features = getPlanById(planId).features as {
    scansPerHour?: number;
    scansPerHourPerUser?: number;
  };

  return features.scansPerHourPerUser ?? features.scansPerHour ?? 25;
}

const PAID_SUBSCRIPTION_ACTIVE_STATUSES = new Set(["active", "trialing"]);

function isPaidPlan(planId: PlanId): boolean {
  return getPlanById(planId).price > 0;
}

function isSubscriptionCurrentlyUsable(params: {
  planId: PlanId;
  status?: string | null;
  currentPeriodEnd?: Date | null;
  now: Date;
}): boolean {
  const { planId, status, currentPeriodEnd, now } = params;
  if (!status) {
    return false;
  }

  // Free plans are usable while marked active.
  if (!isPaidPlan(planId)) {
    return status === "active";
  }

  if (!currentPeriodEnd) {
    return PAID_SUBSCRIPTION_ACTIVE_STATUSES.has(status);
  }

  return (
    PAID_SUBSCRIPTION_ACTIVE_STATUSES.has(status) &&
    currentPeriodEnd.getTime() > now.getTime()
  );
}

type InactivePaidSubscriptionCandidate = {
  subscriptionType: "personal" | "team";
  planId: PlanId;
  status?: string | null;
  currentPeriodEnd?: Date | null;
  organizationSlug?: string;
};

type UserOrganizationMembership = {
  organizationId: string;
  role: string;
  joinedAt: Date;
  organization: {
    id: string;
    name: string;
    slug: string;
    subscription: {
      plan: string;
      status?: string | null;
      currentPeriodEnd?: Date | null;
      cancelAtPeriodEnd?: boolean | null;
    } | null;
  };
};

type OrganizationContext = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: string;
};

function pickMostRecentInactivePaidSubscription(
  candidates: InactivePaidSubscriptionCandidate[]
): InactivePaidSubscriptionCandidate | undefined {
  if (candidates.length === 0) {
    return undefined;
  }

  return candidates.reduce((latest, candidate) => {
    const latestTs = latest.currentPeriodEnd?.getTime() ?? 0;
    const candidateTs = candidate.currentPeriodEnd?.getTime() ?? 0;
    return candidateTs > latestTs ? candidate : latest;
  });
}

function isUsableOrganizationMembership(
  membership: UserOrganizationMembership,
  now: Date
): boolean {
  const subscription = membership.organization.subscription;
  if (!subscription) {
    return false;
  }

  return isSubscriptionCurrentlyUsable({
    planId: (subscription.plan as PlanId) || "team_free",
    status: subscription.status,
    currentPeriodEnd: subscription.currentPeriodEnd ?? null,
    now,
  });
}

function sortMembershipsForOrganizationContext(
  memberships: UserOrganizationMembership[],
  now: Date
): UserOrganizationMembership[] {
  return [...memberships].sort((a, b) => {
    const adminDiff = Number(b.role === "admin") - Number(a.role === "admin");
    if (adminDiff !== 0) {
      return adminDiff;
    }

    const usableDiff =
      Number(isUsableOrganizationMembership(b, now)) -
      Number(isUsableOrganizationMembership(a, now));
    if (usableDiff !== 0) {
      return usableDiff;
    }

    return b.joinedAt.getTime() - a.joinedAt.getTime();
  });
}

function sortActiveOrganizationMemberships(
  memberships: UserOrganizationMembership[]
): UserOrganizationMembership[] {
  return [...memberships].sort((a, b) => {
    const aPlanId = (a.organization.subscription?.plan as PlanId) || "team_free";
    const bPlanId = (b.organization.subscription?.plan as PlanId) || "team_free";
    const priceDiff = getPlanById(bPlanId).price - getPlanById(aPlanId).price;
    if (priceDiff !== 0) {
      return priceDiff;
    }

    const adminDiff = Number(b.role === "admin") - Number(a.role === "admin");
    if (adminDiff !== 0) {
      return adminDiff;
    }

    return b.joinedAt.getTime() - a.joinedAt.getTime();
  });
}

function toOrganizationContext(
  membership: UserOrganizationMembership
): OrganizationContext {
  return {
    organizationId: membership.organizationId,
    organizationName: membership.organization.name,
    organizationSlug: membership.organization.slug,
    role: membership.role,
  };
}

/**
 * Get comprehensive subscription info for a user
 * Checks both personal subscription and organization memberships
 * Returns the best available plan
 */
export async function getUserSubscriptionInfo(
  userId: string
): Promise<UserSubscriptionInfo> {
  const now = new Date();
  const inactivePaidCandidates: InactivePaidSubscriptionCandidate[] = [];

  // Fetch user with personal subscription and org memberships
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      personalSubscription: true,
      memberships: {
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
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

  const memberships = [...(user.memberships as UserOrganizationMembership[])].sort(
    (a, b) => b.joinedAt.getTime() - a.joinedAt.getTime()
  );
  const membershipsForContext = sortMembershipsForOrganizationContext(
    memberships,
    now
  );
  const preferredOrganizationMembership = membershipsForContext[0];
  const adminOrganizationMembership = membershipsForContext.find(
    (membership) => membership.role === "admin"
  );
  const preferredOrganization = preferredOrganizationMembership
    ? toOrganizationContext(preferredOrganizationMembership)
    : null;
  const adminOrganization = adminOrganizationMembership
    ? toOrganizationContext(adminOrganizationMembership)
    : null;
  const organizationContext = {
    preferredOrganizationId: preferredOrganization?.organizationId,
    preferredOrganizationName: preferredOrganization?.organizationName,
    preferredOrganizationSlug: preferredOrganization?.organizationSlug,
    preferredOrganizationRole: preferredOrganization?.role,
    adminOrganizationId: adminOrganization?.organizationId,
    adminOrganizationName: adminOrganization?.organizationName,
    adminOrganizationSlug: adminOrganization?.organizationSlug,
    isAnyOrgAdmin: Boolean(adminOrganization),
  };

  // Check personal subscription
  const personalSub = user.personalSubscription;
  let hasPersonalSub = false;
  if (personalSub) {
    const personalPlanId = (personalSub.plan as PlanId) || "free";
    hasPersonalSub = isSubscriptionCurrentlyUsable({
      planId: personalPlanId,
      status: personalSub.status,
      currentPeriodEnd: personalSub.currentPeriodEnd ?? null,
      now,
    });

    if (isPaidPlan(personalPlanId) && !hasPersonalSub) {
      inactivePaidCandidates.push({
        subscriptionType: "personal",
        planId: personalPlanId,
        status: personalSub.status,
        currentPeriodEnd: personalSub.currentPeriodEnd ?? null,
      });
    }
  }

  // Check organization subscriptions
  const activeOrgMemberships = sortActiveOrganizationMemberships(
    memberships.filter((m) => {
      const orgSub = m.organization.subscription;
      if (!orgSub) return false;

      return isSubscriptionCurrentlyUsable({
        planId: (orgSub.plan as PlanId) || "team_free",
        status: orgSub.status,
        currentPeriodEnd: orgSub.currentPeriodEnd ?? null,
        now,
      });
    })
  );
  const hasAnyActivePaidSubscription =
    hasPersonalSub ||
    activeOrgMemberships.some((membership) => {
      const planId =
        (membership.organization.subscription?.plan as PlanId | undefined) ||
        "team_free";
      return isValidPlan(planId) && isPaidPlan(planId);
    });

  memberships.forEach((m) => {
    const orgSub = m.organization.subscription;
    if (!orgSub) return;

    const orgPlanId = (orgSub.plan as PlanId) || "team_free";
    if (!isPaidPlan(orgPlanId)) return;

    const isUsable = isSubscriptionCurrentlyUsable({
      planId: orgPlanId,
      status: orgSub.status,
      currentPeriodEnd: orgSub.currentPeriodEnd ?? null,
      now,
    });
    if (isUsable) return;

    inactivePaidCandidates.push({
      subscriptionType: "team",
      planId: orgPlanId,
      status: orgSub.status,
      currentPeriodEnd: orgSub.currentPeriodEnd ?? null,
      organizationSlug: m.organization.slug,
    });
  });

  const expiredPaidSubscription =
    pickMostRecentInactivePaidSubscription(inactivePaidCandidates);

  // Determine best subscription
  const bestActiveOrgMembership = activeOrgMemberships[0];
  const personalPlanId = (personalSub?.plan as PlanId) || "free";
  const bestActiveOrgPlanId = bestActiveOrgMembership
    ? ((bestActiveOrgMembership.organization.subscription?.plan as PlanId) || "team_free")
    : null;
  const shouldUseOrgSubscription =
    Boolean(bestActiveOrgMembership) &&
    (!hasPersonalSub ||
      (bestActiveOrgPlanId !== null &&
        getPlanById(bestActiveOrgPlanId).price >= getPlanById(personalPlanId).price));

  if (shouldUseOrgSubscription && bestActiveOrgMembership) {
    // Prefer the strongest active team plan. Personal plans still win over team_free.
    const orgMembership = bestActiveOrgMembership;
    const orgSub = orgMembership.organization.subscription!;
    const planId = orgSub.plan as PlanId;
    const plan = getPlanById(planId);

    return {
      hasActiveSubscription: isPaidPlan(planId),
      subscriptionType: "team",
      planId,
      status: orgSub.status ?? undefined,
      currentPeriodEnd: orgSub.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: orgSub.cancelAtPeriodEnd ?? false,
      expiredPaidSubscription,
      ...organizationContext,
      limits: {
        scansPerMonth: plan.features.scansPerMonth,
        scansPerHour: getScansPerHourLimit(planId),
        maxApiTokens: plan.features.maxApiTokens,
        advancedAnalytics: plan.limits.advancedAnalytics,
        prioritySupport: plan.limits.prioritySupport,
        apiAccess: plan.limits.apiAccess,
      },
      organizationId: orgMembership.organizationId,
      organizationName: orgMembership.organization.name,
      organizationSlug: orgMembership.organization.slug,
      isOrgAdmin: orgMembership.role === "admin",
    };
  } else if (hasPersonalSub && personalSub) {
    // Use personal subscription
    const planId = personalSub.plan as PlanId;
    const plan = getPlanById(planId);

    return {
      hasActiveSubscription: isPaidPlan(planId),
      subscriptionType: "personal",
      planId,
      status: personalSub.status ?? undefined,
      currentPeriodEnd: personalSub.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: personalSub.cancelAtPeriodEnd ?? false,
      expiredPaidSubscription,
      ...organizationContext,
      limits: {
        scansPerMonth: plan.features.scansPerMonth,
        scansPerHour: getScansPerHourLimit(planId),
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
      status: "free",
      expiredPaidSubscription: hasAnyActivePaidSubscription
        ? undefined
        : expiredPaidSubscription,
      ...organizationContext,
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

  const currentPlan = (user.personalSubscription?.plan as PlanId | undefined) || "free";
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
    planId: (m.organization.subscription?.plan as PlanId | undefined) || "team_free",
    planName: getPlanById(
      (m.organization.subscription?.plan as PlanId | undefined) || "team_free"
    ).name,
    memberCount: m.organization._count.members,
    joinedAt: m.joinedAt,
  }));
}
