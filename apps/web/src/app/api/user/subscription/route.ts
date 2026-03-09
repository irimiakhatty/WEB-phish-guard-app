import { NextResponse } from "next/server";
import { auth } from "@phish-guard-app/auth";
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

    const subInfo = await getUserSubscriptionInfo(session.user.id);
    const plan = getPlanById(subInfo.planId);
    const organizationSlug =
      subInfo.adminOrganizationSlug ??
      subInfo.preferredOrganizationSlug ??
      subInfo.organizationSlug ??
      null;
    const isOrgAdmin = subInfo.isAnyOrgAdmin ?? subInfo.isOrgAdmin ?? false;

    return NextResponse.json({
      planId: subInfo.planId,
      planLabel: plan.name,
      status: subInfo.status ?? "active",
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
