export type OrganizationActor = {
  id: string;
  email: string;
  name?: string | null;
  role: string;
};

export type InviteEmailPayload = {
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

export type InviteEmailSender = (
  payload: InviteEmailPayload
) => Promise<InviteEmailSendResult>;