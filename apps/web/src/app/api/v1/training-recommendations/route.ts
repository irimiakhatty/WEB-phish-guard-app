import { NextRequest, NextResponse } from "next/server";
import prisma from "@phish-guard-app/db";
import { classifyAttackType } from "@/lib/security/attack-types";

export async function GET(req: NextRequest) {
  try {
    const organizationId = req.nextUrl.searchParams.get("organizationId");
    const userId = req.nextUrl.searchParams.get("userId");

    if (!organizationId || !userId) {
      return NextResponse.json(
        { error: "organizationId and userId are required" },
        { status: 400 }
      );
    }

    // Verify member exists
    const member = await prisma.organizationMember.findFirst({
      where: { organizationId, userId },
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
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
      orderBy: { createdAt: "desc" },
    });

    // Calculate attack types and risk levels
    const attackTypeCount = new Map<string, number>();
    const highCriticalCount = recentScans.filter(
      (s) => s.riskLevel === "high" || s.riskLevel === "critical"
    ).length;

    for (const scan of recentScans) {
      const attackType = classifyAttackType(
        `${scan.analysis || ""} ${scan.detectedThreats?.join(" ") || ""}`
      );
      attackTypeCount.set(attackType, (attackTypeCount.get(attackType) || 0) + 1);
    }

    // Determine dominant attack type
    const dominantAttack =
      Array.from(attackTypeCount.entries()).sort(([, a], [, b]) => b - a)[0]?.[0] ||
      "Other";

    // Determine if training is needed
    const avgScore =
      recentScans.length > 0
        ? recentScans.reduce((sum, s) => sum + s.overallScore, 0) / recentScans.length
        : 0;

    const needsTraining =
      avgScore >= 0.6 || highCriticalCount > 0 || (recentScans.length > 5 && avgScore >= 0.4);

    const recommendation =
      highCriticalCount > 3
        ? `User has ${highCriticalCount} high/critical risk scans in last 30 days. Focus on ${dominantAttack} attack awareness.`
        : recentScans.length > 10
          ? `High scan volume (${recentScans.length} scans). Recommend ${dominantAttack} training.`
          : `Ongoing exposure to ${dominantAttack} threats. Training assignment recommended.`;

    return NextResponse.json({
      needsTraining,
      avgScore,
      totalScans: recentScans.length,
      highCriticalCount,
      dominantAttack,
      recommendation,
      riskTier: avgScore >= 0.8 ? "critical" : avgScore >= 0.6 ? "high" : "medium",
    });
  } catch (error) {
    console.error("Training recommendations error:", error);
    return NextResponse.json(
      { error: "Failed to generate recommendations" },
      { status: 500 }
    );
  }
}
