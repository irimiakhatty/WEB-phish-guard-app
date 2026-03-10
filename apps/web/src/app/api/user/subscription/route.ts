import { NextResponse } from "next/server";
import { auth } from "@phish-guard-app/auth";
import { getUserBillingSummaries } from "@/lib/billing-helpers";
import { getUserSubscriptionInfo } from "@/lib/subscription-helpers";
import { getPlanById } from "@/lib/subscription-plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role === "super_admin") {
      return NextResponse.json({
        planId: "super_admin",
        planLabel: "Super Admin",
        status: "active",
        organizationSlug: null,
        isOrgAdmin: false,
      });
    }

    const [billing, accessInfo] = await Promise.all([
      getUserBillingSummaries(session.user.id),
      getUserSubscriptionInfo(session.user.id),
    ]);
    const activeBilling = billing.business ?? billing.personal;
    const plan = getPlanById(activeBilling.planId);
    const organizationSlug =
      accessInfo.adminOrganizationSlug ??
      accessInfo.preferredOrganizationSlug ??
      accessInfo.organizationSlug ??
      null;
    const isOrgAdmin = accessInfo.isAnyOrgAdmin ?? accessInfo.isOrgAdmin ?? false;

    return NextResponse.json({
      planId: activeBilling.planId,
      planLabel: plan.name,
      status: activeBilling.status ?? "active",
      organizationSlug,
      isOrgAdmin,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load subscription plan." },
      { status: 500 }
    );
  }
}
