import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { createApiToken, listUserApiTokens } from "@/lib/api-auth";
import { canCreateApiToken } from "@/lib/subscription-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/auth/token
 * Generate a new API token for the authenticated user
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const { user } = await requireAuth();

    // Check token limits based on subscription
    const tokenCheck = await canCreateApiToken(user.id);
    if (!tokenCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Token limit reached (${tokenCheck.tokensUsed}/${tokenCheck.tokensLimit}). Upgrade your plan to create more tokens.`,
          tokensUsed: tokenCheck.tokensUsed,
          tokensLimit: tokenCheck.tokensLimit,
        },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { name, expiresInDays } = body;

    // Create the token
    const token = await createApiToken(
      user.id,
      name || "Chrome Extension",
      expiresInDays
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          token,
          message: "API token created successfully",
          tokensUsed: tokenCheck.tokensUsed + 1,
          tokensLimit: tokenCheck.tokensLimit,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required",
        },
        { status: 401 }
      );
    }

    console.error("Token creation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create token",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/auth/token
 * List all API tokens for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const { user } = await requireAuth();

    // Get tokens
    const tokens = await listUserApiTokens(user.id);

    return NextResponse.json(
      {
        success: true,
        data: tokens,
      },
      { status: 200 }
    );
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required",
        },
        { status: 401 }
      );
    }

    console.error("Token list error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch tokens",
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
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
