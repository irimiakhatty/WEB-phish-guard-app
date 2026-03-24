import crypto from "crypto";
import prisma from "@phish-guard-app/db";
import { auth } from "@phish-guard-app/auth";
import {
  PASSWORD_POLICY_ERROR,
  isPasswordStrong,
  isSuperAdmin,
} from "./helpers";
import {
  ACTIVE_INVITE_STATUSES,
  buildInviteLink,
  dispatchInviteEmail,
  ensureUnassignedDepartment,
  findOrCreateDepartmentByName,
  getInviteExpiryDate,
  markInviteExpired,
  prismaAny,
} from "./shared";
import type { InviteEmailSender, OrganizationActor } from "./types";

export async function inviteMember(
  actor: OrganizationActor,
  sendInviteEmail: InviteEmailSender,
  organizationId: string,
  data: { email: string; role: "admin" | "member"; departmentName?: string }
) {
  const actorIsSuperAdmin = isSuperAdmin(actor);
  const normalizedEmail = data.email.trim().toLowerCase();

  if (!actorIsSuperAdmin) {
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
          members: {
            where: {},
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

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
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

    const departmentId =
      (await findOrCreateDepartmentByName(organizationId, data.departmentName)) ??
      (await ensureUnassignedDepartment(organizationId));

    await prisma.organizationMember.create({
      data: {
        organizationId,
        userId: existingUser.id,
        role: data.role,
        departmentId,
      },
    });

    return {
      success: true,
      message: "User added to organization",
      revalidatePaths: [`/org/${organization.slug}/members`, `/org/${organization.slug}`],
    };
  }

  try {
    const inviteToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = getInviteExpiryDate();

    const invite = await prisma.organizationInvite.create({
      data: {
        organizationId,
        email: normalizedEmail,
        role: data.role,
        invitedById: actor.id,
        token: inviteToken,
        expiresAt,
      },
    });

    const { inviteLink, emailResult } = await dispatchInviteEmail(sendInviteEmail, {
      inviteId: invite.id,
      organizationId,
      email: normalizedEmail,
      token: inviteToken,
      orgName: organization.name,
      inviterName: actor.name || actor.email,
    });

    const revalidatePaths = [`/org/${organization.slug}`, `/org/${organization.slug}/members`];

    if (!emailResult.sent) {
      return {
        success: false,
        error:
          "Invite created, but email could not be delivered. Use copy invite link to share it manually.",
        inviteLink,
        inviteId: invite.id,
        revalidatePaths,
      };
    }

    return {
      success: true,
      message: "Invitation sent",
      inviteLink,
      inviteId: invite.id,
      revalidatePaths,
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
  actor: OrganizationActor,
  sendInviteEmail: InviteEmailSender,
  organizationId: string,
  invites: Array<{ email: string; role?: "admin" | "member"; name?: string; department?: string }>
) {
  const actorIsSuperAdmin = isSuperAdmin(actor);

  if (!actorIsSuperAdmin) {
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
  const results: Array<{ email: string; status: "invited" | "added" | "skipped"; message: string }> =
    [];

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

      const departmentId =
        (await findOrCreateDepartmentByName(organizationId, invite.department)) ??
        (await ensureUnassignedDepartment(organizationId));

      await prisma.organizationMember.create({
        data: {
          organizationId,
          userId: existingUser.id,
          role,
          departmentId,
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
          invitedById: actor.id,
          token: inviteToken,
          expiresAt,
        },
      });

      const { emailResult } = await dispatchInviteEmail(sendInviteEmail, {
        inviteId: createdInvite.id,
        organizationId,
        email,
        token: inviteToken,
        orgName: organization.name,
        inviterName: actor.name || actor.email,
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

  return {
    success: true,
    summary: {
      invited: results.filter((r) => r.status === "invited").length,
      added: results.filter((r) => r.status === "added").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      total: results.length,
    },
    results,
    revalidatePaths: [`/org/${organization.slug}`, `/org/${organization.slug}/members`],
  };
}

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

  const existingUser = await prisma.user.findUnique({
    where: { email: invite.email },
  });

  if (existingUser) {
    const membership = await prisma.organizationMember.findFirst({
      where: { organizationId: invite.organizationId, userId: existingUser.id },
    });
    if (!membership) {
      const departmentId = await ensureUnassignedDepartment(invite.organizationId);
      await prisma.organizationMember.create({
        data: {
          organizationId: invite.organizationId,
          userId: existingUser.id,
          role: invite.role,
          departmentId,
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

  const departmentId = await ensureUnassignedDepartment(invite.organizationId);

  await prisma.$transaction([
    prisma.organizationMember.create({
      data: {
        organizationId: invite.organizationId,
        userId: created.user.id,
        role: invite.role,
        departmentId,
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

  const org = await prisma.organization.findUnique({
    where: { id: invite.organizationId },
    select: { slug: true },
  });

  return { success: true, email: invite.email, orgSlug: org?.slug };
}

export async function acceptInvite(actor: OrganizationActor, token: string) {
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

  if (invite.email !== actor.email) {
    return {
      success: false,
      error: "This invite was sent to a different email address",
    };
  }

  const existingMembership = await prisma.organizationMember.findFirst({
    where: {
      organizationId: invite.organizationId,
      userId: actor.id,
    },
  });

  if (existingMembership) {
    await prismaAny.organizationInvite.update({
      where: { id: invite.id },
      data: {
        status: "accepted",
        acceptedAt: new Date(),
        consumedById: actor.id,
        lastError: null,
      },
    });

    return {
      success: false,
      error: "You are already a member of this organization",
    };
  }

  try {
    const departmentId = await ensureUnassignedDepartment(invite.organizationId);

    await prisma.$transaction([
      prisma.organizationMember.create({
        data: {
          organizationId: invite.organizationId,
          userId: actor.id,
          role: invite.role,
          departmentId,
        },
      }),
      prismaAny.organizationInvite.update({
        where: { id: invite.id },
        data: {
          status: "accepted",
          acceptedAt: new Date(),
          consumedById: actor.id,
          lastError: null,
        },
      }),
    ]);

    return {
      success: true,
      organizationSlug: invite.organization.slug,
      revalidatePaths: [
        "/dashboard",
        `/org/${invite.organization.slug}`,
        `/org/${invite.organization.slug}/members`,
      ],
    };
  } catch (error) {
    console.error("Error accepting invite:", error);
    return {
      success: false,
      error: "Failed to accept invitation",
    };
  }
}

export async function resendInvite(
  actor: OrganizationActor,
  sendInviteEmail: InviteEmailSender,
  inviteId: string
) {
  const actorIsSuperAdmin = isSuperAdmin(actor);

  const invite = await prisma.organizationInvite.findUnique({
    where: { id: inviteId },
    include: {
      organization: {
        include: {
          members: {
            where: {
              userId: actor.id,
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

  if (!actorIsSuperAdmin && invite.organization.members.length === 0) {
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
  const expired = invite.expiresAt < now || invite.status === "expired";

  if (expired) {
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

  const { inviteLink, emailResult } = await dispatchInviteEmail(sendInviteEmail, {
    inviteId: invite.id,
    organizationId: invite.organizationId,
    email: invite.email,
    token,
    orgName: invite.organization.name,
    inviterName: actor.name || actor.email,
  });

  const revalidatePaths = [`/org/${invite.organization.slug}`, `/org/${invite.organization.slug}/members`];

  if (!emailResult.sent) {
    return {
      success: false,
      error: "Email could not be delivered. Copy the invite link and share it manually.",
      inviteLink,
      revalidatePaths,
    };
  }

  return {
    success: true,
    message: "Invitation resent",
    inviteLink,
    revalidatePaths,
  };
}

export async function copyInviteLink(actor: OrganizationActor, inviteId: string) {
  const actorIsSuperAdmin = isSuperAdmin(actor);

  const invite = await prisma.organizationInvite.findUnique({
    where: { id: inviteId },
    include: {
      organization: {
        include: {
          members: {
            where: {
              userId: actor.id,
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

  if (!actorIsSuperAdmin && invite.organization.members.length === 0) {
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
  const expired = invite.expiresAt < now || invite.status === "expired";
  const revalidatePaths: string[] = [];

  if (expired) {
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
    revalidatePaths.push(`/org/${invite.organization.slug}`, `/org/${invite.organization.slug}/members`);
  }

  return {
    success: true,
    inviteLink: buildInviteLink(token),
    revalidatePaths,
  };
}

export async function cancelInvite(actor: OrganizationActor, inviteId: string) {
  const actorIsSuperAdmin = isSuperAdmin(actor);

  const invite = await prisma.organizationInvite.findUnique({
    where: { id: inviteId },
    include: {
      organization: {
        include: {
          members: {
            where: {
              userId: actor.id,
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

  if (!actorIsSuperAdmin && invite.organization.members.length === 0) {
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

    return {
      success: true,
      revalidatePaths: [`/org/${invite.organization.slug}`, `/org/${invite.organization.slug}/members`],
    };
  } catch (error) {
    console.error("Error canceling invite:", error);
    return {
      success: false,
      error: "Failed to cancel invite",
    };
  }
}