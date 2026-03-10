import prisma from "@phish-guard-app/db";

import { getPlanById, isValidPlan, type PlanId } from "@/lib/subscription-plans";

export type BillingScope = "personal" | "business";

export type PersonalBillingSummary = {
  scope: "personal";
  planId: PlanId;
  status?: string;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd: boolean;
};

export type BusinessBillingSummary = {
  scope: "business";
  planId: PlanId;
  status?: string;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd: boolean;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
};

export type UserBillingSummaries = {
  preferredScope: BillingScope;
  personal: PersonalBillingSummary;
  business?: BusinessBillingSummary;
};

type AdminMembership = {
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

function coercePlanId(planId: string | null | undefined, fallback: PlanId): PlanId {
  if (planId && isValidPlan(planId)) {
    return planId;
  }

  return fallback;
}

function sortAdminMemberships(memberships: AdminMembership[]): AdminMembership[] {
  return [...memberships].sort((a, b) => {
    const aPlanId = coercePlanId(a.organization.subscription?.plan, "team_free");
    const bPlanId = coercePlanId(b.organization.subscription?.plan, "team_free");
    const priceDiff = getPlanById(bPlanId).price - getPlanById(aPlanId).price;
    if (priceDiff !== 0) {
      return priceDiff;
    }

    return b.joinedAt.getTime() - a.joinedAt.getTime();
  });
}

export function getBillingRouteForScope(scope: BillingScope): string {
  return scope === "business" ? "/subscriptions/business" : "/subscriptions/personal";
}

export function getSignInHrefForScope(scope: BillingScope): string {
  const account = scope === "business" ? "organization" : "personal";
  return `/login?mode=signup&account=${account}&next=${encodeURIComponent(
    getBillingRouteForScope(scope)
  )}`;
}

export async function getUserBillingSummaries(
  userId: string
): Promise<UserBillingSummaries> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      personalSubscription: true,
      memberships: {
        where: { role: "admin" },
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

  const personalPlanId = coercePlanId(user.personalSubscription?.plan, "free");
  const personal: PersonalBillingSummary = {
    scope: "personal",
    planId: personalPlanId,
    status: user.personalSubscription?.status ?? "active",
    currentPeriodEnd: user.personalSubscription?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: user.personalSubscription?.cancelAtPeriodEnd ?? false,
  };

  const adminMemberships = sortAdminMemberships(
    user.memberships as AdminMembership[]
  );
  const preferredAdminMembership = adminMemberships[0];

  if (!preferredAdminMembership) {
    return {
      preferredScope: "personal",
      personal,
    };
  }

  const businessPlanId = coercePlanId(
    preferredAdminMembership.organization.subscription?.plan,
    "team_free"
  );

  return {
    preferredScope: "business",
    personal,
    business: {
      scope: "business",
      planId: businessPlanId,
      status:
        preferredAdminMembership.organization.subscription?.status ?? "active",
      currentPeriodEnd:
        preferredAdminMembership.organization.subscription?.currentPeriodEnd ??
        null,
      cancelAtPeriodEnd:
        preferredAdminMembership.organization.subscription?.cancelAtPeriodEnd ??
        false,
      organizationId: preferredAdminMembership.organization.id,
      organizationName: preferredAdminMembership.organization.name,
      organizationSlug: preferredAdminMembership.organization.slug,
    },
  };
}
