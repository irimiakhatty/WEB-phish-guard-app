"use server";

import prisma from "@phish-guard-app/db";
import { requireAuth } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { getPlanById, isTeamPlan } from "@/lib/subscription-plans";
import { sendInviteEmail } from "@/lib/email";
import { auth } from "@phish-guard-app/auth";
import { isPasswordStrong, PASSWORD_POLICY_ERROR } from "@/lib/password-policy";
import { sanitizeOrganizationName, toOrganizationNameKey } from "@/lib/organization-name";

const INVITE_TTL_DAYS = Number(process.env.INVITE_LINK_TTL_DAYS || 7);
const prismaAny = prisma as any;

const ACTIVE_INVITE_STATUSES: Array<"pending" | "sent" | "failed"> = [
  "pending",
  "sent",
  "failed",
];

function getInviteExpiryDate() {
  const expiresAt = new Date();
  expiresAt.setDate(
    expiresAt.getDate() + (Number.isFinite(INVITE_TTL_DAYS) && INVITE_TTL_DAYS > 0 ? INVITE_TTL_DAYS : 7)
  );
  return expiresAt;
}

function getAppBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3001";
}

function buildInviteLink(token: string) {
  return `${getAppBaseUrl()}/invite/${token}`;
}

async function logInviteDelivery(params: {
  inviteId: string;
  organizationId: string;
  recipientEmail: string;
  status: "sent" | "failed" | "skipped";
  providerMessageId?: string | null;
  error?: string | null;
  metadata?: unknown;
}) {
  const { inviteId, organizationId, recipientEmail, status, providerMessageId, error, metadata } = params;

  await prismaAny.emailDeliveryLog.create({
    data: {
      inviteId,
      organizationId,
      recipientEmail,
      status,
      providerMessageId: providerMessageId || null,
      error: error || null,
      metadata: metadata ? (metadata as any) : undefined,
    },
  });
}

async function markInviteExpired(inviteId: string) {
  await prismaAny.organizationInvite.updateMany({
    where: {
      id: inviteId,
      status: { in: ACTIVE_INVITE_STATUSES },
    },
    data: {
      status: "expired",
    },
  });
}

async function dispatchInviteEmail(params: {
  inviteId: string;
  organizationId: string;
  email: string;
  token: string;
  orgName: string;
  inviterName?: string | null;
}) {
  const { inviteId, organizationId, email, token, orgName, inviterName } = params;
  const inviteLink = buildInviteLink(token);
  const now = new Date();

  const emailResult = await sendInviteEmail({
    to: email,
    link: inviteLink,
    orgName,
    inviterName: inviterName || undefined,
  });

  const nextInviteStatus = emailResult.status === "sent" ? "sent" : "failed";

  await prismaAny.organizationInvite.update({
    where: { id: inviteId },
    data: {
      status: nextInviteStatus,
      sendAttempts: { increment: 1 },
      lastSentAt: now,
      lastError: emailResult.error ?? null,
    },
  });

  await logInviteDelivery({
    inviteId,
    organizationId,
    recipientEmail: email,
    status: emailResult.status,
    providerMessageId: emailResult.messageId ?? null,
    error: emailResult.error ?? null,
    metadata: {
      inviteLink,
    },
  });

  return {
    inviteLink,
    emailResult,
  };
}

// ==========================================
// ORGANIZATION CRUD
// ==========================================

