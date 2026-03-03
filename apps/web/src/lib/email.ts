import nodemailer from "nodemailer";

const requiredEnv = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"];

function hasEmailConfig() {
  return requiredEnv.every((key) => process.env[key]);
}

type InviteEmailPayload = {
  to: string;
  link: string;
  orgName?: string;
  inviterName?: string;
};

type TrainingReminderEmailPayload = {
  to: string;
  orgName: string;
  memberName?: string | null;
  assignmentStatus: "assigned" | "in_progress";
  attackType: string;
  recommendation: string;
  dueAt: Date | string;
  appLink?: string;
};

export type EmailSendResult = {
  sent: boolean;
  status: "sent" | "failed" | "skipped";
  messageId?: string | null;
  error?: string;
};

export async function sendInviteEmail(payload: InviteEmailPayload) {
  const { to, link, orgName, inviterName } = payload;
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || "noreply@phishguard.local";

  if (!hasEmailConfig()) {
    console.warn("[email] Missing SMTP config, skipping send. Invite link:", link);
    return {
      sent: false,
      status: "skipped",
      error: "SMTP is not configured",
    } satisfies EmailSendResult;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const subject = `Invitation to join ${orgName || "PhishGuard"}`;
  const html = `
    <p>Hi,</p>
    <p>${inviterName || "A teammate"} has invited you to join <strong>${orgName || "PhishGuard"}</strong>.</p>
    <p><a href="${link}">Accept invitation</a></p>
    <p>If you weren't expecting this, you can safely ignore the email.</p>
  `;
  const text = `Hi,\n${inviterName || "A teammate"} has invited you to join ${orgName || "PhishGuard"}.\n\nAccept invitation: ${link}\n\nIf you weren't expecting this, you can ignore this email.`;

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });

    return {
      sent: true,
      status: "sent",
      messageId: info.messageId ?? null,
    } satisfies EmailSendResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown SMTP error";
    console.error("[email] Failed to send invite email:", message);
    return {
      sent: false,
      status: "failed",
      error: message,
    } satisfies EmailSendResult;
  }
}

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export async function sendTrainingReminderEmail(payload: TrainingReminderEmailPayload) {
  const {
    to,
    orgName,
    memberName,
    assignmentStatus,
    attackType,
    recommendation,
    dueAt,
    appLink,
  } = payload;

  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || "noreply@phishguard.local";
  const dueLabel = formatDate(dueAt);
  const isOverdue = new Date(dueAt).getTime() < Date.now();
  const statusLabel = assignmentStatus === "in_progress" ? "in progress" : "assigned";
  const subject = isOverdue
    ? `[Action Required] Training overdue - ${orgName}`
    : `Training reminder - ${orgName}`;

  if (!hasEmailConfig()) {
    return {
      sent: false,
      status: "skipped",
      error: "SMTP is not configured",
    } satisfies EmailSendResult;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const html = `
    <p>Hi ${memberName || "there"},</p>
    <p>This is a reminder for your <strong>${orgName}</strong> phishing training assignment.</p>
    <ul>
      <li>Status: <strong>${statusLabel}</strong></li>
      <li>Focus area: <strong>${attackType}</strong></li>
      <li>Due date: <strong>${dueLabel}</strong></li>
    </ul>
    <p>${recommendation}</p>
    ${
      appLink
        ? `<p><a href="${appLink}">Open assignment in PhishGuard</a></p>`
        : ""
    }
    <p>If you already completed the training, you can ignore this reminder.</p>
  `;

  const text = [
    `Hi ${memberName || "there"},`,
    "",
    `This is a reminder for your ${orgName} phishing training assignment.`,
    `Status: ${statusLabel}`,
    `Focus area: ${attackType}`,
    `Due date: ${dueLabel}`,
    "",
    recommendation,
    "",
    appLink ? `Open assignment: ${appLink}` : "",
    "",
    "If you already completed the training, you can ignore this reminder.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });

    return {
      sent: true,
      status: "sent",
      messageId: info.messageId ?? null,
    } satisfies EmailSendResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown SMTP error";
    console.error("[email] Failed to send training reminder email:", message);
    return {
      sent: false,
      status: "failed",
      error: message,
    } satisfies EmailSendResult;
  }
}
