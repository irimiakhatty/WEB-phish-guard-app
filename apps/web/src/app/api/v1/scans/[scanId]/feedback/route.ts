import { NextRequest, NextResponse } from "next/server";
import prisma from "@phish-guard-app/db";
import { verifyApiToken } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ scanId: string }>;
}

const ALLOWED_LABELS = new Set(["safe", "phishing", "unsure"]);
const ALLOWED_TRUST_LEVELS = new Set(["user", "analyst"]);

function resolveTrustLevel(role: string | undefined, requested: string | undefined): "user" | "analyst" {
  const roleLower = typeof role === "string" ? role.toLowerCase() : "";
  const isAnalystRole = roleLower === "super_admin" || roleLower === "admin";
  const requestedLower = typeof requested === "string" ? requested.toLowerCase() : "";

  if (requestedLower && ALLOWED_TRUST_LEVELS.has(requestedLower)) {
    if (requestedLower === "analyst" && !isAnalystRole) return "user";
    return requestedLower as "user" | "analyst";
  }

  return isAnalystRole ? "analyst" : "user";
}

/**
 * POST /api/v1/scans/:scanId/feedback
 * Stores analyst/user feedback for evaluation without changing schema.
 */
export async function POST(request: NextRequest, ctx: RouteContext) {
  try {
    const authResult = await verifyApiToken();
    if (!authResult.authorized || !authResult.user) {
      return NextResponse.json(
        { success: false, error: authResult.error || "Unauthorized" },
        { status: 401 }
      );
    }

    const { scanId } = await ctx.params;
    if (!scanId) {
      return NextResponse.json(
        { success: false, error: "scanId is required" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const label = typeof body.label === "string" ? body.label.trim().toLowerCase() : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 400) : "";
    const requestedTrustLevel =
      typeof body.trustLevel === "string" ? body.trustLevel.trim().toLowerCase() : undefined;

    if (!ALLOWED_LABELS.has(label)) {
      return NextResponse.json(
        { success: false, error: "label must be one of: safe, phishing, unsure" },
        { status: 400 }
      );
    }
    if (requestedTrustLevel && !ALLOWED_TRUST_LEVELS.has(requestedTrustLevel)) {
      return NextResponse.json(
        { success: false, error: "trustLevel must be one of: user, analyst" },
        { status: 400 }
      );
    }

    const scan = await prisma.scan.findUnique({
      where: { id: scanId },
      select: {
        id: true,
        userId: true,
        detectedThreats: true,
        analysis: true,
      },
    });

    if (!scan || scan.userId !== authResult.user.id) {
      return NextResponse.json(
        { success: false, error: "Scan not found for this user" },
        { status: 404 }
      );
    }

    const timestamp = new Date().toISOString();
    const trustLevel = resolveTrustLevel(authResult.user.role, requestedTrustLevel);
    const nextThreats = Array.from(
      new Set([
        ...(scan.detectedThreats || []),
        `feedback_label:${label}`,
        `feedback_trust:${trustLevel}`,
        "feedback_source:api",
        `feedback_at:${timestamp}`,
      ])
    );

    const feedbackLine = `[Evaluation feedback ${timestamp}] label=${label}${
      note ? ` note=${note}` : ""
    } trust=${trustLevel}`;
    const existingAnalysis = scan.analysis ? `${scan.analysis}\n` : "";

    await prisma.scan.update({
      where: { id: scanId },
      data: {
        detectedThreats: nextThreats,
        analysis: `${existingAnalysis}${feedbackLine}`,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          scanId,
          label,
          trustLevel,
          noted: Boolean(note),
          storedAt: timestamp,
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
    console.error("Scan feedback API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to store feedback" },
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
