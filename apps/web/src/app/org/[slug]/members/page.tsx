import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import prisma from "@phish-guard-app/db";
import { requireAuth } from "@/lib/auth-helpers";
import { getOrganization } from "@/app/actions/organizations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Users, AlertTriangle, Shield, Activity, TrendingUp } from "lucide-react";

interface PageProps {
  params: Promise<{ slug: string }>;
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
  safe: "border-emerald-200 text-emerald-700 bg-emerald-50/70",
  low: "border-blue-200 text-blue-700 bg-blue-50/70",
  medium: "border-yellow-200 text-yellow-700 bg-yellow-50/70",
  high: "border-orange-200 text-orange-700 bg-orange-50/70",
  critical: "border-red-200 text-red-700 bg-red-50/70",
};

const getRiskTier = (score: number): RiskTier => {
  if (score >= 0.8) return "critical";
  if (score >= 0.6) return "high";
  if (score >= 0.4) return "medium";
  if (score >= 0.2) return "low";
  return "safe";
};

export default async function OrganizationMembersPage({ params }: PageProps) {
  const { user } = await requireAuth();
  const { slug } = await params;

  const organization = await getOrganization(slug);
  if (!organization) {
    notFound();
  }

  const isSuperAdmin = user.role === "super_admin";
  const membership = organization.members.find((m) => m.userId === user.id);
  const isAdmin = isSuperAdmin || membership?.role === "admin";

  if (!isAdmin) {
    redirect(`/org/${slug}`);
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [scanAgg, riskyAgg, scansThisMonth] = await Promise.all([
    prisma.scan.groupBy({
      by: ["userId"],
      where: {
        organizationId: organization.id,
        isDeleted: false,
      },
      _count: { id: true },
      _avg: { overallScore: true },
      _max: { createdAt: true },
    }),
    prisma.scan.groupBy({
      by: ["userId"],
      where: {
        organizationId: organization.id,
        isDeleted: false,
        riskLevel: { in: ["high", "critical"] },
      },
      _count: { id: true },
    }),
    prisma.scan.count({
      where: {
        organizationId: organization.id,
        isDeleted: false,
        createdAt: { gte: startOfMonth },
      },
    }),
  ]);

  const statsByUserId = new Map<
    string,
    { totalScans: number; avgScore: number; lastSeen: Date | null; riskyCount: number }
  >();

  scanAgg.forEach((row) => {
    statsByUserId.set(row.userId, {
      totalScans: row._count.id,
      avgScore: row._avg.overallScore ?? 0,
      lastSeen: row._max.createdAt ?? null,
      riskyCount: 0,
    });
  });

  riskyAgg.forEach((row) => {
    const existing = statsByUserId.get(row.userId) || {
      totalScans: 0,
      avgScore: 0,
      lastSeen: null,
      riskyCount: 0,
    };
    existing.riskyCount = row._count.id;
    statsByUserId.set(row.userId, existing);
  });

  const membersWithStats = organization.members.map((member) => {
    const stats = statsByUserId.get(member.userId) || {
      totalScans: 0,
      avgScore: 0,
      lastSeen: null,
      riskyCount: 0,
    };
    const riskTier = getRiskTier(stats.avgScore);
    const lastSeenLabel = stats.lastSeen
      ? new Date(stats.lastSeen).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "No activity";

    return {
      id: member.id,
      userId: member.userId,
      role: member.role,
      joinedAt: new Date(member.joinedAt).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      user: member.user,
      totalScans: stats.totalScans,
      riskyCount: stats.riskyCount,
      avgScore: stats.avgScore,
      lastSeenLabel,
      riskTier,
    };
  });

  const riskyUsersCount = membersWithStats.filter((m) => m.riskyCount > 0).length;
  const sortedMembers = [...membersWithStats].sort((a, b) => {
    if (b.riskyCount !== a.riskyCount) {
      return b.riskyCount - a.riskyCount;
    }
    return b.totalScans - a.totalScans;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/20 to-purple-50/20 dark:from-gray-950 dark:via-blue-950/20 dark:to-purple-950/20">
      <div className="container mx-auto max-w-7xl px-4 py-10 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href={`/org/${slug}`}>
              <Button variant="ghost" className="mb-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to organization
              </Button>
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Team Members
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Track exposure and follow up with targeted security training.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary">
              {organization.members.length} members
            </Badge>
            <Badge variant="outline">@{organization.slug}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80">
            <CardHeader className="pb-2">
              <CardDescription>Total members</CardDescription>
              <CardTitle className="text-3xl">{organization.members.length}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-gray-500 dark:text-gray-400">
              Active seats in your organization
            </CardContent>
          </Card>
          <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80">
            <CardHeader className="pb-2">
              <CardDescription>Pending invites</CardDescription>
              <CardTitle className="text-3xl">{organization.invites.length}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-gray-500 dark:text-gray-400">
              Waiting for activation
            </CardContent>
          </Card>
          <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80">
            <CardHeader className="pb-2">
              <CardDescription>Risky users</CardDescription>
              <CardTitle className="text-3xl text-red-600">{riskyUsersCount}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-gray-500 dark:text-gray-400">
              High or critical events detected
            </CardContent>
          </Card>
          <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80">
            <CardHeader className="pb-2">
              <CardDescription>Scans this month</CardDescription>
              <CardTitle className="text-3xl text-blue-600">{scansThisMonth}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-gray-500 dark:text-gray-400">
              Organization activity in the last 30 days
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {sortedMembers.map((member) => (
            <Card
              key={member.id}
              className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80 hover:shadow-xl transition-shadow"
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={member.user.image || undefined} />
                      <AvatarFallback>
                        {member.user.name?.[0] || member.user.email[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg text-gray-900 dark:text-white">
                        {member.user.name || "Unnamed user"}
                      </CardTitle>
                      <CardDescription>{member.user.email}</CardDescription>
                    </div>
                  </div>
                  <Badge variant={member.role === "admin" ? "default" : "secondary"}>
                    {member.role === "admin" ? "Admin" : "Member"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-xs font-semibold border rounded-full px-2 py-1 ${riskTierClass[member.riskTier]}`}
                  >
                    {riskTierLabel[member.riskTier]}
                  </span>
                  {member.riskyCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-red-600">
                      <AlertTriangle className="w-3 h-3" />
                      Training suggested
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-gray-200/70 dark:border-gray-800/70 p-3">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Activity className="w-3 h-3" />
                      Total scans
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {member.totalScans}
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-200/70 dark:border-gray-800/70 p-3">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Shield className="w-3 h-3" />
                      Risky events
                    </div>
                    <div className="text-lg font-semibold text-red-600">
                      {member.riskyCount}
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-200/70 dark:border-gray-800/70 p-3">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <TrendingUp className="w-3 h-3" />
                      Avg risk
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {(member.avgScore * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="rounded-lg border border-gray-200/70 dark:border-gray-800/70 p-3">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Users className="w-3 h-3" />
                      Last seen
                    </div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {member.lastSeenLabel}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Joined {member.joinedAt}</span>
                  <Link href={`/org/${slug}/members/${member.userId}`}>
                    <Button variant="outline" size="sm">
                      View profile
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
