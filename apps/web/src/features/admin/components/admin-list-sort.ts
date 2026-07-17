import { getPlanPrice, isValidPlan } from "@/lib/billing/subscription-plans";
import type {
  AdminOrganization,
  AdminPersonalSubscription,
  AdminTeamSubscription,
  AdminUser,
} from "./types";

export type OrganizationSortKey =
  | "newest"
  | "name-asc"
  | "name-desc"
  | "members-desc"
  | "scans-desc"
  | "plan-desc";

export type UserSortKey =
  | "newest"
  | "name-asc"
  | "name-desc"
  | "scans-desc"
  | "organizations-desc"
  | "plan-desc";

export type SubscriptionSortKey =
  | "newest"
  | "name-asc"
  | "name-desc"
  | "plan-desc"
  | "plan-asc"
  | "renews-soon"
  | "status-active";

export const ORGANIZATION_SORT_OPTIONS: { value: OrganizationSortKey; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
  { value: "members-desc", label: "Most members" },
  { value: "scans-desc", label: "Most scans" },
  { value: "plan-desc", label: "Highest plan" },
];

export const USER_SORT_OPTIONS: { value: UserSortKey; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
  { value: "scans-desc", label: "Most scans" },
  { value: "organizations-desc", label: "Most organizations" },
  { value: "plan-desc", label: "Highest plan" },
];

export const SUBSCRIPTION_SORT_OPTIONS: { value: SubscriptionSortKey; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "name-asc", label: "Name A–Z" },
  { value: "name-desc", label: "Name Z–A" },
  { value: "plan-desc", label: "Highest plan" },
  { value: "plan-asc", label: "Lowest plan" },
  { value: "renews-soon", label: "Renews soon" },
  { value: "status-active", label: "Active first" },
];

type SubscriptionSortable = {
  plan: string;
  status: string;
  createdAt: Date | string;
  currentPeriodEnd: Date | string;
};

function compareNames(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function getUserDisplayName(user: AdminUser) {
  return user.name?.trim() || user.email;
}

function getPlanSortValue(planId: string) {
  if (isValidPlan(planId)) {
    return getPlanPrice(planId);
  }

  return 0;
}

function getOrganizationPlanId(organization: AdminOrganization) {
  return organization.subscription?.plan ?? "team_free";
}

function getUserPlanId(user: AdminUser) {
  return user.personalSubscription?.plan ?? "free";
}

function compareByPlanDesc(planA: string, planB: string, nameA: string, nameB: string) {
  const priceDiff = getPlanSortValue(planB) - getPlanSortValue(planA);
  if (priceDiff !== 0) {
    return priceDiff;
  }

  return compareNames(nameA, nameB);
}

function compareByPlanAsc(planA: string, planB: string, nameA: string, nameB: string) {
  const priceDiff = getPlanSortValue(planA) - getPlanSortValue(planB);
  if (priceDiff !== 0) {
    return priceDiff;
  }

  return compareNames(nameA, nameB);
}

function sortSubscriptionList<T extends SubscriptionSortable>(
  items: T[],
  sortKey: SubscriptionSortKey,
  getName: (item: T) => string
) {
  const sorted = [...items];

  switch (sortKey) {
    case "name-asc":
      return sorted.sort((a, b) => compareNames(getName(a), getName(b)));
    case "name-desc":
      return sorted.sort((a, b) => compareNames(getName(b), getName(a)));
    case "plan-desc":
      return sorted.sort((a, b) =>
        compareByPlanDesc(a.plan, b.plan, getName(a), getName(b))
      );
    case "plan-asc":
      return sorted.sort((a, b) =>
        compareByPlanAsc(a.plan, b.plan, getName(a), getName(b))
      );
    case "renews-soon":
      return sorted.sort(
        (a, b) =>
          new Date(a.currentPeriodEnd).getTime() - new Date(b.currentPeriodEnd).getTime()
      );
    case "status-active":
      return sorted.sort((a, b) => {
        const activeDiff = Number(b.status === "active") - Number(a.status === "active");
        if (activeDiff !== 0) {
          return activeDiff;
        }

        return compareNames(getName(a), getName(b));
      });
    case "newest":
    default:
      return sorted.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }
}

export function sortPersonalSubscriptions(
  subscriptions: AdminPersonalSubscription[],
  sortKey: SubscriptionSortKey
) {
  return sortSubscriptionList(subscriptions, sortKey, (subscription) =>
    subscription.user.name?.trim() || subscription.user.email
  );
}

export function sortTeamSubscriptions(
  subscriptions: AdminTeamSubscription[],
  sortKey: SubscriptionSortKey
) {
  return sortSubscriptionList(subscriptions, sortKey, (subscription) => subscription.organization.name);
}

export function sortOrganizations(
  organizations: AdminOrganization[],
  sortKey: OrganizationSortKey
) {
  const sorted = [...organizations];

  switch (sortKey) {
    case "name-asc":
      return sorted.sort((a, b) => compareNames(a.name, b.name));
    case "name-desc":
      return sorted.sort((a, b) => compareNames(b.name, a.name));
    case "members-desc":
      return sorted.sort((a, b) => b._count.members - a._count.members);
    case "scans-desc":
      return sorted.sort((a, b) => b._count.scans - a._count.scans);
    case "plan-desc":
      return sorted.sort((a, b) =>
        compareByPlanDesc(getOrganizationPlanId(a), getOrganizationPlanId(b), a.name, b.name)
      );
    case "newest":
    default:
      return sorted.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }
}

export function sortUsers(users: AdminUser[], sortKey: UserSortKey) {
  const sorted = [...users];

  switch (sortKey) {
    case "name-asc":
      return sorted.sort((a, b) => compareNames(getUserDisplayName(a), getUserDisplayName(b)));
    case "name-desc":
      return sorted.sort((a, b) => compareNames(getUserDisplayName(b), getUserDisplayName(a)));
    case "scans-desc":
      return sorted.sort((a, b) => b._count.scans - a._count.scans);
    case "organizations-desc":
      return sorted.sort((a, b) => b.memberships.length - a.memberships.length);
    case "plan-desc":
      return sorted.sort((a, b) =>
        compareByPlanDesc(
          getUserPlanId(a),
          getUserPlanId(b),
          getUserDisplayName(a),
          getUserDisplayName(b)
        )
      );
    case "newest":
    default:
      return sorted.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }
}
