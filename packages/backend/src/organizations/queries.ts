import prisma from "@phish-guard-app/db";
import { isSuperAdmin } from "./helpers";
import { ACTIVE_INVITE_STATUSES } from "./shared";
import type { OrganizationActor } from "./types";

export async function getOrganization(actor: OrganizationActor, slug: string) {
  const organization = await prisma.organization.findUnique({
    where: { slug },
    include: {
      subscription: true,
      members: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              image: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { joinedAt: "asc" },
      },
      organizationDepartments: {
        orderBy: { name: "asc" },
      },
      invites: {
        where: {
          status: { in: ACTIVE_INVITE_STATUSES },
          expiresAt: { gte: new Date() },
        },
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: {
          scans: true,
        },
      },
    },
  });

  if (!organization) {
    return null;
  }

  const isMember = organization.members.some((member) => member.userId === actor.id);

  if (!isSuperAdmin(actor) && !isMember) {
    return null;
  }

  return organization;
}

export async function getUserOrganizations(actor: OrganizationActor) {
  if (isSuperAdmin(actor)) {
    const organizations = await prisma.organization.findMany({
      include: {
        subscription: true,
        members: {
          where: { role: "admin" },
          include: { user: true },
        },
        _count: {
          select: {
            members: true,
            scans: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return organizations.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      role: "Super Admin",
      subscription: org.subscription,
      memberCount: org._count.members,
      scanCount: org._count.scans,
      joinedAt: org.createdAt,
      admins: org.members.map((member) => member.user),
    }));
  }

  const memberships = await prisma.organizationMember.findMany({
    where: {
      userId: actor.id,
    },
    include: {
      organization: {
        include: {
          subscription: true,
          members: {
            where: { role: "admin" },
            include: { user: true },
          },
          _count: {
            select: {
              members: true,
              scans: true,
            },
          },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  return memberships
    .map((membership) => ({
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      role: membership.role,
      subscription: membership.organization.subscription,
      memberCount: membership.organization._count.members,
      scanCount: membership.organization._count.scans,
      joinedAt: membership.joinedAt,
      admins: membership.organization.members.map((member) => member.user),
    }))
    .sort((a, b) => {
      const adminDiff = Number(b.role === "admin") - Number(a.role === "admin");
      if (adminDiff !== 0) {
        return adminDiff;
      }

      return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime();
    });
}