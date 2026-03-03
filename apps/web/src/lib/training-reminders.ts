import prisma from "@phish-guard-app/db";
import { sendTrainingReminderEmail } from "@/lib/email";

const DEFAULT_LOOKAHEAD_DAYS = Number(process.env.TRAINING_REMINDER_LOOKAHEAD_DAYS || 2);

function parseLookaheadDays(input?: number) {
  const value = input ?? DEFAULT_LOOKAHEAD_DAYS;
  if (!Number.isFinite(value) || value < 0) return 2;
  return Math.max(0, Math.min(14, Math.floor(value)));
}

function resolveAppBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3001";
}

export type TrainingReminderJobSummary = {
  lookaheadDays: number;
  candidates: number;
  sent: number;
  failed: number;
  skipped: number;
  overdue: number;
  dueSoon: number;
};

export async function runTrainingReminderJob(options?: {
  lookaheadDays?: number;
}): Promise<TrainingReminderJobSummary> {
  const lookaheadDays = parseLookaheadDays(options?.lookaheadDays);
  const now = new Date();
  const lookaheadLimit = new Date(now);
  lookaheadLimit.setDate(lookaheadLimit.getDate() + lookaheadDays);
  const appBaseUrl = resolveAppBaseUrl();

  const assignments = await prisma.trainingAssignment.findMany({
    where: {
      status: { in: ["assigned", "in_progress"] },
      dueAt: { not: null, lte: lookaheadLimit },
    },
    orderBy: { dueAt: "asc" },
    select: {
      id: true,
      status: true,
      attackType: true,
      recommendation: true,
      dueAt: true,
      organizationId: true,
      userId: true,
      user: {
        select: {
          email: true,
          name: true,
        },
      },
      organization: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let overdue = 0;
  let dueSoon = 0;

  for (const assignment of assignments) {
    if (!assignment.dueAt) {
      skipped += 1;
      continue;
    }

    const dueTime = new Date(assignment.dueAt).getTime();
    if (dueTime < now.getTime()) {
      overdue += 1;
    } else {
      dueSoon += 1;
    }

    const result = await sendTrainingReminderEmail({
      to: assignment.user.email,
      orgName: assignment.organization.name,
      memberName: assignment.user.name,
      assignmentStatus: assignment.status as "assigned" | "in_progress",
      attackType: assignment.attackType,
      recommendation: assignment.recommendation,
      dueAt: assignment.dueAt,
      appLink: `${appBaseUrl}/org/${assignment.organization.slug}/members/${assignment.userId}`,
    });

    if (result.status === "sent") {
      sent += 1;
    } else if (result.status === "failed") {
      failed += 1;
    } else {
      skipped += 1;
    }

    await prisma.emailDeliveryLog.create({
      data: {
        inviteId: null,
        organizationId: assignment.organizationId,
        recipientEmail: assignment.user.email,
        channel: "smtp",
        status: result.status,
        providerMessageId: result.messageId || null,
        error: result.error || null,
        metadata: {
          category: "training_reminder",
          assignmentId: assignment.id,
          assignmentStatus: assignment.status,
          dueAt: assignment.dueAt.toISOString(),
          lookaheadDays,
        },
      },
    });
  }

  return {
    lookaheadDays,
    candidates: assignments.length,
    sent,
    failed,
    skipped,
    overdue,
    dueSoon,
  };
}
