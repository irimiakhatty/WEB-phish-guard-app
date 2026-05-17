"use server";

import * as adminService from "@phish-guard-app/backend/admin";
import { requireAuth } from "@/lib/auth/auth-helpers";
import { getStripeFinancialOverview } from "@/lib/billing/stripe-reporting";
import { getPlanById } from "@/lib/billing/subscription-plans";
import {
  createCsv,
  getStandardReportDefinition,
  type StandardReportFormat,
  type StandardReportId,
} from "@/features/admin/reports/standard-reports";

export async function requireSuperAdmin() {
  const { user } = await requireAuth();

  if (user.role !== "super_admin") {
    throw new Error("Unauthorized: Super admin access required");
  }

  return user;
}

export async function getGlobalStats() {
  await requireSuperAdmin();
  return adminService.getGlobalStats();
}

export async function getStripeCashReport() {
  await requireSuperAdmin();
  return getStripeFinancialOverview();
}

export async function getAllUsers(page = 1, limit = 50) {
  await requireSuperAdmin();
  return adminService.getAllUsers(page, limit);
}

export async function updateUserRole(userId: string, role: "user" | "admin") {
  await requireSuperAdmin();
  return adminService.updateUserRole(userId, role);
}

export async function deleteUser(userId: string) {
  await requireSuperAdmin();
  return adminService.deleteUser(userId);
}

export async function getAllOrganizations(page = 1, limit = 50) {
  await requireSuperAdmin();
  return adminService.getAllOrganizations(page, limit);
}

export async function updateOrganizationSubscription(
  organizationId: string,
  data: {
    plan: string;
    maxMembers: number;
    scansPerMonth: number;
    scansPerHourPerUser: number;
    maxApiTokens: number;
  }
) {
  await requireSuperAdmin();
  return adminService.updateOrganizationSubscription(organizationId, data);
}

export async function deleteOrganizationAsAdmin(organizationId: string) {
  await requireSuperAdmin();
  return adminService.deleteOrganizationAsAdmin(organizationId);
}

export async function getAllSubscriptions() {
  await requireSuperAdmin();
  return adminService.getAllSubscriptions();
}

export async function getRecentActivity(limit = 50) {
  await requireSuperAdmin();
  return adminService.getRecentActivity(limit);
}

export async function searchUsers(query: string) {
  await requireSuperAdmin();
  return adminService.searchUsers(query);
}

export async function searchOrganizations(query: string) {
  await requireSuperAdmin();
  return adminService.searchOrganizations(query);
}

export async function getRiskReport() {
  await requireSuperAdmin();
  return adminService.getRiskReport();
}

export type ExportedStandardReport = {
  filename: string;
  mimeType: string;
  content: string;
  bytes: number;
};

function buildReportFilename(reportId: StandardReportId, format: StandardReportFormat) {
  const date = new Date().toISOString().slice(0, 10);
  return `phishguard_${reportId}_${date}.${format}`;
}

