"use server";

import prisma from "@phish-guard-app/db";
import { requireAuth } from "@/lib/auth-helpers";
import { getPlanById, isTeamPlan } from "@/lib/subscription-plans";
import { revalidatePath } from "next/cache";

type UpgradeArgs = {
  organizationSlug: string;
  planId: string;
};

export async function upgradeOrgPlanAction({ organizationSlug, planId }: UpgradeArgs) {
  const { user } = await requireAuth();

  if (!isTeamPlan(planId as any)) {
    return { success: false, error: "Invalid team plan" };
  }

  const org = await prisma.organization.findUnique({
    where: { slug: organizationSlug },
    select: { id: true },
  });

  if (!org) {
    return { success: false, error: "Organization not found" };
  }

  const membership = await prisma.organizationMember.findFirst({
    where: {
      organizationId: org.id,
      userId: user.id,
      role: "admin",
    },
  });

  if (!membership) {
    return { success: false, error: "You need to be an org admin to upgrade." };
  }

  const plan = getPlanById(planId);

  await prisma.subscription.update({
    where: { organizationId: org.id },
    data: {
      plan: planId,
      status: "active",
      maxMembers: (plan.features as any).maxMembers ?? 3,
      scansPerMonth: (plan.features as any).scansPerMonth ?? 500,
      scansPerHourPerUser: (plan.features as any).scansPerHourPerUser ?? 25,
      maxApiTokens: (plan.features as any).maxApiTokens ?? 1,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 zile
    },
  });

  revalidatePath("/organizations");
  revalidatePath(`/org/${organizationSlug}`);
  revalidatePath("/subscriptions");

  return { success: true, planId };
}
