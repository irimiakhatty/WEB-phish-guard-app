import { NextRequest, NextResponse } from "next/server";
import { verifyApiToken } from "@/lib/api-auth";
import prisma from "@phish-guard-app/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/user-actions
 * Log a risky user action (e.g., click on suspicious link)
 * Requires: Bearer token authentication
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyApiToken();
    if (!authResult.authorized || !authResult.user) {
      return NextResponse.json(
        { success: false, error: authResult.error || "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { emailScanId, actionType, link, actionAt } = body;

    if (!emailScanId || !actionType) {
      return NextResponse.json(
        { success: false, error: "emailScanId and actionType are required" },
        { status: 400 }
      );
    }

    const emailScan = await prisma.emailScan.findUnique({
      where: { id: emailScanId },
      select: { id: true, userId: true, departmentId: true },
    });

    if (!emailScan || emailScan.userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: "Invalid emailScanId for this user" },
        { status: 400 }
      );
    }

    // Create user action record
    const userAction = await prisma.userAction.create({
      data: {
        userId: authResult.user.id,
        departmentId: emailScan.departmentId,
        emailScanId,
        actionType,
        link,
        actionAt: actionAt ? new Date(actionAt) : new Date(),
      },
    });

    return NextResponse.json(
      { success: true, data: { id: userAction.id, message: "User action logged successfully" } },
      { status: 201 }
    );
  } catch (error) {
    console.error("API user-actions error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to log user action" },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