export async function exportStandardReport(
  reportId: StandardReportId,
  format: StandardReportFormat
): Promise<ExportedStandardReport> {
  await requireSuperAdmin();

  const definition = getStandardReportDefinition(reportId);
  if (!definition.formats.includes(format)) {
    throw new Error(`Unsupported format "${format}" for report "${reportId}"`);
  }

  const filename = buildReportFilename(reportId, format);
  const mimeType =
    format === "csv" ? "text/csv;charset=utf-8" : "application/json;charset=utf-8";

  switch (reportId) {
    case "platform_overview": {
      const stats = await adminService.getGlobalStats();
      const content = JSON.stringify(
        { generatedAt: new Date().toISOString(), reportId, data: stats },
        null,
        2
      );
      return { filename, mimeType, content, bytes: Buffer.byteLength(content, "utf8") };
    }

    case "organizations_snapshot": {
      const { organizations } = await adminService.getAllOrganizations(1, 2000);
      const rows = organizations.map((org) => {
        const planId = org.subscription?.plan ?? "team_free";
        const plan = getPlanById(planId);
        const estimatedMrrUsd = org.subscription?.status === "active" ? plan.price : 0;

        return {
          organizationId: org.id,
          name: org.name,
          slug: org.slug,
          planId,
          subscriptionStatus: org.subscription?.status ?? "none",
          members: org._count.members,
          scans: org._count.scans,
          estimatedMrrUsd,
          createdAt: org.createdAt.toISOString(),
        };
      });

      const content =
        format === "json"
          ? JSON.stringify(
              { generatedAt: new Date().toISOString(), reportId, rows },
              null,
              2
            )
          : createCsv(
              [
                { header: "organizationId", key: "organizationId" },
                { header: "name", key: "name" },
                { header: "slug", key: "slug" },
                { header: "planId", key: "planId" },
                { header: "subscriptionStatus", key: "subscriptionStatus" },
                { header: "members", key: "members" },
                { header: "scans", key: "scans" },
                { header: "estimatedMrrUsd", key: "estimatedMrrUsd" },
                { header: "createdAt", key: "createdAt" },
              ],
              rows
            );

      return { filename, mimeType, content, bytes: Buffer.byteLength(content, "utf8") };
    }

    case "subscriptions_paid": {
      const { personalSubscriptions, teamSubscriptions } = await adminService.getAllSubscriptions();

      const rows = [
        ...personalSubscriptions.map((sub) => ({
          type: "personal",
          entityId: sub.userId,
          entityName: sub.user?.name ?? "",
          entityEmail: sub.user?.email ?? "",
          organizationId: "",
          organizationSlug: "",
          organizationName: "",
          planId: sub.plan,
          status: sub.status,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          currentPeriodStart: sub.currentPeriodStart.toISOString(),
          currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
          createdAt: sub.createdAt.toISOString(),
        })),
        ...teamSubscriptions.map((sub) => ({
          type: "team",
          entityId: "",
          entityName: "",
          entityEmail: "",
          organizationId: sub.organizationId,
          organizationSlug: sub.organization?.slug ?? "",
          organizationName: sub.organization?.name ?? "",
          planId: sub.plan,
          status: sub.status,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          currentPeriodStart: sub.currentPeriodStart.toISOString(),
          currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
          createdAt: sub.createdAt.toISOString(),
        })),
      ];

      const content =
        format === "json"
          ? JSON.stringify(
              { generatedAt: new Date().toISOString(), reportId, rows },
              null,
              2
            )
          : createCsv(
              [
                { header: "type", key: "type" },
                { header: "planId", key: "planId" },
                { header: "status", key: "status" },
                { header: "cancelAtPeriodEnd", key: "cancelAtPeriodEnd" },
                { header: "currentPeriodStart", key: "currentPeriodStart" },
                { header: "currentPeriodEnd", key: "currentPeriodEnd" },
                { header: "entityId", key: "entityId" },
                { header: "entityName", key: "entityName" },
                { header: "entityEmail", key: "entityEmail" },
                { header: "organizationId", key: "organizationId" },
                { header: "organizationName", key: "organizationName" },
                { header: "organizationSlug", key: "organizationSlug" },
                { header: "createdAt", key: "createdAt" },
              ],
              rows
            );

      return { filename, mimeType, content, bytes: Buffer.byteLength(content, "utf8") };
    }

    case "recent_scans":
    case "recent_users":
    case "activity_log": {
      const activity = await adminService.getRecentActivity(200);

      if (reportId === "recent_users") {
        const rows = activity.recentUsers.map((user) => ({
          userId: user.id,
          name: user.name ?? "",
          email: user.email,
          createdAt: user.createdAt.toISOString(),
        }));

        const content =
          format === "json"
            ? JSON.stringify(
                { generatedAt: new Date().toISOString(), reportId, rows },
                null,
                2
              )
            : createCsv(
                [
                  { header: "userId", key: "userId" },
                  { header: "name", key: "name" },
                  { header: "email", key: "email" },
                  { header: "createdAt", key: "createdAt" },
                ],
                rows
              );

        return { filename, mimeType, content, bytes: Buffer.byteLength(content, "utf8") };
      }

      if (reportId === "recent_scans") {
        const rows = activity.recentScans.map((scan) => ({
          scanId: scan.id,
          createdAt: scan.createdAt.toISOString(),
          source: scan.source,
          userName: scan.user?.name ?? "",
          userEmail: scan.user?.email ?? "",
          organizationName: scan.organization?.name ?? "",
          organizationSlug: scan.organization?.slug ?? "",
          riskLevel: scan.riskLevel,
          isPhishing: scan.isPhishing,
          overallScorePct: Math.round(scan.overallScore * 1000) / 10,
          confidencePct: Math.round(scan.confidence * 1000) / 10,
          url: scan.url ?? "",
        }));

        const content =
          format === "json"
            ? JSON.stringify(
                { generatedAt: new Date().toISOString(), reportId, rows },
                null,
                2
              )
            : createCsv(
                [
                  { header: "scanId", key: "scanId" },
                  { header: "createdAt", key: "createdAt" },
                  { header: "source", key: "source" },
                  { header: "userName", key: "userName" },
                  { header: "userEmail", key: "userEmail" },
                  { header: "organizationName", key: "organizationName" },
                  { header: "organizationSlug", key: "organizationSlug" },
                  { header: "riskLevel", key: "riskLevel" },
                  { header: "isPhishing", key: "isPhishing" },
                  { header: "overallScorePct", key: "overallScorePct" },
                  { header: "confidencePct", key: "confidencePct" },
                  { header: "url", key: "url" },
                ],
                rows
              );

        return { filename, mimeType, content, bytes: Buffer.byteLength(content, "utf8") };
      }

      const scanEvents = activity.recentScans.map((scan) => ({
        eventType: "scan",
        time: scan.createdAt.toISOString(),
        actor: scan.user?.email ?? "",
        action: scan.isPhishing ? "Phishing detected" : "Scan completed",
        target: scan.url ?? "",
        organization: scan.organization?.name ?? "",
        details: `${scan.riskLevel}; score=${Math.round(scan.overallScore * 1000) / 10}%`,
      }));

      const userEvents = activity.recentUsers.map((user) => ({
        eventType: "user",
        time: user.createdAt.toISOString(),
        actor: user.email,
        action: "New user account",
        target: user.name ?? user.email,
        organization: "",
        details: "",
      }));

      const rows = [...scanEvents, ...userEvents].sort((a, b) => b.time.localeCompare(a.time));
      const content =
        format === "json"
          ? JSON.stringify({ generatedAt: new Date().toISOString(), reportId, rows }, null, 2)
          : createCsv(
              [
                { header: "eventType", key: "eventType" },
                { header: "time", key: "time" },
                { header: "actor", key: "actor" },
                { header: "action", key: "action" },
                { header: "target", key: "target" },
                { header: "organization", key: "organization" },
                { header: "details", key: "details" },
              ],
              rows
            );

      return { filename, mimeType, content, bytes: Buffer.byteLength(content, "utf8") };
    }

    case "risk_signals_30d": {
      const report = await adminService.getRiskReport();
      const content = JSON.stringify(
        { generatedAt: new Date().toISOString(), reportId, data: report },
        null,
        2
      );
      return { filename, mimeType, content, bytes: Buffer.byteLength(content, "utf8") };
    }

    default: {
      const exhaustive: never = reportId;
      throw new Error(`Unhandled report: ${exhaustive}`);
    }
  }
}
