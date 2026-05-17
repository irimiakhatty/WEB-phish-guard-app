import { NextRequest, NextResponse } from "next/server";
import { verifyApiToken } from "@/lib/auth/api-auth";
import { getRiskReport } from "@phish-guard-app/backend/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/admin/reports
 * Return aggregated risk data for dashboard.
 * Requires: Bearer token authentication (super admin)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyApiToken();
    if (
      !authResult.authorized ||
      !authResult.user ||
      authResult.user.role !== "super_admin"
    ) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const report = await getRiskReport();

    return NextResponse.json({
      success: true,
      data: {
        ...report,
      },
    });
  } catch (error) {
    console.error("API admin/reports error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
