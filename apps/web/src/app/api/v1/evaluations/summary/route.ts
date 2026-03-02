import { NextRequest, NextResponse } from "next/server";
import prisma from "@phish-guard-app/db";
import { verifyApiToken } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Counters = {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  total: number;
};

function getLatestTaggedValue(tags: string[], prefix: string): string | null {
  for (let i = tags.length - 1; i >= 0; i--) {
    const value = tags[i];
    if (typeof value === "string" && value.startsWith(prefix)) {
      return value.slice(prefix.length);
    }
  }
  return null;
}

function parseTrustFilter(value: string | null): "all" | "user" | "analyst" {
  const normalized = (value || "analyst").toLowerCase();
  if (normalized === "all" || normalized === "user" || normalized === "analyst") {
    return normalized;
  }
  return "analyst";
}

function computeMetrics(counters: Counters) {
  const precision = counters.tp + counters.fp > 0 ? counters.tp / (counters.tp + counters.fp) : 0;
  const recall = counters.tp + counters.fn > 0 ? counters.tp / (counters.tp + counters.fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const accuracy =
    counters.total > 0 ? (counters.tp + counters.tn) / counters.total : 0;

  return {
    precision: Number(precision.toFixed(4)),
    recall: Number(recall.toFixed(4)),
    f1: Number(f1.toFixed(4)),
    accuracy: Number(accuracy.toFixed(4)),
  };
}

function updateCounters(counters: Counters, actualPhishing: boolean, predictedPhishing: boolean) {
  counters.total += 1;
  if (actualPhishing && predictedPhishing) counters.tp += 1;
  else if (!actualPhishing && predictedPhishing) counters.fp += 1;
  else if (!actualPhishing && !predictedPhishing) counters.tn += 1;
  else counters.fn += 1;
}

/**
 * GET /api/v1/evaluations/summary
 * Computes precision/recall/F1 from feedback labels on scans.
 * Query params:
 * - from (ISO date)
 * - to   (ISO date)
 * - trust (analyst | user | all), default: analyst
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyApiToken();
    if (!authResult.authorized || !authResult.user) {
      return NextResponse.json(
        { success: false, error: authResult.error || "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const fromRaw = searchParams.get("from");
    const toRaw = searchParams.get("to");
    const trustFilter = parseTrustFilter(searchParams.get("trust"));
    const from = fromRaw ? new Date(fromRaw) : null;
    const to = toRaw ? new Date(toRaw) : null;

    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
      return NextResponse.json(
        { success: false, error: "Invalid date range. Use ISO date format." },
        { status: 400 }
      );
    }

    const createdAtFilter =
      from || to
        ? {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          }
        : undefined;

    const scans = await prisma.scan.findMany({
      where: {
        userId: authResult.user.id,
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
        detectedThreats: {
          hasSome: ["feedback_label:safe", "feedback_label:phishing", "feedback_label:unsure"],
        },
      },
      select: {
        id: true,
        isPhishing: true,
        detectedThreats: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const byVersion = new Map<
      string,
      {
        scoringVersion: string;
        textModelVersion: string;
        urlModelVersion: string;
        counters: Counters;
      }
    >();
    const overall: Counters = { tp: 0, fp: 0, tn: 0, fn: 0, total: 0 };

    for (const scan of scans) {
      const tags = scan.detectedThreats || [];
      const label = getLatestTaggedValue(tags, "feedback_label:");
      if (!label || label === "unsure") continue;
      const trustLevel = getLatestTaggedValue(tags, "feedback_trust:") || "user";
      if (trustFilter !== "all" && trustLevel !== trustFilter) continue;
      const actualPhishing = label === "phishing";
      const predictedPhishing = Boolean(scan.isPhishing);

      const scoringVersion = getLatestTaggedValue(tags, "scoring_version:") || "unknown";
      const textModelVersion = getLatestTaggedValue(tags, "model_text:") || "unknown";
      const urlModelVersion = getLatestTaggedValue(tags, "model_url:") || "unknown";
      const key = `${scoringVersion}__${textModelVersion}__${urlModelVersion}`;

      if (!byVersion.has(key)) {
        byVersion.set(key, {
          scoringVersion,
          textModelVersion,
          urlModelVersion,
          counters: { tp: 0, fp: 0, tn: 0, fn: 0, total: 0 },
        });
      }

      updateCounters(overall, actualPhishing, predictedPhishing);
      updateCounters(byVersion.get(key)!.counters, actualPhishing, predictedPhishing);
    }

    const groups = Array.from(byVersion.values()).map((entry) => ({
      scoringVersion: entry.scoringVersion,
      modelVersion: {
        text: entry.textModelVersion,
        url: entry.urlModelVersion,
      },
      counts: entry.counters,
      metrics: computeMetrics(entry.counters),
    }));

    return NextResponse.json(
      {
        success: true,
        data: {
          trustFilter,
          evaluatedScans: overall.total,
          overall: {
            counts: overall,
            metrics: computeMetrics(overall),
          },
          byVersion: groups,
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
    console.error("Evaluation summary API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to compute evaluation summary" },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
