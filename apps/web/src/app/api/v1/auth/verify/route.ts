import { NextRequest, NextResponse } from "next/server";
import { verifyApiToken } from "@/lib/api-auth";
import { getUserSubscriptionInfo } from "@/lib/subscription-helpers";

export const runtime = "nodejs";

/**
 * GET /api/v1/auth/verify
 * Note: Uses the token from the Authorization header, not the session cookie
 */
export async function GET(request: NextRequest) {
  try {
    // Verify the token
    const authResult = await verifyApiToken();

    if (!authResult.authorized || !authResult.user) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or expired token",
        },
        { status: 401 }
      );
    }

    // Get subscription info
    const subInfo = await getUserSubscriptionInfo(authResult.user.id);
    const plan = subInfo.hasActiveSubscription ? "paid" : "free";

    return NextResponse.json(
      {
        success: true,
        data: {
          valid: true,
          user: {
            id: authResult.user.id,
            email: authResult.user.email,
            name: authResult.user.name,
          },
          plan: plan,
          scansRemaining: subInfo.limits.scansPerMonth, // Or calculate remaining
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
