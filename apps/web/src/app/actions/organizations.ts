"use server";

import prisma from "@phish-guard-app/db";
import { requireAuth } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

// ==========================================
// ORGANIZATION CRUD
// ==========================================

export async function createOrganization(data: {
  name: string;
  slug: string;
}) {
  const { user } = await requireAuth();

  // Check if slug is available
  const existing = await prisma.organization.findUnique({
    where: { slug: data.slug },
  });

  if (existing) {
    return {
      success: false,
      error: "Organization slug already taken",
    };
  }

  // Validate slug format
  const slugRegex = /^[a-z0-9-]+$/;
  if (!slugRegex.test(data.slug)) {
    return {
      success: false,
      error: "Slug can only contain lowercase letters, numbers, and hyphens",
    };
  }

  // Constraint: One organization per user (unless platform admin)
  if (user.role !== "admin") {
    const orgCount = await prisma.organization.count({
      where: { createdById: user.id },
    });

    if (orgCount >= 1) {
       return {
         success: false,
         error: "You can only create one organization on the free plan.",
       };
    }
  }

  try {
    // Create organization with free subscription
    const organization = await prisma.organization.create({
      data: {
        name: data.name,
        slug: data.slug,
        subscription: {
          create: {
            planId: "team_free",
            maxMembers: 3,
            scansPerMonth: 500,
            scansPerHourPerUser: 25,
            maxApiTokens: 1,
          },
        },
        members: {
          create: {
            userId: user.id,
            role: "admin",
          },
        },
      },
      include: {
        subscription: true,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/organizations");

    return {
      success: true,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      },
    };
  } catch (error) {
    console.error("Error creating organization:", error);
    return {
      success: false,
      error: "Failed to create organization",
    };
  }
}

export async function updateOrganization(
  organizationId: string,
  data: { name: string }
) {
  const { user } = await requireAuth();

  // Check if user is admin of this organization
  const membership = await prisma.organizationMember.findFirst({
    where: {
      organizationId,
      userId: user.id,
      role: "admin",
    },
  });

  if (!membership) {
    return {
      success: false,
      error: "You don't have permission to update this organization",
    };
  }

  try {
    await prisma.organization.update({
      where: { id: organizationId },
      data: { name: data.name },
    });

    revalidatePath("/organizations");
    revalidatePath(`/org/${organizationId}`);

    return { success: true };
  } catch (error) {
    console.error("Error updating organization:", error);
    return {
      success: false,
      error: "Failed to update organization",
    };
  }
}

export async function deleteOrganization(organizationId: string) {
  const { user } = await requireAuth();

  // Check if user is admin
  const membership = await prisma.organizationMember.findFirst({
    where: {
      organizationId,
      userId: user.id,
      role: "admin",
    },
  });

  if (!membership) {
    return {
      success: false,
      error: "You don't have permission to delete this organization",
    };
  }

  try {
    // Delete organization (cascade will handle members, subscription, etc.)
    await prisma.organization.delete({
      where: { id: organizationId },
    });

    revalidatePath("/dashboard");
    revalidatePath("/organizations");

    return { success: true };
  } catch (error) {
    console.error("Error deleting organization:", error);
    return {
      success: false,
      error: "Failed to delete organization",
    };
  }
}

// ==========================================
// MEMBER MANAGEMENT
// ==========================================

export async function inviteMember(
  organizationId: string,
  data: { email: string; role: "admin" | "member" }
) {
  const { user } = await requireAuth();

  // Check if user is admin
  const membership = await prisma.organizationMember.findFirst({
    where: {
      organizationId,
      userId: user.id,
      role: "admin",
    },
  });

  if (!membership) {
    return {
      success: false,
      error: "You don't have permission to invite members",
    };
  }

  // Check organization subscription limits
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      subscription: true,
      _count: {
        select: {
          members: {
            where: { },
          },
        },
      },
    },
  });

  if (!organization) {
    return {
      success: false,
      error: "Organization not found",
    };
  }

  const currentMemberCount = organization._count.members;
  const maxMembers = organization.subscription?.maxMembers || 3;

  if (currentMemberCount >= maxMembers) {
    return {
      success: false,
      error: `Member limit reached (${currentMemberCount}/${maxMembers}). Upgrade your plan to add more members.`,
    };
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser) {
    // Check if already a member
    const existingMembership = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: existingUser.id,
      },
    });

    if (existingMembership) {
      return {
        success: false,
        error: "User is already a member of this organization",
      };
    }

    // Add directly as member
    await prisma.organizationMember.create({
      data: {
        organizationId,
        userId: existingUser.id,
        role: data.role,
      },
    });

    revalidatePath(`/org/${organizationId}/members`);

    return {
      success: true,
      message: "User added to organization",
    };
  }

  // Create invite for non-existing user
  try {
    const inviteToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await prisma.organizationInvite.create({
      data: {
        organizationId,
        email: data.email,
        role: data.role,
        invitedBy: user.id,
        token: inviteToken,
        expiresAt,
      },
    });

    // TODO: Send invite email
    console.log(`Invite link: ${process.env.NEXT_PUBLIC_APP_URL}/invite/${inviteToken}`);

    revalidatePath(`/org/${organizationId}/members`);

    return {
      success: true,
      message: "Invitation sent",
      inviteLink: `/invite/${inviteToken}`,
    };
  } catch (error) {
    console.error("Error creating invite:", error);
    return {
      success: false,
      error: "Failed to create invitation",
    };
  }
}

