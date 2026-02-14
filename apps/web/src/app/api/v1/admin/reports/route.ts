import { NextRequest, NextResponse } from "next/server";
import { verifyApiToken } from "@/lib/api-auth";
import prisma from "../../../../../../packages/db/src";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/admin/reports
 * Return aggregated risk data for dashboard (departamente, angajați, evoluție incidente)
 * Requires: Bearer token authentication (admin)
 */
export async function GET(request: NextRequest) {
  try {
    // Auth
    const authResult = await verifyApiToken();
    if (!authResult.authorized || !authResult.user || authResult.user.role !== 'super_admin') {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Top departamente cu risc (număr emailuri suspecte, număr clickuri)
    const departments = await db.userAction.groupBy({
      by: ['departmentId'],
      _count: { id: true },
      where: { actionType: 'clicked_suspicious_link' },
      orderBy: { _count: { id: 'desc' } },
      take: 5
    });

    // Top angajați cu acțiuni riscante
    const users = await db.userAction.groupBy({
      by: ['userId'],
      _count: { id: true },
      where: { actionType: 'clicked_suspicious_link' },
      orderBy: { _count: { id: 'desc' } },
      take: 5
    });

    // Evoluție incidente pe zile (ultimele 30 zile)
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const incidents = await db.emailScan.groupBy({
      by: ['detectedAt'],
      _count: { id: true },
      where: { detectedAt: { gte: since } },
      orderBy: { detectedAt: 'asc' }
    });

    return NextResponse.json({
      success: true,
      data: {
        departments,
        users,
        incidents
      }
    });
  } catch (error) {
    console.error("API admin/reports error:", error);
    return NextResponse.json({ success: false, error: "Failed to generate report" }, { status: 500 });
  }
}
