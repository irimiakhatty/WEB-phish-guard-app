import { NextRequest, NextResponse } from "next/server";
import { verifyApiToken } from "@/lib/auth/api-auth";
import { getExtensionContextForUser } from "@/lib/integrations/extension-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/extension/context
 * Returns the authenticated extension account context, subscription limits, and recent scans.
 */
export async function GET(request: NextRequest) {
  try {
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

    const context = await getExtensionContextForUser(authResult.user.id);

    return NextResponse.json(
      {
        success: true,
        data: context,
      },
      {
        status: 200,
        headers: {
          "X-RateLimit-Remaining": String(authResult.remaining || 0),
        },
      }
    );
  } catch (error) {
    console.error("Extension context error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}

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