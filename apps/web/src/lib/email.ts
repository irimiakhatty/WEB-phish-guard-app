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

export type InviteEmailSendResult = {
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
    } satisfies InviteEmailSendResult;
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
    } satisfies InviteEmailSendResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown SMTP error";
    console.error("[email] Failed to send invite email:", message);
    return {
      sent: false,
      status: "failed",
      error: message,
    } satisfies InviteEmailSendResult;
  }
}
