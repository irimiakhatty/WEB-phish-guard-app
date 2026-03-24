import type { OrganizationActor } from "./types";

export function isSuperAdmin(actor: OrganizationActor) {
  return actor.role === "super_admin";
}

export function sanitizeOrganizationName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function toOrganizationNameKey(name: string): string {
  return sanitizeOrganizationName(name).toLowerCase();
}

export function hasOrganizationNameUniqueViolation(error: {
  code?: string;
  meta?: { target?: string[] };
}) {
  return (
    error.meta?.target?.some(
      (target) =>
        target === "nameNormalized" ||
        target === "name_normalized" ||
        target === "organization_name_normalized_key"
    ) ?? false
  );
}

export const PASSWORD_MIN_LENGTH = 10;

const PASSWORD_RULES = [
  (value: string) => value.length >= PASSWORD_MIN_LENGTH,
  (value: string) => /[a-z]/.test(value),
  (value: string) => /[A-Z]/.test(value),
  (value: string) => /[0-9]/.test(value),
  (value: string) => /[^A-Za-z0-9]/.test(value),
] as const;

export function isPasswordStrong(value: string) {
  return PASSWORD_RULES.every((rule) => rule(value));
}

export const PASSWORD_POLICY_ERROR =
  "Password must include uppercase, lowercase, number, special character, and minimum length.";

export const TEAM_PLANS = {
  team_free: {
    maxMembers: 3,
    scansPerMonth: 500,
    scansPerHourPerUser: 25,
    maxApiTokens: 1,
  },
  team_startup: {
    maxMembers: 10,
    scansPerMonth: 5000,
    scansPerHourPerUser: 100,
    maxApiTokens: 5,
  },
  team_business: {
    maxMembers: 50,
    scansPerMonth: 25000,
    scansPerHourPerUser: 500,
    maxApiTokens: 20,
  },
  team_enterprise: {
    maxMembers: 999999,
    scansPerMonth: 999999,
    scansPerHourPerUser: 999999,
    maxApiTokens: 100,
  },
} as const;

export type TeamPlanId = keyof typeof TEAM_PLANS;

export function isTeamPlan(planId: string): planId is TeamPlanId {
  return planId in TEAM_PLANS;
}