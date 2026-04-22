import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import prisma from "@phish-guard-app/db";
import { requireAuth } from "@/lib/auth/auth-helpers";
import { getOrganization } from "@/server/actions/organizations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, AlertTriangle, CheckCircle, Activity, Shield, TrendingUp } from "lucide-react";
import { ATTACK_TYPES, classifyAttackType } from "@/lib/security/attack-types";

interface PageProps {
  params: Promise<{ slug: string; userId: string }>;
}

type RiskTier = "safe" | "low" | "medium" | "high" | "critical";

const riskTierLabel: Record<RiskTier, string> = {
  safe: "Safe",
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const riskTierClass: Record<RiskTier, string> = {
  safe: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  low: "border-white/10 bg-white/[0.03] text-zinc-200",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  high: "border-orange-500/30 bg-orange-500/10 text-orange-200",
  critical: "border-red-500/30 bg-red-500/10 text-red-200",
};

const scanRiskClass: Record<RiskTier, string> = {
  safe: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  low: "border-white/10 bg-white/[0.03] text-zinc-200",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  high: "border-orange-500/30 bg-orange-500/10 text-orange-200",
  critical: "border-red-500/30 bg-red-500/10 text-red-200",
};

const dayKeyUtc = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
    .toISOString()
    .slice(0, 10);

const weekStartUtc = (date: Date) => {
  const base = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = (base.getUTCDay() + 6) % 7;
  base.setUTCDate(base.getUTCDate() - day);
  return base;
};

const getRiskTier = (score: number): RiskTier => {
  if (score >= 0.8) return "critical";
  if (score >= 0.6) return "high";
  if (score >= 0.4) return "medium";
  if (score >= 0.2) return "low";
  return "safe";
};

export default async function MemberProfilePage({ params }: PageProps) {
  const { user } = await requireAuth();
  const { slug, userId } = await params;

  const organization = await getOrganization(slug);
  if (!organization) {
    notFound();
  }

  const isSuperAdmin = user.role === "super_admin";
  const membership = organization.members.find((member) => member.userId === user.id);
  const isAdmin = isSuperAdmin || membership?.role === "admin";

  if (!isAdmin && user.id !== userId) {
    redirect(`/org/${slug}/members`);
  }

  const member = organization.members.find((organizationMember) => organizationMember.userId === userId);
  if (!member) {
    notFound();
  }

  const now = new Date();
  const weeksToShow = 8;
  const daysToShow = 28;
  const trendStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  trendStart.setUTCDate(trendStart.getUTCDate() - weeksToShow * 7 + 1);

  const attackWindowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  attackWindowStart.setUTCDate(attackWindowStart.getUTCDate() - 90);

  const [
    totalScans,
    riskyCount,
    avgScoreAgg,
    recentScans,
    activityScans,
    riskLevelAgg,
    attackScans,
  ] = await Promise.all([
    prisma.scan.count({
      where: { organizationId: organization.id, userId, isDeleted: false },
    }),
    prisma.scan.count({
      where: {
        organizationId: organization.id,
        userId,
        isDeleted: false,
        riskLevel: { in: ["high", "critical"] },
      },
    }),
    prisma.scan.aggregate({
      where: { organizationId: organization.id, userId, isDeleted: false },
      _avg: { overallScore: true },
    }),
    prisma.scan.findMany({
      where: { organizationId: organization.id, userId, isDeleted: false },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.scan.findMany({
      where: {
        organizationId: organization.id,
        userId,
        isDeleted: false,
        createdAt: { gte: trendStart },
      },
      select: { createdAt: true, overallScore: true },
    }),
    prisma.scan.groupBy({
      by: ["riskLevel"],
      where: { organizationId: organization.id, userId, isDeleted: false },
      _count: { id: true },
    }),
    prisma.scan.findMany({
      where: {
        organizationId: organization.id,
        userId,
        isDeleted: false,
        createdAt: { gte: attackWindowStart },
      },
      select: {
        detectedThreats: true,
        analysis: true,
      },
    }),
  ]);

  const avgScore = avgScoreAgg._avg.overallScore ?? 0;
  const riskTier = getRiskTier(avgScore);
  const lastSeen = recentScans[0]?.createdAt
    ? new Date(recentScans[0].createdAt).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "No activity";

  const orderedRiskLevels: RiskTier[] = ["safe", "low", "medium", "high", "critical"];
  const riskCounts = orderedRiskLevels.map((level) => {
    const match = riskLevelAgg.find((row) => row.riskLevel === level);
    return { level, count: match?._count.id || 0 };
  });

  const totalRiskEvents = riskCounts.reduce((sum, item) => sum + item.count, 0) || 1;

  const attackTypeCounts = new Map<string, number>();
  ATTACK_TYPES.forEach((type) => attackTypeCounts.set(type, 0));
  for (const scan of attackScans) {
    const attackTypeHint = scan.detectedThreats?.find((threat) => threat.startsWith("attack_type:"));
    const attackType = attackTypeHint
      ? attackTypeHint.replace("attack_type:", "")
      : classifyAttackType(`${scan.analysis || ""} ${scan.detectedThreats?.join(" ") || ""}`);
    attackTypeCounts.set(attackType, (attackTypeCounts.get(attackType) || 0) + 1);
  }
  const attackHeatmap = Array.from(attackTypeCounts.entries()).map(([type, count]) => ({
    type,
    count,
  }));
  const attackHeatMax = Math.max(1, ...attackHeatmap.map((item) => item.count));
  const dominantAttack = [...attackHeatmap].sort((left, right) => right.count - left.count)[0] || null;
  const reviewedThreatEvents = attackHeatmap.reduce((sum, item) => sum + item.count, 0);

  const dayCounts = new Map<string, number>();
  for (const scan of activityScans) {
    const key = dayKeyUtc(scan.createdAt);
    dayCounts.set(key, (dayCounts.get(key) || 0) + 1);
  }

  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const heatmapStart = new Date(todayUtc);
  heatmapStart.setUTCDate(heatmapStart.getUTCDate() - daysToShow + 1);
  const heatmapDays = Array.from({ length: daysToShow }).map((_, index) => {
    const date = new Date(heatmapStart);
    date.setUTCDate(heatmapStart.getUTCDate() + index);
    const key = dayKeyUtc(date);
    return {
      key,
      date,
      count: dayCounts.get(key) || 0,
    };
  });
  const maxDaily = Math.max(1, ...heatmapDays.map((day) => day.count));

  const currentWeekStart = weekStartUtc(todayUtc);
  const weekStarts = Array.from({ length: weeksToShow }).map((_, index) => {
    const date = new Date(currentWeekStart);
    date.setUTCDate(currentWeekStart.getUTCDate() - 7 * (weeksToShow - 1 - index));
    return date;
  });
  const weekCounts = Array.from({ length: weeksToShow }).map(() => 0);

  for (const scan of activityScans) {
    const weekStart = weekStartUtc(scan.createdAt);
    const index = Math.floor(
      (weekStart.getTime() - weekStarts[0].getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    if (index >= 0 && index < weekCounts.length) {
      weekCounts[index] += 1;
    }
  }
  const maxWeek = Math.max(1, ...weekCounts);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-[1680px] space-y-8 px-6 py-10 sm:px-8 lg:px-12">
        <div>
          <Link href={`/org/${slug}/members`}>
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to members
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-zinc-100">Member profile</h1>
          <p className="text-sm text-muted-foreground">
            Risk signals and activity insights for this employee.
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={member.user.image || undefined} />
                <AvatarFallback>
                  {member.user.name?.[0] || member.user.email[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-2xl text-zinc-100">
                  {member.user.name || "Unnamed user"}
                </CardTitle>
                <CardDescription>{member.user.email}</CardDescription>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant={member.role === "admin" ? "default" : "secondary"}>
                    {member.role === "admin" ? "Admin" : "Member"}
                  </Badge>
                  <span
                    className={`text-xs font-semibold border rounded-full px-2 py-1 ${riskTierClass[riskTier]}`}
                  >
                    {riskTierLabel[riskTier]} risk
                  </span>
                </div>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Joined{" "}
              {new Date(member.joinedAt).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="rounded-lg bg-muted/30 p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Activity className="w-3 h-3" />
                  Total scans
                </div>
                <div className="text-2xl font-semibold text-zinc-100">{totalScans}</div>
              </div>
              <div className="rounded-lg bg-muted/30 p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <AlertTriangle className="w-3 h-3" />
                  Risky events
                </div>
                <div className="text-2xl font-semibold text-red-400">{riskyCount}</div>
              </div>
              <div className="rounded-lg bg-muted/30 p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <TrendingUp className="w-3 h-3" />
                  Avg risk
                </div>
                <div className="text-2xl font-semibold text-zinc-100">
                  {(avgScore * 100).toFixed(0)}%
                </div>
              </div>
              <div className="rounded-lg bg-muted/30 p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Shield className="w-3 h-3" />
                  Last seen
                </div>
                <div className="text-sm font-medium text-zinc-100">{lastSeen}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Activity heatmap</CardTitle>
              <CardDescription>Last 28 days of scans</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2">
                {heatmapDays.map((day) => {
                  const intensity = day.count / maxDaily;
                  const background = `rgba(113, 113, 122, ${0.12 + intensity * 0.68})`;
                  return (
                    <div
                      key={day.key}
                      title={`${day.key} - ${day.count} scans`}
                      className="h-9 w-9 rounded-lg"
                      style={{ backgroundColor: background }}
                    />
                  );
                })}
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span>Low</span>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <span
                      key={index}
                      className="h-2.5 w-2.5 rounded-sm border border-white/10"
                      style={{ backgroundColor: `rgba(113,113,122,${0.2 + index * 0.2})` }}
                    />
                  ))}
                </div>
                <span>High</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monthly trend</CardTitle>
              <CardDescription>Scans in the last 8 weeks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3 h-36">
                {weekCounts.map((count, index) => {
                  const height = Math.max(8, (count / maxWeek) * 120);
                  const label = weekStarts[index]
                    .toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
                    .replace(".", "");
                  return (
                    <div key={label} className="flex flex-col items-center gap-2 flex-1">
                      <div
                        className="w-full rounded-md bg-gradient-to-t from-violet-400/40 via-indigo-400/25 to-sky-400/20"
                        style={{ height }}
                        title={`${count} scans`}
                      />
                      <span className="text-[10px] text-muted-foreground">{label}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Attack type heatmap</CardTitle>
              <CardDescription>Most common attack vectors (last 90 days)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {attackHeatmap.map((item) => {
                  const intensity = item.count / attackHeatMax;
                  const intensityPct = Math.round(intensity * 100);
                  const barWidth = intensityPct === 0 ? 0 : Math.max(4, intensityPct);
                  return (
                    <div
                      key={item.type}
                      className="group relative overflow-hidden rounded-xl bg-muted/30 p-4 transition-colors hover:bg-muted/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{item.type}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{item.count} incidents</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-muted/50 px-2 py-1 text-[11px] font-semibold text-foreground/80">
                          {intensityPct}%
                        </span>
                      </div>

                      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-400/70 via-indigo-400/60 to-sky-400/55"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Threat pattern summary</CardTitle>
              <CardDescription>Dominant vector across the last 90 days of risky activity.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dominantAttack && dominantAttack.count > 0 ? (
                <>
                  <Badge variant="outline">Dominant attack: {dominantAttack.type}</Badge>
                  <p className="text-sm text-muted-foreground">
                    {dominantAttack.count} of {reviewedThreatEvents} reviewed threat event
                    {reviewedThreatEvents === 1 ? "" : "s"} matched this pattern.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No repeated attack pattern detected in the current 90-day review window.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1">
          <Card>
            <CardHeader>
              <CardTitle>Risk distribution</CardTitle>
              <CardDescription>Share of scans by risk level</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {riskCounts.map((item) => {
                  const percent = Math.round((item.count / totalRiskEvents) * 100);
                  return (
                    <div
                      key={item.level}
                      className="rounded-xl bg-muted/30 p-4"
                    >
                      <div
                        className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${riskTierClass[item.level]}`}
                      >
                        {riskTierLabel[item.level]}
                      </div>
                      <div className="mt-3 text-2xl font-semibold text-zinc-100">{item.count}</div>
                      <div className="text-xs text-muted-foreground">{percent}% of scans</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-zinc-100">Recent scans</h2>
            <Badge variant="outline">{recentScans.length} events</Badge>
          </div>
          {recentScans.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No scans recorded for this member yet.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {recentScans.map((scan) => {
                const level = (scan.riskLevel as RiskTier) || "safe";
                return (
                  <Card
                    key={scan.id}
                    className="transition-colors hover:bg-muted/30"
                  >
                    <CardContent className="py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-semibold border rounded-full px-2 py-1 ${scanRiskClass[level]}`}
                          >
                            {scan.riskLevel.toUpperCase()}
                          </span>
                          {scan.isPhishing ? (
                            <span className="text-xs text-red-400 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Phishing detected
                            </span>
                          ) : (
                            <span className="text-xs text-emerald-400 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Safe
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-medium text-zinc-100">
                          {scan.url ? scan.url : "Text content analysis"}
                        </div>
                        <div className="text-xs text-muted-foreground">{new Date(scan.createdAt).toLocaleString("en-GB")}</div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Score {(scan.overallScore * 100).toFixed(0)}%
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
