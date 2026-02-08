"use server";

import prisma from "@phish-guard-app/db";
import { requireAuth } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { getPlanById, isTeamPlan } from "@/lib/subscription-plans";
import { sendInviteEmail } from "@/lib/email";
import { auth } from "@phish-guard-app/auth";

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
            plan: "team_free",
            status: "active",
            maxMembers: 3,
            scansPerMonth: 500,
            scansPerHourPerUser: 25,
            maxApiTokens: 1,
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 zile
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
// PLAN UPGRADE
// ==========================================

export async function upgradeOrganizationPlan(
  organizationId: string,
  targetPlanId: string
) {
  const { user } = await requireAuth();

  // Ensure requester is admin of org
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
      error: "You don't have permission to upgrade this organization",
    };
  }

  // Validate plan
  if (!isTeamPlan(targetPlanId as any)) {
    return { success: false, error: "Invalid team plan" };
  }

  const plan = getPlanById(targetPlanId as any);

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { slug: true },
  });

  // Apply plan to subscription
  await prisma.subscription.update({
    where: { organizationId },
    data: {
      plan: targetPlanId,
      status: "active",
      maxMembers: (plan.features as any).maxMembers ?? 3,
      scansPerMonth: (plan.features as any).scansPerMonth ?? 500,
      scansPerHourPerUser: (plan.features as any).scansPerHourPerUser ?? 25,
      maxApiTokens: (plan.features as any).maxApiTokens ?? 1,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 days
    },
  });

  revalidatePath("/dashboard");
  if (org?.slug) {
    revalidatePath(`/org/${org.slug}`);
  }

  return { success: true, plan: targetPlanId };
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

    const invite = await prisma.organizationInvite.create({
      data: {
        organizationId,
        email: data.email,
        role: data.role,
        invitedById: user.id,
        token: inviteToken,
        expiresAt,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3001";
    const inviteLink = `${appUrl}/invite/${inviteToken}`;

    await sendInviteEmail({
      to: data.email,
      link: inviteLink,
      orgName: organization.name,
      inviterName: user.name || user.email,
    });

    revalidatePath(`/org/${organization.slug}`);

    return {
      success: true,
      message: "Invitation sent",
      inviteLink,
      inviteId: invite.id,
    };
  } catch (error) {
    console.error("Error creating invite:", error);
    return {
      success: false,
      error: "Failed to create invitation",
    };
  }
}

// Accept invite with signup (new user)
export async function acceptInviteSignUp(input: { token: string; name: string; password: string }) {
  const { token, name, password } = input;

  const invite = await prisma.organizationInvite.findUnique({
    where: { token },
  });

  if (!invite) {
    return { success: false, error: "Invalid or expired invite" };
  }

  if (invite.expiresAt < new Date()) {
    return { success: false, error: "Invite expired" };
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: invite.email },
  });

  if (existingUser) {
    // Ensure membership exists or create it
    const membership = await prisma.organizationMember.findFirst({
      where: { organizationId: invite.organizationId, userId: existingUser.id },
    });
    if (!membership) {
      await prisma.organizationMember.create({
        data: {
          organizationId: invite.organizationId,
          userId: existingUser.id,
          role: invite.role,
        },
      });
    }
    // Consume invite
    await prisma.organizationInvite.delete({ where: { id: invite.id } });
    return { success: false, code: "USER_EXISTS", email: invite.email };
  }

  // Create new user via better-auth
  const created = await auth.api.signUpEmail({
    body: {
      email: invite.email,
      password,
      name,
    },
  });

  if (!created) {
    return { success: false, error: "Failed to create user" };
  }

  // Add membership
  await prisma.organizationMember.create({
    data: {
      organizationId: invite.organizationId,
      userId: created.user.id,
      role: invite.role,
    },
  });

  // Default personal subscription optional (skip)

  // Consume invite
  await prisma.organizationInvite.delete({ where: { id: invite.id } });

  // Get org slug
  const org = await prisma.organization.findUnique({
    where: { id: invite.organizationId },
    select: { slug: true },
  });

  return { success: true, email: invite.email, orgSlug: org?.slug };
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
