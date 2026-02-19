import { NextRequest, NextResponse } from "next/server";
import { verifyApiToken } from "@/lib/api-auth";
import { analyzePhishing } from "@/app/actions/analyze";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/analyze
 * Analyze content for phishing threats
 * Requires: Bearer token authentication
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyApiToken();

    if (!authResult.authorized) {
      return NextResponse.json(
        {
          success: false,
          error: authResult.error || "Unauthorized",
        },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { url, textContent, imageUrl } = body;

    // Validate input
    if (!url && !textContent && !imageUrl) {
      return NextResponse.json(
        {
          success: false,
          error: "At least one of url, textContent, or imageUrl is required",
        },
        { status: 400 }
      );
    }

    // Call the analysis function (with user context)
    const result = await analyzePhishing({
      url,
      textContent,
      imageUrl,
    });

    // Return successful response with rate limit headers
    return NextResponse.json(
      {
        success: true,
        data: {
          textScore: result.textScore,
          urlScore: result.urlScore,
          overallScore: result.overallScore,
          riskLevel: result.riskLevel,
          isPhishing: result.isPhishing,
          confidence: result.confidence,
          detectedThreats: result.detectedThreats,
          analysis: result.analysis,
        },
      },
      {
        status: 200,
        headers: {
          "X-RateLimit-Remaining": String(authResult.remaining || 0),
        },
      }
    );
  } catch (error) {
    console.error("API analyze error:", error);
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
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
