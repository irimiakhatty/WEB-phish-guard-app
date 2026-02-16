import { NextRequest, NextResponse } from "next/server";
import { verifyApiToken } from "@/lib/api-auth";
import { getUserSubscriptionInfo } from "@/lib/subscription-helpers";
import { getRiskLevel, isPhishingScore } from "@/lib/risk-levels";
import prisma from "@phish-guard-app/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InferenceResponse = {
  score?: number;
  riskLevel?: "safe" | "low" | "medium" | "high" | "critical";
  explanation?: string;
  confidence?: number;
  model?: string;
};

/**
 * POST /api/v1/deep-scan
 * Receives encrypted payload + hash, forwards to inference microservice,
 * logs the event without storing any email content.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyApiToken();

    if (!authResult.authorized || !authResult.user) {
      return NextResponse.json(
        { success: false, error: authResult.error || "Unauthorized" },
        { status: 401 }
      );
    }

    const subInfo = await getUserSubscriptionInfo(authResult.user.id);
    if (subInfo.planId === "free" || subInfo.planId === "team_free") {
      return NextResponse.json(
        { success: false, error: "Deep Scan is only available on paid plans." },
        { status: 402 }
      );
    }

    const body = await request.json();
    const { textHash, encryptedPayload, url } = body || {};

    if (!textHash || !encryptedPayload) {
      return NextResponse.json(
        { success: false, error: "textHash and encryptedPayload are required" },
        { status: 400 }
      );
    }

    const inferenceUrl = process.env.DEEP_SCAN_INFERENCE_URL;
    if (!inferenceUrl) {
      return NextResponse.json(
        { success: false, error: "Deep Scan inference service not configured" },
        { status: 503 }
      );
    }

    const inferenceHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (process.env.DEEP_SCAN_INFERENCE_TOKEN) {
      inferenceHeaders.Authorization = `Bearer ${process.env.DEEP_SCAN_INFERENCE_TOKEN}`;
    }

    const inferenceRes = await fetch(inferenceUrl, {
      method: "POST",
      headers: inferenceHeaders,
      body: JSON.stringify({
        textHash,
        encryptedPayload,
        url,
        source: "extension",
      }),
    });

    const inferenceData = (await inferenceRes.json()) as InferenceResponse;

    if (!inferenceRes.ok) {
      return NextResponse.json(
        { success: false, error: "Inference service error" },
        { status: 502 }
      );
    }

    const score =
      typeof inferenceData.score === "number"
        ? inferenceData.score
        : typeof inferenceData.riskLevel === "string"
          ? 0.5
          : 0;
    const riskLevel = inferenceData.riskLevel || getRiskLevel(score);
    const isPhishing = isPhishingScore(score);
    const analysis = inferenceData.explanation || "Deep Scan completed.";
    const confidence =
      typeof inferenceData.confidence === "number"
        ? inferenceData.confidence
        : Math.min(0.6 + score * 0.4, 0.95);

    await prisma.scan.create({
      data: {
        userId: authResult.user.id,
        organizationId: subInfo.organizationId || null,
        url: url || null,
        textContent: null,
        textScore: 0,
        urlScore: 0,
        overallScore: score,
        riskLevel,
        isPhishing,
        confidence,
        detectedThreats: [
          "deep_scan",
          `text_hash:${textHash}`,
          inferenceData.model ? `model:${inferenceData.model}` : "",
        ].filter(Boolean),
        analysis,
        source: "deep_scan",
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          overallScore: score,
          riskLevel,
          isPhishing,
          confidence,
          analysis,
          model: inferenceData.model,
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
    console.error("Deep scan API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