export async function createOrganization(data: {
  name: string;
  slug: string;
}) {
  const { user } = await requireAuth();
  const sanitizedName = sanitizeOrganizationName(data.name);
  const organizationNameKey = toOrganizationNameKey(sanitizedName);

  if (sanitizedName.length < 2) {
    return {
      success: false,
      error: "Organization name must be at least 2 characters",
    };
  }

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

  // Validate slug format
  const slugRegex = /^[a-z0-9-]+$/;
  if (!slugRegex.test(data.slug)) {
    return {
      success: false,
      error: "Slug can only contain lowercase letters, numbers, and hyphens",
    };
  }

  // Constraint: One organization per user (unless platform admin)
  if (user.role !== "super_admin") {
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
        name: sanitizedName,
        nameNormalized: organizationNameKey,
        slug: data.slug,
        createdById: user.id,
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
    const err = error as { code?: string; meta?: { target?: string[] } };
    const hasOrganizationNameUniqueViolation =
      err.meta?.target?.some(
        (target) =>
          target === "nameNormalized" ||
          target === "name_normalized" ||
          target === "organization_name_normalized_key",
      ) ?? false;
    if (err.code === "P2002" && hasOrganizationNameUniqueViolation) {
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
  organizationId: string,
  data: { name: string }
) {
  const { user } = await requireAuth();
  const isSuperAdmin = user.role === "super_admin";
  const sanitizedName = sanitizeOrganizationName(data.name);
  const organizationNameKey = toOrganizationNameKey(sanitizedName);

  if (sanitizedName.length < 2) {
    return {
      success: false,
      error: "Organization name must be at least 2 characters",
    };
  }

  // Check if user is admin of this organization
  if (!isSuperAdmin) {
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
  }

  try {
    await prisma.organization.update({
      where: { id: organizationId },
      data: { name: sanitizedName, nameNormalized: organizationNameKey },
    });

    revalidatePath("/organizations");
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { slug: true },
    });
    revalidatePath(`/org/${org?.slug || organizationId}`);

    return { success: true };
  } catch (error) {
    const err = error as { code?: string; meta?: { target?: string[] } };
    const hasOrganizationNameUniqueViolation =
      err.meta?.target?.some(
        (target) =>
          target === "nameNormalized" ||
          target === "name_normalized" ||
          target === "organization_name_normalized_key",
      ) ?? false;
    if (err.code === "P2002" && hasOrganizationNameUniqueViolation) {
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

export async function deleteOrganization(organizationId: string) {
  const { user } = await requireAuth();
  const isSuperAdmin = user.role === "super_admin";

  // Check if user is admin
  if (!isSuperAdmin) {
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
  const isSuperAdmin = user.role === "super_admin";
  const normalizedEmail = data.email.trim().toLowerCase();

  // Check if user is admin
  if (!isSuperAdmin) {
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

  const existingActiveInvite = await prisma.organizationInvite.findFirst({
    where: {
      organizationId,
      email: normalizedEmail,
      status: { in: ACTIVE_INVITE_STATUSES },
      expiresAt: { gte: new Date() },
    },
    select: {
      id: true,
    },
  });

  if (existingActiveInvite) {
    return {
      success: false,
      error: "An active invite already exists for this email. Use resend instead.",
      inviteId: existingActiveInvite.id,
    };
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
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

    revalidatePath(`/org/${organization.slug}/members`);
    revalidatePath(`/org/${organization.slug}`);

    return {
      success: true,
      message: "User added to organization",
    };
  }

  // Create invite for non-existing user
  try {
    const inviteToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = getInviteExpiryDate();

    const invite = await prisma.organizationInvite.create({
      data: {
        organizationId,
        email: normalizedEmail,
        role: data.role,
        invitedById: user.id,
        token: inviteToken,
        expiresAt,
      },
    });

    const { inviteLink, emailResult } = await dispatchInviteEmail({
      inviteId: invite.id,
      organizationId,
      email: normalizedEmail,
      token: inviteToken,
      orgName: organization.name,
      inviterName: user.name || user.email,
    });

    revalidatePath(`/org/${organization.slug}`);
    revalidatePath(`/org/${organization.slug}/members`);

    if (!emailResult.sent) {
      return {
        success: false,
        error:
          "Invite created, but email could not be delivered. Use copy invite link to share it manually.",
        inviteLink,
        inviteId: invite.id,
      };
    }

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

export async function bulkInviteMembers(
  organizationId: string,
  invites: Array<{ email: string; role?: "admin" | "member"; name?: string; department?: string }>
) {
  const { user } = await requireAuth();
  const isSuperAdmin = user.role === "super_admin";

  if (!isSuperAdmin) {
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
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      subscription: true,
      _count: {
        select: {
          members: true,
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

  let availableSlots = (organization.subscription?.maxMembers || 3) - organization._count.members;
  const results: Array<{ email: string; status: "invited" | "added" | "skipped"; message: string }> = [];

  const seen = new Set<string>();
  for (const invite of invites) {
    const email = (invite.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      results.push({ email: invite.email || "", status: "skipped", message: "Invalid email" });
      continue;
    }
    if (seen.has(email)) {
      results.push({ email, status: "skipped", message: "Duplicate entry" });
      continue;
    }
    seen.add(email);

    if (availableSlots <= 0) {
      results.push({ email, status: "skipped", message: "Member limit reached" });
      continue;
    }

    const role = invite.role === "admin" ? "admin" : "member";

    const existingActiveInvite = await prisma.organizationInvite.findFirst({
      where: {
        organizationId,
        email,
        status: { in: ACTIVE_INVITE_STATUSES },
        expiresAt: { gte: new Date() },
      },
      select: { id: true },
    });

    if (existingActiveInvite) {
      results.push({ email, status: "skipped", message: "Active invite already exists" });
      continue;
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      const existingMembership = await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId: existingUser.id,
        },
      });

      if (existingMembership) {
        results.push({ email, status: "skipped", message: "Already a member" });
        continue;
      }

      await prisma.organizationMember.create({
        data: {
          organizationId,
          userId: existingUser.id,
          role,
        },
      });

      availableSlots -= 1;
      results.push({ email, status: "added", message: "Added existing user" });
      continue;
    }

    try {
      const inviteToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = getInviteExpiryDate();

      const createdInvite = await prisma.organizationInvite.create({
        data: {
          organizationId,
          email,
          role,
          invitedById: user.id,
          token: inviteToken,
          expiresAt,
        },
      });

      const { emailResult } = await dispatchInviteEmail({
        inviteId: createdInvite.id,
        organizationId,
        email,
        token: inviteToken,
        orgName: organization.name,
        inviterName: user.name || user.email,
      });

      availableSlots -= 1;

      if (emailResult.sent) {
        results.push({ email, status: "invited", message: "Invitation sent" });
      } else {
        results.push({
          email,
          status: "skipped",
          message: "Invite created, but email delivery failed (use copy invite link).",
        });
      }
    } catch (error) {
      console.error("Error creating bulk invite:", error);
      results.push({ email, status: "skipped", message: "Failed to send invite" });
    }
  }

  revalidatePath(`/org/${organization.slug}`);
  revalidatePath(`/org/${organization.slug}/members`);

  return {
    success: true,
    summary: {
      invited: results.filter((r) => r.status === "invited").length,
      added: results.filter((r) => r.status === "added").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      total: results.length,
    },
    results,
  };
}

// Accept invite with signup (new user)
export async function acceptInviteSignUp(input: { token: string; name: string; password: string }) {
  const { token, name, password } = input;
  if (!isPasswordStrong(password)) {
    return { success: false, error: PASSWORD_POLICY_ERROR };
  }

  const invite = await prisma.organizationInvite.findUnique({
    where: { token },
  });

  if (!invite) {
    return { success: false, error: "Invalid or expired invite" };
  }

  if (invite.status === "accepted") {
    return { success: false, error: "This invite has already been accepted." };
  }

  if (invite.status === "canceled") {
    return { success: false, error: "This invite was canceled by an admin." };
  }

  if (invite.status === "expired") {
    return { success: false, error: "Invite expired" };
  }

  if (invite.expiresAt < new Date()) {
    await markInviteExpired(invite.id);
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

    await prismaAny.organizationInvite.update({
      where: { id: invite.id },
      data: {
        status: "accepted",
        acceptedAt: new Date(),
        consumedById: existingUser.id,
        lastError: null,
      },
    });

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

  await prisma.$transaction([
    prisma.organizationMember.create({
      data: {
        organizationId: invite.organizationId,
        userId: created.user.id,
        role: invite.role,
      },
    }),
    prismaAny.organizationInvite.update({
      where: { id: invite.id },
      data: {
        status: "accepted",
        acceptedAt: new Date(),
        consumedById: created.user.id,
        lastError: null,
      },
    }),
  ]);

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
  const isSuperAdmin = user.role === "super_admin";

  // Check if user is admin
  const adminMembership = isSuperAdmin
    ? null
    : await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId: user.id,
          role: "admin",
        },
      });

  if (!isSuperAdmin && !adminMembership) {
    return {
      success: false,
      error: "You don't have permission to remove members",
    };
  }

  // Can't remove yourself if you're the last admin
  if (!isSuperAdmin && adminMembership && memberId === adminMembership.id) {
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

    revalidatePath(`/org/${org?.slug || organizationId}/members`);
    revalidatePath(`/org/${org?.slug || organizationId}`);

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
  const isSuperAdmin = user.role === "super_admin";

  // Check if user is admin
  const adminMembership = isSuperAdmin
    ? null
    : await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId: user.id,
          role: "admin",
        },
      });

  if (!isSuperAdmin && !adminMembership) {
    return {
      success: false,
      error: "You don't have permission to change member roles",
    };
  }

  // If demoting yourself from admin, check if there's another admin
  if (!isSuperAdmin && adminMembership && memberId === adminMembership.id && role === "member") {
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

    revalidatePath(`/org/${org?.slug || organizationId}/members`);
    revalidatePath(`/org/${org?.slug || organizationId}`);

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

  if (invite.status === "accepted") {
    return {
      success: false,
      error: "This invite has already been accepted.",
    };
  }

  if (invite.status === "canceled") {
    return {
      success: false,
      error: "This invite was canceled by an admin.",
    };
  }

  if (invite.status === "expired") {
    return {
      success: false,
      error: "Invite has expired",
    };
  }

  if (invite.expiresAt < new Date()) {
    await markInviteExpired(invite.id);
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
    await prismaAny.organizationInvite.update({
      where: { id: invite.id },
      data: {
        status: "accepted",
        acceptedAt: new Date(),
        consumedById: user.id,
        lastError: null,
      },
    });

    return {
      success: false,
      error: "You are already a member of this organization",
    };
  }

  try {
    // Add as member and mark invite accepted
    await prisma.$transaction([
      prisma.organizationMember.create({
        data: {
          organizationId: invite.organizationId,
          userId: user.id,
          role: invite.role,
        },
      }),
      prismaAny.organizationInvite.update({
        where: { id: invite.id },
        data: {
          status: "accepted",
          acceptedAt: new Date(),
          consumedById: user.id,
          lastError: null,
        },
      }),
    ]);

    revalidatePath("/dashboard");
    revalidatePath(`/org/${invite.organization.slug}`);
    revalidatePath(`/org/${invite.organization.slug}/members`);

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

export async function resendInvite(inviteId: string) {
  const { user } = await requireAuth();
  const isSuperAdmin = user.role === "super_admin";

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

  if (!isSuperAdmin && invite.organization.members.length === 0) {
    return {
      success: false,
      error: "You don't have permission to resend this invite",
    };
  }

  if (invite.status === "accepted") {
    return {
      success: false,
      error: "This invite has already been accepted.",
    };
  }

  if (invite.status === "canceled") {
    return {
      success: false,
      error: "This invite has been canceled.",
    };
  }

  let token = invite.token;
  const now = new Date();
  const isExpired = invite.expiresAt < now || invite.status === "expired";

  if (isExpired) {
    token = crypto.randomBytes(32).toString("hex");
    await prismaAny.organizationInvite.update({
      where: { id: invite.id },
      data: {
        token,
        expiresAt: getInviteExpiryDate(),
        status: "pending",
        lastError: null,
      },
    });
  } else if (invite.status === "failed") {
    await prismaAny.organizationInvite.update({
      where: { id: invite.id },
      data: {
        status: "pending",
      },
    });
  }

  const { inviteLink, emailResult } = await dispatchInviteEmail({
    inviteId: invite.id,
    organizationId: invite.organizationId,
    email: invite.email,
    token,
    orgName: invite.organization.name,
    inviterName: user.name || user.email,
  });

  revalidatePath(`/org/${invite.organization.slug}`);
  revalidatePath(`/org/${invite.organization.slug}/members`);

  if (!emailResult.sent) {
    return {
      success: false,
      error: "Email could not be delivered. Copy the invite link and share it manually.",
      inviteLink,
    };
  }

  return {
    success: true,
    message: "Invitation resent",
    inviteLink,
  };
}

export async function copyInviteLink(inviteId: string) {
  const { user } = await requireAuth();
  const isSuperAdmin = user.role === "super_admin";

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

  if (!isSuperAdmin && invite.organization.members.length === 0) {
    return {
      success: false,
      error: "You don't have permission to access this invite link",
    };
  }

  if (invite.status === "accepted") {
    return {
      success: false,
      error: "This invite has already been accepted.",
    };
  }

  if (invite.status === "canceled") {
    return {
      success: false,
      error: "This invite has been canceled.",
    };
  }

  let token = invite.token;
  const now = new Date();
  const isExpired = invite.expiresAt < now || invite.status === "expired";

  if (isExpired) {
    token = crypto.randomBytes(32).toString("hex");
    await prismaAny.organizationInvite.update({
      where: { id: invite.id },
      data: {
        token,
        expiresAt: getInviteExpiryDate(),
        status: "pending",
        lastError: null,
      },
    });
    revalidatePath(`/org/${invite.organization.slug}`);
    revalidatePath(`/org/${invite.organization.slug}/members`);
  }

  return {
    success: true,
    inviteLink: buildInviteLink(token),
  };
}

export async function cancelInvite(inviteId: string) {
  const { user } = await requireAuth();
  const isSuperAdmin = user.role === "super_admin";

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

  if (!isSuperAdmin && invite.organization.members.length === 0) {
    return {
      success: false,
      error: "You don't have permission to cancel this invite",
    };
  }

  if (invite.status === "accepted") {
    return {
      success: false,
      error: "Cannot cancel an invite that was already accepted.",
    };
  }

  if (invite.status === "canceled") {
    return { success: true };
  }

  try {
    await prismaAny.organizationInvite.update({
      where: { id: inviteId },
      data: {
        status: "canceled",
        canceledAt: new Date(),
      },
    });

    revalidatePath(`/org/${invite.organization.slug}`);
    revalidatePath(`/org/${invite.organization.slug}/members`);

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
  const isSuperAdmin = user.role === "super_admin";

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
          status: { in: ACTIVE_INVITE_STATUSES },
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

  // Check if user is a member (super admin can access any organization)
  const isMember = organization.members.some((m) => m.userId === user.id);

  if (!isSuperAdmin && !isMember) {
    return null;
  }

  return organization;
}

export async function getUserOrganizations() {
  const { user } = await requireAuth();

  if (user.role === "super_admin") {
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
