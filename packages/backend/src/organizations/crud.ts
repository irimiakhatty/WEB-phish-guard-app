import prisma from "@phish-guard-app/db";
import { ensureUnassignedDepartment } from "./shared";
import {
  TEAM_PLANS,
  hasOrganizationNameUniqueViolation,
  isSuperAdmin,
  isTeamPlan,
  sanitizeOrganizationName,
  toOrganizationNameKey,
} from "./helpers";
import type { OrganizationActor } from "./types";

export async function createOrganization(
  actor: OrganizationActor,
  data: { name: string; slug: string }
) {
  const sanitizedName = sanitizeOrganizationName(data.name);
  const organizationNameKey = toOrganizationNameKey(sanitizedName);

  if (sanitizedName.length < 2) {
    return {
      success: false,
      error: "Organization name must be at least 2 characters",
    };
  }

  const existing = await prisma.organization.findUnique({
    where: { slug: data.slug },
  });

  if (existing) {
    return {
      success: false,
      error: "Organization slug already taken",
    };
  }

  const existingByName = await prisma.organization.findUnique({
    where: { nameNormalized: organizationNameKey },
    select: { id: true },
  });

  if (existingByName) {
    return {
      success: false,
      error: "Organization name already exists",
    };
  }

  if (!/^[a-z0-9-]+$/.test(data.slug)) {
    return {
      success: false,
      error: "Slug can only contain lowercase letters, numbers, and hyphens",
    };
  }

  if (!isSuperAdmin(actor)) {
    const orgCount = await prisma.organization.count({
      where: { createdById: actor.id },
    });

    if (orgCount >= 1) {
      return {
        success: false,
        error: "You can only create one organization while on the Free or Trial plan.",
      };
    }
  }

  try {
    const organization = await prisma.organization.create({
      data: {
        name: sanitizedName,
        nameNormalized: organizationNameKey,
        slug: data.slug,
        createdById: actor.id,
        subscription: {
          create: {
            plan: "team_free",
            status: "trialing",
            maxMembers: TEAM_PLANS.team_free.maxMembers,
            scansPerMonth: TEAM_PLANS.team_free.scansPerMonth,
            scansPerHourPerUser: TEAM_PLANS.team_free.scansPerHourPerUser,
            maxApiTokens: TEAM_PLANS.team_free.maxApiTokens,
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        },
        members: {
          create: {
            userId: actor.id,
            role: "admin",
          },
        },
        organizationDepartments: {
          create: {
            name: "Unassigned",
            nameNormalized: "unassigned",
          },
        },
      },
      include: {
        subscription: true,
      },
    });

    const unassignedDepartmentId = await ensureUnassignedDepartment(organization.id);

    await prisma.organizationMember.updateMany({
      where: {
        organizationId: organization.id,
        userId: actor.id,
        departmentId: null,
      },
      data: {
        departmentId: unassignedDepartmentId,
      },
    });

    return {
      success: true,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      },
      revalidatePaths: ["/dashboard", "/organizations"],
    };
  } catch (error) {
    const err = error as { code?: string; meta?: { target?: string[] } };
    if (err.code === "P2002" && hasOrganizationNameUniqueViolation(err)) {
      return {
        success: false,
        error: "Organization name already exists",
      };
    }

    console.error("Error creating organization:", error);
    return {
      success: false,
      error: "Failed to create organization",
    };
  }
}

export async function updateOrganization(
  actor: OrganizationActor,
  organizationId: string,
  data: { name: string }
) {
  const sanitizedName = sanitizeOrganizationName(data.name);
  const organizationNameKey = toOrganizationNameKey(sanitizedName);

  if (sanitizedName.length < 2) {
    return {
      success: false,
      error: "Organization name must be at least 2 characters",
    };
  }

  if (!isSuperAdmin(actor)) {
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: actor.id,
        role: "admin",
      },
    });

    if (!membership) {
      return {
        success: false,
        error: "You don't have permission to update this organization",
      };
    }
  }

  try {
    await prisma.organization.update({
      where: { id: organizationId },
      data: { name: sanitizedName, nameNormalized: organizationNameKey },
    });

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { slug: true },
    });

    return {
      success: true,
      revalidatePaths: ["/organizations", `/org/${org?.slug || organizationId}`],
    };
  } catch (error) {
    const err = error as { code?: string; meta?: { target?: string[] } };
    if (err.code === "P2002" && hasOrganizationNameUniqueViolation(err)) {
      return {
        success: false,
        error: "Organization name already exists",
      };
    }

    console.error("Error updating organization:", error);
    return {
      success: false,
      error: "Failed to update organization",
    };
  }
}

export async function deleteOrganization(actor: OrganizationActor, organizationId: string) {
  if (!isSuperAdmin(actor)) {
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: actor.id,
        role: "admin",
      },
    });

    if (!membership) {
      return {
        success: false,
        error: "You don't have permission to delete this organization",
      };
    }
  }

  try {
    await prisma.organization.delete({
      where: { id: organizationId },
    });

    return {
      success: true,
      revalidatePaths: ["/dashboard", "/organizations"],
    };
  } catch (error) {
    console.error("Error deleting organization:", error);
    return {
      success: false,
      error: "Failed to delete organization",
    };
  }
}

export async function upgradeOrganizationPlan(
  actor: OrganizationActor,
  organizationId: string,
  targetPlanId: string
) {
  const membership = await prisma.organizationMember.findFirst({
    where: {
      organizationId,
      userId: actor.id,
      role: "admin",
    },
  });

  if (!membership) {
    return {
      success: false,
      error: "You don't have permission to upgrade this organization",
    };
  }

  if (!isTeamPlan(targetPlanId)) {
    return { success: false, error: "Invalid team plan" };
  }

  const plan = TEAM_PLANS[targetPlanId];

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { slug: true },
  });

  await prisma.subscription.update({
    where: { organizationId },
    data: {
      plan: targetPlanId,
      status: "active",
      maxMembers: plan.maxMembers,
      scansPerMonth: plan.scansPerMonth,
      scansPerHourPerUser: plan.scansPerHourPerUser,
      maxApiTokens: plan.maxApiTokens,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  return {
    success: true,
    plan: targetPlanId,
    revalidatePaths: org?.slug ? ["/dashboard", `/org/${org.slug}`] : ["/dashboard"],
  };
}