export async function removeMember(
  organizationId: string,
  memberId: string
) {
  const { user } = await requireAuth();

  // Check if user is admin
  const adminMembership = await prisma.organizationMember.findFirst({
    where: {
      organizationId,
      userId: user.id,
      role: "admin",
    },
  });

  if (!adminMembership) {
    return {
      success: false,
      error: "You don't have permission to remove members",
    };
  }

  // Can't remove yourself if you're the last admin
  if (memberId === adminMembership.id) {
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

    revalidatePath(`/org/${organizationId}/members`);

    return { success: true };
  } catch (error) {
    console.error("Error removing member:", error);
    return {
      success: false,
      error: "Failed to remove member",
    };
  }
}

export async function updateMemberRole(
  organizationId: string,
  memberId: string,
  role: "admin" | "member"
) {
  const { user } = await requireAuth();

  // Check if user is admin
  const adminMembership = await prisma.organizationMember.findFirst({
    where: {
      organizationId,
      userId: user.id,
      role: "admin",
    },
  });

  if (!adminMembership) {
    return {
      success: false,
      error: "You don't have permission to change member roles",
    };
  }

  // If demoting yourself from admin, check if there's another admin
  if (memberId === adminMembership.id && role === "member") {
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

    revalidatePath(`/org/${organizationId}/members`);

    return { success: true };
  } catch (error) {
    console.error("Error updating member role:", error);
    return {
      success: false,
      error: "Failed to update member role",
    };
  }
}

// ==========================================
// INVITE ACCEPTANCE
// ==========================================

export async function acceptInvite(token: string) {
  const { user } = await requireAuth();

  const invite = await prisma.organizationInvite.findUnique({
    where: { token },
    include: {
      organization: true,
    },
  });

  if (!invite) {
    return {
      success: false,
      error: "Invalid invite",
    };
  }

  if (invite.expiresAt < new Date()) {
    return {
      success: false,
      error: "Invite has expired",
    };
  }

  // Check if user's email matches invite
  if (invite.email !== user.email) {
    return {
      success: false,
      error: "This invite was sent to a different email address",
    };
  }

  // Check if already a member
  const existingMembership = await prisma.organizationMember.findFirst({
    where: {
      organizationId: invite.organizationId,
      userId: user.id,
    },
  });

  if (existingMembership) {
    return {
      success: false,
      error: "You are already a member of this organization",
    };
  }

  try {
    // Add as member and delete invite
    await prisma.$transaction([
      prisma.organizationMember.create({
        data: {
          organizationId: invite.organizationId,
          userId: user.id,
          role: invite.role,
        },
      }),
      prisma.organizationInvite.delete({
        where: { id: invite.id },
      }),
    ]);

    revalidatePath("/dashboard");
    revalidatePath(`/org/${invite.organization.slug}`);

    return {
      success: true,
      organizationSlug: invite.organization.slug,
    };
  } catch (error) {
    console.error("Error accepting invite:", error);
    return {
      success: false,
      error: "Failed to accept invitation",
    };
  }
}

export async function cancelInvite(inviteId: string) {
  const { user } = await requireAuth();

  const invite = await prisma.organizationInvite.findUnique({
    where: { id: inviteId },
    include: {
      organization: {
        include: {
          members: {
            where: {
              userId: user.id,
              role: "admin",
            },
          },
        },
      },
    },
  });

  if (!invite) {
    return {
      success: false,
      error: "Invite not found",
    };
  }

  if (invite.organization.members.length === 0) {
    return {
      success: false,
      error: "You don't have permission to cancel this invite",
    };
  }

  try {
    await prisma.organizationInvite.delete({
      where: { id: inviteId },
    });

    revalidatePath(`/org/${invite.organizationId}/members`);

    return { success: true };
  } catch (error) {
    console.error("Error canceling invite:", error);
    return {
      success: false,
      error: "Failed to cancel invite",
    };
  }
}

// ==========================================
// QUERIES
// ==========================================

export async function getOrganization(slug: string) {
  const { user } = await requireAuth();

  const organization = await prisma.organization.findUnique({
    where: { slug },
    include: {
      subscription: true,
      members: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              image: true,
            },
          },
        },
        orderBy: { joinedAt: "asc" },
      },
      invites: {
        where: {
          expiresAt: { gte: new Date() },
        },
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: {
          scans: true,
        },
      },
    },
  });

  if (!organization) {
    return null;
  }

  // Check if user is a member
  const isMember = organization.members.some((m) => m.userId === user.id);

  if (!isMember) {
    return null;
  }

  return organization;
}

export async function getUserOrganizations() {
  const { user } = await requireAuth();

  if (user.role === "admin") {
    const organizations = await prisma.organization.findMany({
      include: {
        subscription: true,
        members: {
          where: { role: "admin" },
          include: { user: true },
        },
        _count: {
          select: {
            members: true,
            scans: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return organizations.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      role: "Super Admin",
      subscription: org.subscription,
      memberCount: org._count.members,
      scanCount: org._count.scans,
      joinedAt: org.createdAt,
      admins: org.members.map((m) => m.user),
    }));
  }

  const memberships = await prisma.organizationMember.findMany({
    where: {
      userId: user.id,
    },
    include: {
      organization: {
        include: {
          subscription: true,
          members: {
            where: { role: "admin" },
            include: { user: true },
          },
          _count: {
            select: {
              members: true,
              scans: true,
            },
          },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  return memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    role: m.role,
    subscription: m.organization.subscription,
    memberCount: m.organization._count.members,
    scanCount: m.organization._count.scans,
    joinedAt: m.joinedAt,
    admins: m.organization.members.map((mem) => mem.user),
  }));
}
