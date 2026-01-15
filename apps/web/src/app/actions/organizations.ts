"use server";

import { requireAuth } from "@/lib/auth-helpers";
import prisma from "@phish-guard-app/db";
import { revalidatePath } from "next/cache";

// Create a new organization (admin only)
export async function createOrganization(data: { name: string; description?: string; maxUsers?: number }) {
  const session = await requireAuth();
  
  if (session.user.role !== "admin") {
    throw new Error("Only admins can create organizations");
  }

  const organization = await prisma.organization.create({
    data: {
      name: data.name,
      description: data.description,
      maxUsers: data.maxUsers || 10,
      adminId: session.user.id,
    },
  });

  revalidatePath("/admin/organizations");
  return organization;
}

// Get all organizations (admin only)
export async function getAllOrganizations() {
  const session = await requireAuth();
  
  if (session.user.role !== "admin") {
    throw new Error("Only admins can view organizations");
  }

  const organizations = await prisma.organization.findMany({
    include: {
      users: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      _count: {
        select: {
          users: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return organizations;
}

// Get organization dashboard stats
export async function getOrganizationStats(organizationId: string) {
  const session = await requireAuth();
  
  if (session.user.role !== "admin") {
    throw new Error("Only admins can view organization stats");
  }

  // Get all users in organization
  const users = await prisma.user.findMany({
    where: { organizationId },
    include: {
      dashboardStats: true,
      scans: {
        where: { isDeleted: false },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  // Aggregate stats
  const totalUsers = users.length;
  const totalScans = users.reduce((sum, user) => sum + (user.dashboardStats?.totalScans || 0), 0);
  const totalThreats = users.reduce((sum, user) => sum + (user.dashboardStats?.threatsBlocked || 0), 0);
  const totalSafeSites = users.reduce((sum, user) => sum + (user.dashboardStats?.safeSites || 0), 0);

  // Recent scans across all users
  const recentScans = users.flatMap(user => 
    user.scans.map(scan => ({
      ...scan,
      userName: user.name,
      userEmail: user.email,
    }))
  ).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 10);

  // Risk distribution
  const riskDistribution = users.flatMap(user => user.scans).reduce((acc, scan) => {
    acc[scan.riskLevel] = (acc[scan.riskLevel] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    totalUsers,
    totalScans,
    totalThreats,
    totalSafeSites,
    recentScans,
    riskDistribution,
    users: users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      totalScans: user.dashboardStats?.totalScans || 0,
      threatsBlocked: user.dashboardStats?.threatsBlocked || 0,
      lastScanAt: user.dashboardStats?.lastScanAt,
    })),
  };
}

// Assign user to organization
export async function assignUserToOrganization(userId: string, organizationId: string) {
  const session = await requireAuth();
  
  if (session.user.role !== "admin") {
    throw new Error("Only admins can assign users to organizations");
  }

  // Check if organization has capacity
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { _count: { select: { users: true } } },
  });

  if (!organization) {
    throw new Error("Organization not found");
  }

  if (organization._count.users >= organization.maxUsers) {
    throw new Error("Organization has reached maximum user capacity");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { organizationId },
  });

  revalidatePath("/admin/organizations");
  revalidatePath("/admin/users");
  return { success: true };
}

// Remove user from organization
export async function removeUserFromOrganization(userId: string) {
  const session = await requireAuth();
  
  if (session.user.role !== "admin") {
    throw new Error("Only admins can remove users from organizations");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { organizationId: null },
  });

  revalidatePath("/admin/organizations");
  revalidatePath("/admin/users");
  return { success: true };
}

// Update organization
export async function updateOrganization(id: string, data: { name?: string; description?: string; maxUsers?: number; isActive?: boolean }) {
  const session = await requireAuth();
  
  if (session.user.role !== "admin") {
    throw new Error("Only admins can update organizations");
  }

  const organization = await prisma.organization.update({
    where: { id },
    data,
  });

  revalidatePath("/admin/organizations");
  return organization;
}

// Delete organization
export async function deleteOrganization(id: string) {
  const session = await requireAuth();
  
  if (session.user.role !== "admin") {
    throw new Error("Only admins can delete organizations");
  }

  // Remove all users from organization first
  await prisma.user.updateMany({
    where: { organizationId: id },
    data: { organizationId: null },
  });

  await prisma.organization.delete({
    where: { id },
  });

  revalidatePath("/admin/organizations");
  return { success: true };
}
