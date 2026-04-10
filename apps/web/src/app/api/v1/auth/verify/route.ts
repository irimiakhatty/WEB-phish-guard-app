import { NextRequest, NextResponse } from "next/server";
import { verifyApiToken } from "@/lib/auth/api-auth";
import { getExtensionContextForUser } from "@/lib/integrations/extension-context";

export const runtime = "nodejs";

/**
 * GET /api/v1/auth/verify
 * Note: Uses the token from the Authorization header, not the session cookie.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyApiToken();

    if (!authResult.authorized || !authResult.user) {
      return NextResponse.json(
        {
          success: false,
          error: authResult.error || "Invalid or expired token",
        },
        { status: 401 }
      );
    }

    const context = await getExtensionContextForUser(authResult.user.id);

    return NextResponse.json(
      {
        success: true,
        data: {
          valid: true,
          user: context.user,
          plan: context.subscription.planId,
          subscriptionType: context.subscription.subscriptionType,
          scansRemaining: context.subscription.scansRemaining,
          context,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Token verification error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}