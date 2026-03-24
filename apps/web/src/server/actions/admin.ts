"use server";

import * as adminService from "@phish-guard-app/backend/admin";
import { requireAuth } from "@/lib/auth/auth-helpers";

// ==========================================
// SUPER ADMIN CHECKS
// ==========================================

export async function requireSuperAdmin() {
  const { user } = await requireAuth();

  if (user.role !== "super_admin") {
    throw new Error("Unauthorized: Super admin access required");
  }

  return user;
}

// ==========================================
// GLOBAL STATISTICS
// ==========================================

export async function getGlobalStats() {
  await requireSuperAdmin();
  return adminService.getGlobalStats();
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
