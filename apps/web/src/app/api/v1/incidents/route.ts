import { NextRequest, NextResponse } from "next/server";
import { verifyApiToken } from "@/lib/api-auth";
import { getUserSubscriptionInfo } from "@/lib/subscription-helpers";
import { getRiskLevel, isPhishingScore } from "@/lib/risk-levels";
import prisma from "@phish-guard-app/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/incidents
 * Log a phishing incident detected by the extension
 * Requires: Bearer token authentication
 */
export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json();
    const { url, textScore, urlScore, heuristicScore, overallScore, timestamp, source, attackType } = body;

    // Validate required fields
    if (!url) {
      return NextResponse.json(
        {
          success: false,
          error: "URL is required",
        },
        { status: 400 }
      );
    }

    // Create scan record
    const computedOverall = Math.max(
      overallScore || 0,
      textScore || 0,
      urlScore || 0,
      heuristicScore || 0
    );
    const riskLevel = getRiskLevel(computedOverall);
    const isPhishing = isPhishingScore(computedOverall);

    const subInfo = await getUserSubscriptionInfo(authResult.user.id);

    const scan = await prisma.scan.create({
      data: {
        userId: authResult.user.id,
        organizationId: subInfo.organizationId || null,
        url,
        textScore: textScore || 0,
        urlScore: urlScore || 0,
        overallScore: computedOverall,
        riskLevel,
        isPhishing,
        confidence: computedOverall,
        detectedThreats: [
          `Detected by ${source || "extension"}`,
          attackType ? `attack_type:${attackType}` : "",
          isPhishing ? "Phishing detected" : "No threats detected",
        ].filter(Boolean),
        analysis: `Incident logged from Chrome Extension at ${
          timestamp || new Date().toISOString()
        }`,
        source: source || "extension",
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: scan.id,
          message: "Incident logged successfully",
        },
      },
      {
        status: 201,
        headers: {
          "X-RateLimit-Remaining": String(authResult.remaining || 0),
        },
      }
    );
  } catch (error) {
    console.error("API incidents error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to log incident",
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
