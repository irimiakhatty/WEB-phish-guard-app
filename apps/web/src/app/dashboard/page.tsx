import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-helpers";
import { getUserStats, getAdminStats, getOrgAdminStats } from "@/app/actions/scans";
import { getUserSubscriptionInfo } from "@/lib/subscription-helpers";
import { getUserTrainingRecommendation } from "@/lib/training-recommendations";
import Dashboard from "./dashboard";

export default async function DashboardPage() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  const userRole = (session.user as { role?: string }).role;
  const isSuperAdmin = userRole === "super_admin";
  if (isSuperAdmin) {
    redirect("/admin");
  }
  const stats = isSuperAdmin ? await getAdminStats() : await getUserStats();
  const orgAdminStats = isSuperAdmin ? null : await getOrgAdminStats();
  const subscriptionInfo = isSuperAdmin ? null : await getUserSubscriptionInfo(session.user.id);
  const trainingRecommendation = isSuperAdmin
    ? null
    : await getUserTrainingRecommendation(session.user.id);
  const serializedSubscription = subscriptionInfo
    ? {
        ...subscriptionInfo,
        currentPeriodEnd: subscriptionInfo.currentPeriodEnd
          ? subscriptionInfo.currentPeriodEnd.toISOString()
          : null,
      }
    : null;

  return (
    <Dashboard
      session={session}
      stats={stats}
      orgAdminStats={orgAdminStats}
      subscriptionInfo={serializedSubscription}
      trainingRecommendation={trainingRecommendation}
    />
  );
}
