import { NextRequest, NextResponse } from "next/server";
import { verifyApiToken } from "@/lib/auth/api-auth";
import { getUserSubscriptionInfo } from "@/lib/billing/subscription-helpers";
import { getRiskLevel, isPhishingScore } from "@/lib/security/risk-levels";
import { runDeepScanInference } from "@/lib/security/run-deep-scan-inference";
import type { EncryptedPayloadEnvelope } from "@/lib/security/payload-crypto";
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

function shouldUseInlineInference(inferenceUrl: string | undefined): boolean {
  if (!inferenceUrl) {
    return true;
  }
  return inferenceUrl.includes("/api/internal/deep-scan-inference");
}

async function fetchExternalInference(
  inferenceUrl: string,
  payload: {
    textHash: string;
    encryptedPayload: EncryptedPayloadEnvelope;
    url?: string;
    userId: string;
  }
): Promise<InferenceResponse> {
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
      textHash: payload.textHash,
      encryptedPayload: payload.encryptedPayload,
      url: payload.url,
      source: "extension",
      userId: payload.userId,
    }),
  });

  const inferenceData = (await inferenceRes.json()) as InferenceResponse & { error?: string };

  if (!inferenceRes.ok) {
    throw new Error(inferenceData.error || "Inference service error");
  }

  return inferenceData;
}

/**
 * POST /api/v1/deep-scan
 * Receives encrypted payload + hash, runs inference (inline or external service),
 * logs the event without storing email body text.
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
    const memberDepartment = subInfo.organizationId
      ? await prisma.organizationMember.findFirst({
          where: {
            organizationId: subInfo.organizationId,
            userId: authResult.user.id,
          },
          select: {
            departmentId: true,
          },
        })
      : null;

    const body = await request.json();
    const { textHash, encryptedPayload, url } = body || {};

    if (!textHash || !encryptedPayload) {
      return NextResponse.json(
        { success: false, error: "textHash and encryptedPayload are required" },
        { status: 400 }
      );
    }

    const inferenceUrl = process.env.DEEP_SCAN_INFERENCE_URL;
    let inferenceData: InferenceResponse;

    if (shouldUseInlineInference(inferenceUrl)) {
      inferenceData = await runDeepScanInference({
        userId: authResult.user.id,
        textHash,
        encryptedPayload: encryptedPayload as EncryptedPayloadEnvelope,
        url: typeof url === "string" ? url : undefined,
      });
    } else {
      inferenceData = await fetchExternalInference(inferenceUrl!, {
        textHash,
        encryptedPayload: encryptedPayload as EncryptedPayloadEnvelope,
        url: typeof url === "string" ? url : undefined,
        userId: authResult.user.id,
      });
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
        departmentId: memberDepartment?.departmentId || null,
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
