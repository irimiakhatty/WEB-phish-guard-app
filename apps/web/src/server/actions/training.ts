"use server";

import prisma from "@phish-guard-app/db";
import { requireAuth, requireAdmin } from "@/lib/auth/auth-helpers";
import { classifyAttackType } from "@/lib/security/attack-types";
import { revalidatePath } from "next/cache";

export async function generateAndCreateTrainingAssignment(
  organizationId: string,
  userId: string,
  slug: string
) {
  const { user } = await requireAuth();

  // Verify user is admin
  const membership = await prisma.organizationMember.findFirst({
    where: {
      organizationId,
      userId: user.id,
    },
  });

  if (!membership || (membership.role !== "admin" && user.role !== "super_admin")) {
    throw new Error("Unauthorized");
  }

  // Get recent scans (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentScans = await prisma.scan.findMany({
    where: {
      organizationId,
      userId,
      isDeleted: false,
      createdAt: { gte: thirtyDaysAgo },
    },
  });

  // Calculate metrics
  const highCriticalCount = recentScans.filter(
    (s) => s.riskLevel === "high" || s.riskLevel === "critical"
  ).length;

  const avgScore =
    recentScans.length > 0
      ? recentScans.reduce((sum, s) => sum + s.overallScore, 0) / recentScans.length
      : 0;

  // Determine if training is needed
  const needsTraining =
    avgScore >= 0.6 || highCriticalCount > 0 || (recentScans.length > 5 && avgScore >= 0.4);

  if (!needsTraining) {
    return { created: false, message: "User does not meet criteria for training assignment" };
  }

  // Determine dominant attack type
  const attackTypeCount = new Map<string, number>();
  for (const scan of recentScans) {
    const attackType = classifyAttackType(
      `${scan.analysis || ""} ${scan.detectedThreats?.join(" ") || ""}`
    );
    attackTypeCount.set(attackType, (attackTypeCount.get(attackType) || 0) + 1);
  }

  const dominantAttack =
    Array.from(attackTypeCount.entries()).sort(([, a], [, b]) => b - a)[0]?.[0] ||
    "Other";

  // Generate recommendation
  const recommendation =
    highCriticalCount > 3
      ? `User has ${highCriticalCount} high/critical risk scans in last 30 days. Focus on ${dominantAttack} attack awareness.`
      : recentScans.length > 10
        ? `High scan volume (${recentScans.length} scans). Recommend ${dominantAttack} training.`
        : `Ongoing exposure to ${dominantAttack} threats. Training assignment recommended.`;

  // Check if training assignment already exists (last 7 days, same attack type)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const existing = await prisma.trainingAssignment.findFirst({
    where: {
      organizationId,
      userId,
      attackType: dominantAttack,
      createdAt: { gte: sevenDaysAgo },
    },
  });

  if (existing) {
    return { created: false, message: "Training assignment already exists for this attack type" };
  }

  // Create training assignment
  const assignment = await prisma.trainingAssignment.create({
    data: {
      organizationId,
      userId,
      attackType: dominantAttack,
      recommendation,
      source: "automatic",
      status: "assigned",
      assignedById: user.id,
      dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Due in 7 days
    },
  });

  revalidatePath(`/org/${slug}/members/${userId}`);

  return { created: true, assignmentId: assignment.id };
}

export async function getTrainingAssignments(organizationId: string, userId: string) {
  const { user } = await requireAuth();

  // Verify access
  const membership = await prisma.organizationMember.findFirst({
    where: {
      organizationId,
      userId: user.id,
    },
  });

  if (!membership && user.id !== userId) {
    throw new Error("Unauthorized");
  }

  const assignments = await prisma.trainingAssignment.findMany({
    where: {
      organizationId,
      userId,
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      assignedBy: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  return assignments;
}

export async function completeTrainingAssignment(assignmentId: string, slug: string) {
  const { user } = await requireAuth();

  const assignment = await prisma.trainingAssignment.findUnique({
    where: { id: assignmentId },
  });

  if (!assignment) {
    throw new Error("Assignment not found");
  }

  // Check authorization (only the assigned user or admin can complete)
  if (user.id !== assignment.userId) {
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId: assignment.organizationId,
        userId: user.id,
      },
    });

    if (!membership || (membership.role !== "admin" && user.role !== "super_admin")) {
      throw new Error("Unauthorized");
    }
  }

  const updated = await prisma.trainingAssignment.update({
    where: { id: assignmentId },
    data: {
      status: "completed",
      completedAt: new Date(),
    },
  });

  revalidatePath(`/org/${assignment.organizationId}/members/${assignment.userId}`);

  return updated;
}
