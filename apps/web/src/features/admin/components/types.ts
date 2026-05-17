import type {
  getAllOrganizations,
  getAllSubscriptions,
  getAllUsers,
  getRecentActivity,
  getRiskReport,
} from "@/server/actions/admin";
import type { getAllScans } from "@/server/actions/scans";

export const ADMIN_TABS = [
  "users",
  "organizations",
  "subscriptions",
  "scans",
  "reports",
  "activity",
] as const;

export type AdminTab = (typeof ADMIN_TABS)[number];

export type AdminUsersResponse = Awaited<ReturnType<typeof getAllUsers>>;
export type AdminUser = AdminUsersResponse["users"][number];

export type AdminOrganizationsResponse = Awaited<ReturnType<typeof getAllOrganizations>>;
export type AdminOrganization = AdminOrganizationsResponse["organizations"][number];

export type AdminSubscriptionsData = Awaited<ReturnType<typeof getAllSubscriptions>>;
export type AdminPersonalSubscription = AdminSubscriptionsData["personalSubscriptions"][number];
export type AdminTeamSubscription = AdminSubscriptionsData["teamSubscriptions"][number];

export type AdminActivityData = Awaited<ReturnType<typeof getRecentActivity>>;
export type AdminRecentScan = AdminActivityData["recentScans"][number];
export type AdminRecentUser = AdminActivityData["recentUsers"][number];

export type AdminScan = Awaited<ReturnType<typeof getAllScans>>[number];

export type AdminRiskReportData = Awaited<ReturnType<typeof getRiskReport>>;
export type AdminRiskDepartmentRow = AdminRiskReportData["departments"][number];
export type AdminRiskUserRow = AdminRiskReportData["users"][number];
export type AdminRiskIncidentRow = AdminRiskReportData["incidents"][number];

export function normalizeAdminTab(value?: string | null): AdminTab {
  if (value && ADMIN_TABS.includes(value as AdminTab)) {
    return value as AdminTab;
  }

  return "users";
}
