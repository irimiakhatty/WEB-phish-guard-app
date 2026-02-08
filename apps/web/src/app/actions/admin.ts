"use server";

import prisma from "@phish-guard-app/db";
import { requireAuth } from "@/lib/auth-helpers";

// ==========================================
// SUPER ADMIN CHECKS
// ==========================================

export async function requireSuperAdmin() {
  const { user } = await requireAuth();

  if (user.role !== "admin") {
    throw new Error("Unauthorized: Super admin access required");
  }

  return user;
}

// ==========================================
// GLOBAL STATISTICS
// ==========================================

export async function getGlobalStats() {
  await requireSuperAdmin();

  const [
    totalUsers,
    totalOrganizations,
    totalScans,
    totalApiTokens,
    activeSubscriptions,
    recentUsers,
    recentOrganizations,
  ] = await Promise.all([
    // Total users
    prisma.user.count(),

    // Total organizations
    prisma.organization.count(),

    // Total scans
    prisma.scan.count(),

    // Total API tokens
    prisma.apiToken.count({ where: { isActive: true } }),

    // Active subscriptions (personal + team)
    Promise.all([
      prisma.personalSubscription.count({
        where: {
          status: "active",
          plan: { not: "free" },
        },
      }),
      prisma.subscription.count({
        where: {
          status: "active",
          plan: { not: "team_free" },
        },
      }),
    ]).then(([personal, team]) => personal + team),

    // Recent users (last 30 days)
    prisma.user.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    }),

    // Recent organizations (last 30 days)
    prisma.organization.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  // Scans by day (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const scansByDay = await prisma.scan.groupBy({
    by: ["createdAt"],
    where: {
      createdAt: { gte: sevenDaysAgo },
    },
    _count: true,
  });

  return {
    totalUsers,
    totalOrganizations,
    totalScans,
    totalApiTokens,
    activeSubscriptions,
    recentUsers,
    recentOrganizations,
    scansByDay: scansByDay.length,
  };
}

// ==========================================
// USER MANAGEMENT
// ==========================================

export async function getAllUsers(page = 1, limit = 50) {
  await requireSuperAdmin();

  const skip = (page - 1) * limit;

  const [users, totalCount] = await Promise.all([
    prisma.user.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        personalSubscription: true,
        memberships: {
          where: { status: "active" },
          include: {
            organization: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
        },
        _count: {
          select: {
            scans: true,
            apiTokens: { where: { isActive: true } },
          },
        },
      },
    }),
    prisma.user.count(),
  ]);

  return {
    users,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    currentPage: page,
  };
}

export async function updateUserRole(userId: string, role: "user" | "admin") {
  await requireSuperAdmin();

  await prisma.user.update({
    where: { id: userId },
    data: { role },
  });

  return { success: true };
}

export async function deleteUser(userId: string) {
  await requireSuperAdmin();

  // Delete user (cascade will handle related data)
  await prisma.user.delete({
    where: { id: userId },
  });

  return { success: true };
}

// ==========================================
// ORGANIZATION MANAGEMENT
// ==========================================

export async function getAllOrganizations(page = 1, limit = 50) {
  await requireSuperAdmin();

  const skip = (page - 1) * limit;

  const [organizations, totalCount] = await Promise.all([
    prisma.organization.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        subscription: true,
        _count: {
          select: {
            members: { where: { status: "active" } },
            scans: true,
          },
        },
        members: {
          where: {
            role: "admin",
            status: "active",
          },
          take: 1,
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    }),
    prisma.organization.count(),
  ]);

  return {
    organizations,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    currentPage: page,
  };
}

export async function updateOrganizationSubscription(
  organizationId: string,
  data: {
    planId: string;
    maxMembers: number;
    scansPerMonth: number;
    scansPerHourPerUser: number;
    maxApiTokens: number;
  }
) {
  await requireSuperAdmin();

  await prisma.subscription.update({
    where: { organizationId },
    data,
  });

  return { success: true };
}

export async function deleteOrganizationAsAdmin(organizationId: string) {
  await requireSuperAdmin();

  await prisma.organization.delete({
    where: { id: organizationId },
  });

  return { success: true };
}

// ==========================================
// SUBSCRIPTION MANAGEMENT
// ==========================================

export async function getAllSubscriptions() {
  await requireSuperAdmin();

  const [personalSubscriptions, teamSubscriptions] = await Promise.all([
    prisma.personalSubscription.findMany({
      where: {
        plan: { not: "free" },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.subscription.findMany({
      where: {
        plan: { not: "team_free" },
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    personalSubscriptions,
    teamSubscriptions,
  };
}

// ==========================================
// ACTIVITY LOGS
// ==========================================

export async function getRecentActivity(limit = 50) {
  await requireSuperAdmin();

  // Get recent scans
  const recentScans = await prisma.scan.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
      organization: {
        select: {
          name: true,
        },
      },
    },
  });

  // Get recent user registrations
  const recentUsers = await prisma.user.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
    },
  });

  return {
    recentScans,
    recentUsers,
  };
}

// ==========================================
// SEARCH
// ==========================================

export async function searchUsers(query: string) {
  await requireSuperAdmin();

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: query, mode: "insensitive" } },
        { name: { contains: query, mode: "insensitive" } },
      ],
    },
    take: 20,
    include: {
      personalSubscription: true,
      _count: {
        select: {
          scans: true,
        },
      },
    },
  });

  return users;
}

export async function searchOrganizations(query: string) {
  await requireSuperAdmin();

  const organizations = await prisma.organization.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { slug: { contains: query, mode: "insensitive" } },
      ],
    },
    take: 20,
    include: {
      subscription: true,
      _count: {
        select: {
          members: true,
          scans: true,
        },
      },
    },
  });

  return organizations;
}
