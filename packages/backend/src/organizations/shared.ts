import prisma from "@phish-guard-app/db";
import type { InviteEmailSender, InviteEmailSendResult } from "./types";

const INVITE_TTL_DAYS = Number(process.env.INVITE_LINK_TTL_DAYS || 7);

type InviteDeliveryMetadata = {
  inviteLink: string;
};

export const prismaAny = prisma;

export const ACTIVE_INVITE_STATUSES: Array<"pending" | "sent" | "failed"> = [
  "pending",
  "sent",
  "failed",
];

export function getInviteExpiryDate() {
  const expiresAt = new Date();
  expiresAt.setDate(
    expiresAt.getDate() +
      (Number.isFinite(INVITE_TTL_DAYS) && INVITE_TTL_DAYS > 0 ? INVITE_TTL_DAYS : 7)
  );
  return expiresAt;
}

function getAppBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3001";
}

export function buildInviteLink(token: string) {
  return `${getAppBaseUrl()}/invite/${token}`;
}

export function toDepartmentNameKey(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function ensureUnassignedDepartment(organizationId: string) {
  const existing = await prisma.organizationDepartment.findFirst({
    where: {
      organizationId,
      nameNormalized: "unassigned",
    },
    select: { id: true },
  });

  if (existing) {
    return existing.id;
  }

  const created = await prisma.organizationDepartment.create({
    data: {
      organizationId,
      name: "Unassigned",
      nameNormalized: "unassigned",
    },
    select: { id: true },
  });

  return created.id;
}

export async function findOrCreateDepartmentByName(organizationId: string, name?: string | null) {
  const cleanedName = (name || "").trim();
  if (!cleanedName) {
    return null;
  }

  const normalizedName = toDepartmentNameKey(cleanedName);
  if (!normalizedName) {
    return null;
  }

  const existing = await prisma.organizationDepartment.findFirst({
    where: {
      organizationId,
      nameNormalized: normalizedName,
    },
    select: { id: true },
  });

  if (existing) {
    return existing.id;
  }

  const created = await prisma.organizationDepartment.create({
    data: {
      organizationId,
      name: cleanedName,
      nameNormalized: normalizedName,
    },
    select: { id: true },
  });

  return created.id;
}

async function logInviteDelivery(params: {
  inviteId: string;
  organizationId: string;
  recipientEmail: string;
  status: "sent" | "failed" | "skipped";
  providerMessageId?: string | null;
  error?: string | null;
  metadata?: InviteDeliveryMetadata;
}) {
  const { inviteId, organizationId, recipientEmail, status, providerMessageId, error, metadata } =
    params;

  await prismaAny.emailDeliveryLog.create({
    data: {
      inviteId,
      organizationId,
      recipientEmail,
      status,
      providerMessageId: providerMessageId || null,
      error: error || null,
      metadata,
    },
  });
}

export async function markInviteExpired(inviteId: string) {
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

export async function dispatchInviteEmail(
  sendInviteEmail: InviteEmailSender,
  params: {
    inviteId: string;
    organizationId: string;
    email: string;
    token: string;
    orgName: string;
    inviterName?: string | null;
  }
) {
  const { inviteId, organizationId, email, token, orgName, inviterName } = params;
  const inviteLink = buildInviteLink(token);
  const now = new Date();

  const emailResult = (await sendInviteEmail({
    to: email,
    link: inviteLink,
    orgName,
    inviterName: inviterName || undefined,
  })) as InviteEmailSendResult;

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