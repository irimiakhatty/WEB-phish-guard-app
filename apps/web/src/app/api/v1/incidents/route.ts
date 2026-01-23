import { NextRequest, NextResponse } from "next/server";
import { verifyApiToken } from "@/lib/api-auth";
import { db } from "@repo/db";

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
    const { url, textScore, urlScore, timestamp, source } = body;

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
    const overallScore = Math.max(textScore || 0, urlScore || 0);
    const isPhishing = overallScore >= 0.5;

    let riskLevel: "safe" | "low" | "medium" | "high" | "critical";
    if (overallScore >= 0.8) riskLevel = "critical";
    else if (overallScore >= 0.6) riskLevel = "high";
    else if (overallScore >= 0.4) riskLevel = "medium";
    else if (overallScore >= 0.2) riskLevel = "low";
    else riskLevel = "safe";

    const scan = await db.scan.create({
      data: {
        userId: authResult.user.id,
        url,
        textScore: textScore || 0,
        urlScore: urlScore || 0,
        overallScore,
        riskLevel,
        isPhishing,
        confidence: overallScore,
        detectedThreats: [
          `Detected by ${source || "extension"}`,
          isPhishing ? "Phishing detected" : "No threats detected",
        ],
        analysis: `Incident logged from Chrome Extension at ${
          timestamp || new Date().toISOString()
        }`,
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
