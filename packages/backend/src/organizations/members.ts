import prisma from "@phish-guard-app/db";
import { isSuperAdmin } from "./helpers";
import { ensureUnassignedDepartment, toDepartmentNameKey } from "./shared";
import type { OrganizationActor } from "./types";

export async function removeMember(
  actor: OrganizationActor,
  organizationId: string,
  memberId: string
) {
  const actorIsSuperAdmin = isSuperAdmin(actor);

  const adminMembership = actorIsSuperAdmin
    ? null
    : await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId: actor.id,
          role: "admin",
        },
      });

  if (!actorIsSuperAdmin && !adminMembership) {
    return {
      success: false,
      error: "You don't have permission to remove members",
    };
  }

  if (!actorIsSuperAdmin && adminMembership && memberId === adminMembership.id) {
    const adminCount = await prisma.organizationMember.count({
      where: {
        organizationId,
        role: "admin",
      },
    });

    if (adminCount === 1) {
      return {
        success: false,
        error: "Cannot remove the last admin. Transfer admin role first or delete the organization.",
      };
    }
  }

  try {
    await prisma.organizationMember.delete({
      where: { id: memberId },
    });

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { slug: true },
    });

    return {
      success: true,
      revalidatePaths: [
        `/org/${org?.slug || organizationId}/members`,
        `/org/${org?.slug || organizationId}`,
      ],
    };
  } catch (error) {
    console.error("Error removing member:", error);
    return {
      success: false,
      error: "Failed to remove member",
    };
  }
}

export async function updateMemberRole(
  actor: OrganizationActor,
  organizationId: string,
  memberId: string,
  role: "admin" | "member"
) {
  const actorIsSuperAdmin = isSuperAdmin(actor);

  const adminMembership = actorIsSuperAdmin
    ? null
    : await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId: actor.id,
          role: "admin",
        },
      });

  if (!actorIsSuperAdmin && !adminMembership) {
    return {
      success: false,
      error: "You don't have permission to change member roles",
    };
  }

  if (!actorIsSuperAdmin && adminMembership && memberId === adminMembership.id && role === "member") {
    const adminCount = await prisma.organizationMember.count({
      where: {
        organizationId,
        role: "admin",
      },
    });

    if (adminCount === 1) {
      return {
        success: false,
        error: "Cannot demote the last admin. Promote another member first.",
      };
    }
  }

  try {
    await prisma.organizationMember.update({
      where: { id: memberId },
      data: { role },
    });

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { slug: true },
    });

    return {
      success: true,
      revalidatePaths: [
        `/org/${org?.slug || organizationId}/members`,
        `/org/${org?.slug || organizationId}`,
      ],
    };
  } catch (error) {
    console.error("Error updating member role:", error);
    return {
      success: false,
      error: "Failed to update member role",
    };
  }
}

export async function createOrganizationDepartment(
  actor: OrganizationActor,
  input: {
    organizationId: string;
    name: string;
  }
) {
  const actorIsSuperAdmin = isSuperAdmin(actor);
  const cleanedName = input.name.trim().replace(/\s+/g, " ");

  if (cleanedName.length < 2) {
    return {
      success: false,
      error: "Department name must be at least 2 characters",
    };
  }

  const adminMembership = actorIsSuperAdmin
    ? null
    : await prisma.organizationMember.findFirst({
        where: {
          organizationId: input.organizationId,
          userId: actor.id,
          role: "admin",
        },
      });

  if (!actorIsSuperAdmin && !adminMembership) {
    return {
      success: false,
      error: "You don't have permission to manage departments",
    };
  }

  const organization = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { id: true, slug: true },
  });

  if (!organization) {
    return {
      success: false,
      error: "Organization not found",
    };
  }

  const nameNormalized = toDepartmentNameKey(cleanedName);
  if (!nameNormalized) {
    return {
      success: false,
      error: "Invalid department name",
    };
  }

  try {
    const existing = await prisma.organizationDepartment.findFirst({
      where: {
        organizationId: input.organizationId,
        nameNormalized,
      },
      select: { id: true, name: true },
    });

    if (existing) {
      return {
        success: true,
        reused: true,
        departmentId: existing.id,
        name: existing.name,
      };
    }

    const created = await prisma.organizationDepartment.create({
      data: {
        organizationId: input.organizationId,
        name: cleanedName,
        nameNormalized,
      },
      select: {
        id: true,
        name: true,
      },
    });

    return {
      success: true,
      departmentId: created.id,
      name: created.name,
      revalidatePaths: [`/org/${organization.slug}`, `/org/${organization.slug}/members`],
    };
  } catch (error) {
    const err = error as { code?: string };
    if (err.code === "P2002") {
      return {
        success: false,
        error: "Department already exists",
      };
    }
    console.error("Error creating department:", error);
    return {
      success: false,
      error: "Failed to create department",
    };
  }
}

export async function assignMemberDepartment(
  actor: OrganizationActor,
  input: {
    organizationId: string;
    memberId: string;
    departmentId: string | "unassigned" | null;
  }
) {
  const actorIsSuperAdmin = isSuperAdmin(actor);

  const adminMembership = actorIsSuperAdmin
    ? null
    : await prisma.organizationMember.findFirst({
        where: {
          organizationId: input.organizationId,
          userId: actor.id,
          role: "admin",
        },
      });

  if (!actorIsSuperAdmin && !adminMembership) {
    return {
      success: false,
      error: "You don't have permission to assign departments",
    };
  }

  const organization = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { id: true, slug: true },
  });

  if (!organization) {
    return {
      success: false,
      error: "Organization not found",
    };
  }

  const member = await prisma.organizationMember.findFirst({
    where: {
      id: input.memberId,
      organizationId: input.organizationId,
    },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!member) {
    return {
      success: false,
      error: "Member not found in organization",
    };
  }

  let targetDepartmentId: string;
  if (!input.departmentId || input.departmentId === "unassigned") {
    targetDepartmentId = await ensureUnassignedDepartment(input.organizationId);
  } else {
    const department = await prisma.organizationDepartment.findFirst({
      where: {
        id: input.departmentId,
        organizationId: input.organizationId,
      },
      select: { id: true },
    });

    if (!department) {
      return {
        success: false,
        error: "Department not found",
      };
    }

    targetDepartmentId = department.id;
  }

  await prisma.organizationMember.update({
    where: { id: member.id },
    data: {
      departmentId: targetDepartmentId,
    },
  });

  await prisma.scan.updateMany({
    where: {
      organizationId: input.organizationId,
      userId: member.userId,
      departmentId: null,
    },
    data: {
      departmentId: targetDepartmentId,
    },
  });

  return {
    success: true,
    departmentId: targetDepartmentId,
    revalidatePaths: [
      `/org/${organization.slug}`,
      `/org/${organization.slug}/members`,
      `/org/${organization.slug}/members/${member.userId}`,
    ],
  };
}