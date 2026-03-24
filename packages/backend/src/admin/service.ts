import prisma from "@phish-guard-app/db";

const PERSONAL_PLAN_PRICES: Record<string, number> = {
  personal_plus: 10,
  personal_pro: 20,
};

const TEAM_PLAN_PRICES: Record<string, number> = {
  team_startup: 29,
  team_business: 59,
  team_enterprise: 100,
};

function sumEstimatedRevenue<T extends { plan: string }>(
  subscriptions: T[],
  prices: Record<string, number>
) {
  return subscriptions.reduce((sum, subscription) => sum + (prices[subscription.plan] ?? 0), 0);
}

function sumRevenueAtRisk<T extends { plan: string; cancelAtPeriodEnd: boolean }>(
  subscriptions: T[],
  prices: Record<string, number>
) {
  return subscriptions.reduce((sum, subscription) => {
    if (!subscription.cancelAtPeriodEnd) {
      return sum;
    }

    return sum + (prices[subscription.plan] ?? 0);
  }, 0);
}

const adminUserInclude = {
  personalSubscription: true,
  memberships: {
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
} as const;

const adminOrganizationInclude = {
  subscription: true,
  _count: {
    select: {
      members: true,
      scans: true,
    },
  },
  members: {
    where: {
      role: "admin",
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
} as const;

export async function getGlobalStats() {
  const [
    totalUsers,
    totalOrganizations,
    totalScans,
    totalApiTokens,
    recentUsers,
    recentOrganizations,
    activePersonalSubscriptions,
    activeTeamSubscriptions,
    activePersonalPlans,
    activeTeamPlans,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.organization.count(),
    prisma.scan.count(),
    prisma.apiToken.count({ where: { isActive: true } }),
    prisma.user.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.organization.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    }),
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
    prisma.personalSubscription.findMany({
      where: {
        status: "active",
        plan: { not: "free" },
      },
      select: {
        plan: true,
        cancelAtPeriodEnd: true,
      },
    }),
    prisma.subscription.findMany({
      where: {
        status: "active",
        plan: { not: "team_free" },
      },
      select: {
        plan: true,
        cancelAtPeriodEnd: true,
      },
    }),
  ]);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const scansLastSevenDays = await prisma.scan.count({
    where: {
      createdAt: { gte: sevenDaysAgo },
    },
  });

  const activeSubscriptions = activePersonalSubscriptions + activeTeamSubscriptions;
  const personalMonthlyRevenue = sumEstimatedRevenue(activePersonalPlans, PERSONAL_PLAN_PRICES);
  const teamMonthlyRevenue = sumEstimatedRevenue(activeTeamPlans, TEAM_PLAN_PRICES);
  const estimatedMonthlyRevenue = personalMonthlyRevenue + teamMonthlyRevenue;
  const projectedAnnualRevenue = estimatedMonthlyRevenue * 12;
  const subscriptionsCancelingAtPeriodEnd =
    activePersonalPlans.filter((subscription) => subscription.cancelAtPeriodEnd).length +
    activeTeamPlans.filter((subscription) => subscription.cancelAtPeriodEnd).length;
  const revenueAtRiskMonthly =
    sumRevenueAtRisk(activePersonalPlans, PERSONAL_PLAN_PRICES) +
    sumRevenueAtRisk(activeTeamPlans, TEAM_PLAN_PRICES);
  const avgRevenuePerPaidSubscription =
    activeSubscriptions > 0 ? estimatedMonthlyRevenue / activeSubscriptions : 0;
  const paidUserRate = totalUsers > 0 ? activePersonalSubscriptions / totalUsers : 0;
  const paidOrganizationRate = totalOrganizations > 0 ? activeTeamSubscriptions / totalOrganizations : 0;

  return {
    totalUsers,
    totalOrganizations,
    totalScans,
    totalApiTokens,
    activeSubscriptions,
    recentUsers,
    recentOrganizations,
    scansByDay: scansLastSevenDays,
    billing: {
      activePersonalSubscriptions,
      activeTeamSubscriptions,
      estimatedMonthlyRevenue,
      personalMonthlyRevenue,
      teamMonthlyRevenue,
      projectedAnnualRevenue,
      subscriptionsCancelingAtPeriodEnd,
      revenueAtRiskMonthly,
      avgRevenuePerPaidSubscription,
      paidUserRate,
      paidOrganizationRate,
    },
  };
}

export async function getAllUsers(page = 1, limit = 50) {
  const skip = (page - 1) * limit;

  const [users, totalCount] = await Promise.all([
    prisma.user.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: adminUserInclude,
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
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!targetUser) {
    throw new Error("User not found");
  }

  if (targetUser.role === "super_admin") {
    throw new Error("You cannot modify the super admin role");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role },
  });

  return { success: true };
}

export async function deleteUser(userId: string) {
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!targetUser) {
    throw new Error("User not found");
  }

  if (targetUser.role === "super_admin") {
    throw new Error("You cannot delete the super admin account");
  }

  await prisma.user.delete({
    where: { id: userId },
  });

  return { success: true };
}

export async function getAllOrganizations(page = 1, limit = 50) {
  const skip = (page - 1) * limit;

  const [organizations, totalCount] = await Promise.all([
    prisma.organization.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: adminOrganizationInclude,
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
    plan: string;
    maxMembers: number;
    scansPerMonth: number;
    scansPerHourPerUser: number;
    maxApiTokens: number;
  }
) {
  await prisma.subscription.update({
    where: { organizationId },
    data,
  });

  return { success: true };
}

export async function deleteOrganizationAsAdmin(organizationId: string) {
  await prisma.organization.delete({
    where: { id: organizationId },
  });

  return { success: true };
}

export async function getAllSubscriptions() {
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

export async function getRecentActivity(limit = 50) {
  const recentScans = await prisma.scan.findMany({
    where: {
      isDeleted: false,
    },
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
          slug: true,
        },
      },
    },
  });

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

export async function searchUsers(query: string) {
  return prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: query, mode: "insensitive" } },
        { name: { contains: query, mode: "insensitive" } },
      ],
    },
    take: 20,
    orderBy: { createdAt: "desc" },
    include: adminUserInclude,
  });
}

export async function searchOrganizations(query: string) {
  return prisma.organization.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { slug: { contains: query, mode: "insensitive" } },
      ],
    },
    take: 20,
    orderBy: { createdAt: "desc" },
    include: adminOrganizationInclude,
  });
}