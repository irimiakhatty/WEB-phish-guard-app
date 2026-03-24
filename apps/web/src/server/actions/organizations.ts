"use server";

import * as organizationsService from "@phish-guard-app/backend/organizations";
import { revalidatePath } from "next/cache";
import { sendInviteEmail } from "@/lib/integrations/email";
import { requireAuth } from "@/lib/auth/auth-helpers";

function revalidatePaths(paths?: string[]) {
  paths?.forEach((path) => revalidatePath(path));
}

function toOrganizationActor(user: {
  id: string;
  email: string;
  name?: string | null;
  role?: string | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role || "user",
  };
}

export async function createOrganization(data: { name: string; slug: string }) {
  const { user } = await requireAuth();
  const { revalidatePaths: paths, ...result } = await organizationsService.createOrganization(
    toOrganizationActor(user),
    data
  );
  revalidatePaths(paths);
  return result;
}

export async function updateOrganization(organizationId: string, data: { name: string }) {
  const { user } = await requireAuth();
  const { revalidatePaths: paths, ...result } = await organizationsService.updateOrganization(
    toOrganizationActor(user),
    organizationId,
    data
  );
  revalidatePaths(paths);
  return result;
}

export async function deleteOrganization(organizationId: string) {
  const { user } = await requireAuth();
  const { revalidatePaths: paths, ...result } = await organizationsService.deleteOrganization(
    toOrganizationActor(user),
    organizationId
  );
  revalidatePaths(paths);
  return result;
}

export async function upgradeOrganizationPlan(organizationId: string, targetPlanId: string) {
  const { user } = await requireAuth();
  const { revalidatePaths: paths, ...result } =
    await organizationsService.upgradeOrganizationPlan(
      toOrganizationActor(user),
      organizationId,
      targetPlanId
    );
  revalidatePaths(paths);
  return result;
}

export async function inviteMember(
  organizationId: string,
  data: { email: string; role: "admin" | "member"; departmentName?: string }
) {
  const { user } = await requireAuth();
  const { revalidatePaths: paths, ...result } = await organizationsService.inviteMember(
    toOrganizationActor(user),
    sendInviteEmail,
    organizationId,
    data
  );
  revalidatePaths(paths);
  return result;
}

export async function bulkInviteMembers(
  organizationId: string,
  inviteList: Array<{ email: string; role?: "admin" | "member"; name?: string; department?: string }>
) {
  const { user } = await requireAuth();
  const { revalidatePaths: paths, ...result } = await organizationsService.bulkInviteMembers(
    toOrganizationActor(user),
    sendInviteEmail,
    organizationId,
    inviteList
  );
  revalidatePaths(paths);
  return result;
}

export async function acceptInviteSignUp(input: { token: string; name: string; password: string }) {
  return organizationsService.acceptInviteSignUp(input);
}

export async function removeMember(organizationId: string, memberId: string) {
  const { user } = await requireAuth();
  const { revalidatePaths: paths, ...result } = await organizationsService.removeMember(
    toOrganizationActor(user),
    organizationId,
    memberId
  );
  revalidatePaths(paths);
  return result;
}

export async function updateMemberRole(
  organizationId: string,
  memberId: string,
  role: "admin" | "member"
) {
  const { user } = await requireAuth();
  const { revalidatePaths: paths, ...result } = await organizationsService.updateMemberRole(
    toOrganizationActor(user),
    organizationId,
    memberId,
    role
  );
  revalidatePaths(paths);
  return result;
}

export async function createOrganizationDepartment(input: {
  organizationId: string;
  name: string;
}) {
  const { user } = await requireAuth();
  const { revalidatePaths: paths, ...result } =
    await organizationsService.createOrganizationDepartment(toOrganizationActor(user), input);
  revalidatePaths(paths);
  return result;
}

export async function assignMemberDepartment(input: {
  organizationId: string;
  memberId: string;
  departmentId?: string | "unassigned" | null;
}) {
  const { user } = await requireAuth();
  const { revalidatePaths: paths, ...result } = await organizationsService.assignMemberDepartment(
    toOrganizationActor(user),
    {
      ...input,
      departmentId: input.departmentId ?? null,
    }
  );
  revalidatePaths(paths);
  return result;
}

export async function acceptInvite(token: string) {
  const { user } = await requireAuth();
  const { revalidatePaths: paths, ...result } = await organizationsService.acceptInvite(
    toOrganizationActor(user),
    token
  );
  revalidatePaths(paths);
  return result;
}

export async function resendInvite(inviteId: string) {
  const { user } = await requireAuth();
  const { revalidatePaths: paths, ...result } = await organizationsService.resendInvite(
    toOrganizationActor(user),
    sendInviteEmail,
    inviteId
  );
  revalidatePaths(paths);
  return result;
}

export async function copyInviteLink(inviteId: string) {
  const { user } = await requireAuth();
  const response = await organizationsService.copyInviteLink(toOrganizationActor(user), inviteId);
  const paths = "revalidatePaths" in response ? response.revalidatePaths : undefined;
  revalidatePaths(paths);
  if ("revalidatePaths" in response) {
    const { revalidatePaths: _ignored, ...result } = response;
    return result;
  }
  return response;
}

export async function cancelInvite(inviteId: string) {
  const { user } = await requireAuth();
  const { revalidatePaths: paths, ...result } = await organizationsService.cancelInvite(
    toOrganizationActor(user),
    inviteId
  );
  revalidatePaths(paths);
  return result;
}

export async function getOrganization(slug: string) {
  const { user } = await requireAuth();
  return organizationsService.getOrganization(toOrganizationActor(user), slug);
}

export async function getUserOrganizations() {
  const { user } = await requireAuth();
  return organizationsService.getUserOrganizations(toOrganizationActor(user));
}