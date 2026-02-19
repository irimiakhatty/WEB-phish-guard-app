import { NextRequest, NextResponse } from "next/server";
import { verifyApiToken } from "@/lib/api-auth";
import { getMyScans } from "@/app/actions/scans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/scans
 * Get user's scan history
 * Requires: Bearer token authentication
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyApiToken();

    if (!authResult.authorized || !authResult.user) {
      return NextResponse.json(
        {
          success: false,
          error: authResult.error || "Unauthorized",
        },
        { status: 401 }
      );
    }

    // Get limit from query params (default 50, max 100)
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const parsedLimit = Number.parseInt(limitParam || "50", 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(parsedLimit, 100) : 50;

    // Fetch scans
    const scans = await getMyScans();

    // Limit the results
    const limitedScans = scans.slice(0, limit);

    return NextResponse.json(
      {
        success: true,
        data: limitedScans,
        count: limitedScans.length,
      },
      {
        status: 200,
        headers: {
          "X-RateLimit-Remaining": String(authResult.remaining || 0),
        },
      }
    );
  } catch (error) {
    console.error("API scans error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
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
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
