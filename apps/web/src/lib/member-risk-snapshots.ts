import prisma from "@phish-guard-app/db";
import {
  deriveTrainingRecommendationFromIncidents,
  type TrainingIncidentInput,
} from "@/lib/training-recommendations";

const DEFAULT_WINDOW_DAYS = Number(process.env.MEMBER_RISK_SNAPSHOT_WINDOW_DAYS || 30);

function parseWindowDays(input?: number): number {
  const value = input ?? DEFAULT_WINDOW_DAYS;
  if (!Number.isFinite(value) || value <= 0) return 30;
  return Math.max(1, Math.min(180, Math.floor(value)));
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getRiskTier(score: number): "safe" | "low" | "medium" | "high" | "critical" {
  if (score >= 0.8) return "critical";
  if (score >= 0.6) return "high";
  if (score >= 0.4) return "medium";
  if (score >= 0.2) return "low";
  return "safe";
}

function makeMemberKey(organizationId: string, userId: string) {
  return `${organizationId}::${userId}`;
}

export type DailySnapshotJobSummary = {
  snapshotDate: string;
  windowDays: number;
  membersEvaluated: number;
  snapshotsUpserted: number;
};

export async function runDailyMemberRiskSnapshotJob(options?: {
  date?: Date;
  windowDays?: number;
}): Promise<DailySnapshotJobSummary> {
  const targetDate = options?.date ? new Date(options.date) : new Date();
  const snapshotDate = startOfUtcDay(targetDate);
  const windowDays = parseWindowDays(options?.windowDays);
  const windowStart = addUtcDays(snapshotDate, -windowDays);
  const windowEnd = addUtcDays(snapshotDate, 1);

  const members = await prisma.organizationMember.findMany({
    select: {
      organizationId: true,
      userId: true,
    },
  });

  if (members.length === 0) {
    return {
      snapshotDate: snapshotDate.toISOString(),
      windowDays,
      membersEvaluated: 0,
      snapshotsUpserted: 0,
    };
  }

  const [scanAgg, riskyAgg, riskyScans] = await Promise.all([
    prisma.scan.groupBy({
      by: ["organizationId", "userId"],
      where: {
        isDeleted: false,
        organizationId: { not: null },
        createdAt: {
          gte: windowStart,
          lt: windowEnd,
        },
      },
      _count: { id: true },
      _avg: { overallScore: true },
    }),
    prisma.scan.groupBy({
      by: ["organizationId", "userId"],
      where: {
        isDeleted: false,
        organizationId: { not: null },
        createdAt: {
          gte: windowStart,
          lt: windowEnd,
        },
        OR: [{ isPhishing: true }, { riskLevel: { in: ["high", "critical"] } }],
      },
      _count: { id: true },
    }),
    prisma.scan.findMany({
      where: {
        isDeleted: false,
        organizationId: { not: null },
        createdAt: {
          gte: windowStart,
          lt: windowEnd,
        },
        OR: [{ isPhishing: true }, { riskLevel: { in: ["high", "critical"] } }],
      },
      select: {
        organizationId: true,
        userId: true,
        detectedThreats: true,
        analysis: true,
      },
    }),
  ]);

  const scanStatsMap = new Map<string, { totalScans: number; avgScore: number }>();
  for (const row of scanAgg) {
    if (!row.organizationId) continue;
    scanStatsMap.set(makeMemberKey(row.organizationId, row.userId), {
      totalScans: row._count.id,
      avgScore: row._avg.overallScore ?? 0,
    });
  }

  const riskyCountMap = new Map<string, number>();
  for (const row of riskyAgg) {
    if (!row.organizationId) continue;
    riskyCountMap.set(makeMemberKey(row.organizationId, row.userId), row._count.id);
  }

  const incidentsMap = new Map<string, TrainingIncidentInput[]>();
  for (const scan of riskyScans) {
    if (!scan.organizationId) continue;
    const key = makeMemberKey(scan.organizationId, scan.userId);
    const current = incidentsMap.get(key) || [];
    current.push({
      detectedThreats: scan.detectedThreats || [],
      analysis: scan.analysis,
    });
    incidentsMap.set(key, current);
  }

  const upserts = members.map((member) => {
    const key = makeMemberKey(member.organizationId, member.userId);
    const stats = scanStatsMap.get(key) || { totalScans: 0, avgScore: 0 };
    const riskyScansCount = riskyCountMap.get(key) || 0;
    const recommendation = deriveTrainingRecommendationFromIncidents(
      incidentsMap.get(key) || [],
      windowDays
    );
    const riskTier = getRiskTier(stats.avgScore);

    return prisma.memberRiskSnapshot.upsert({
      where: {
        organizationId_userId_snapshotDate: {
          organizationId: member.organizationId,
          userId: member.userId,
          snapshotDate,
        },
      },
      create: {
        organizationId: member.organizationId,
        userId: member.userId,
        snapshotDate,
        windowDays,
        totalScans: stats.totalScans,
        riskyScans: riskyScansCount,
        avgScore: stats.avgScore,
        riskTier,
        dominantAttackType: recommendation.dominantAttackType,
        recommendation: recommendation.recommendation,
      },
      update: {
        windowDays,
        totalScans: stats.totalScans,
        riskyScans: riskyScansCount,
        avgScore: stats.avgScore,
        riskTier,
        dominantAttackType: recommendation.dominantAttackType,
        recommendation: recommendation.recommendation,
      },
    });
  });

  const chunkSize = 100;
  for (let index = 0; index < upserts.length; index += chunkSize) {
    const chunk = upserts.slice(index, index + chunkSize);
    await prisma.$transaction(chunk);
  }

  return {
    snapshotDate: snapshotDate.toISOString(),
    windowDays,
    membersEvaluated: members.length,
    snapshotsUpserted: upserts.length,
  };
}
