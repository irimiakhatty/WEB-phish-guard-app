import { NextRequest, NextResponse } from "next/server";
import { verifyApiToken } from "@/lib/api-auth";
import { analyzePhishing } from "@/app/actions/analyze";
import { decryptTextPayload, type EncryptedPayloadEnvelope } from "@/lib/payload-crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnalyzeRequestBody = {
  url?: string;
  textContent?: string;
  imageUrl?: string;
  source?: string;
  payloadEncoding?: string;
  textHash?: string;
  encryptedPayload?: EncryptedPayloadEnvelope;
};

/**
 * POST /api/v1/analyze
 * Analyze content for phishing threats
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
    const body = (await request.json()) as AnalyzeRequestBody;
    const { url, imageUrl, source } = body;

    let textContent = typeof body.textContent === "string" ? body.textContent : "";
    const hasEncryptedPayload =
      body.encryptedPayload &&
      typeof body.encryptedPayload === "object" &&
      typeof body.encryptedPayload.iv === "string" &&
      typeof body.encryptedPayload.ciphertext === "string" &&
      typeof body.encryptedPayload.wrappedKey === "string";

    if (hasEncryptedPayload) {
      try {
        textContent = decryptTextPayload(
          body.encryptedPayload as EncryptedPayloadEnvelope,
          typeof body.textHash === "string" ? body.textHash : undefined
        );
      } catch (decryptError) {
        const message =
          decryptError instanceof Error ? decryptError.message : "Invalid encrypted payload";
        const status = message.includes("not configured") ? 503 : 400;
        return NextResponse.json(
          {
            success: false,
            error: `Invalid encrypted payload: ${message}`,
          },
          { status }
        );
      }
    }

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
    const result = await analyzePhishing(
      {
        url,
        textContent,
        imageUrl,
      },
      {
        userId: authResult.user.id,
        source: source === "extension" ? "extension" : "api",
        enforceLimits: false,
      }
    );

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
          scanId: result.scanId,
          scoringVersion: result.scoringVersion,
          scoreBreakdown: result.scoreBreakdown,
          modelVersions: result.modelVersions,
          policyDecision: result.policyDecision,
          retentionPolicy: result.retentionPolicy,
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
