import { NextRequest, NextResponse } from "next/server";
import { analyzeUrl } from "@/lib/safe-browsing";
import { predictUrl } from "@/lib/ml-service";
import { analyzeUrlHeuristics } from "@/lib/phishing-heuristics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * In-memory rate limiting for anonymous quick checks
 */
const quickCheckLimits = new Map<string, { count: number; resetAt: Date }>();

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = new Date();
  const limit = quickCheckLimits.get(ip);

  // Reset if hour has passed
  if (!limit || limit.resetAt < now) {
    quickCheckLimits.set(ip, {
      count: 1,
      resetAt: new Date(now.getTime() + 60 * 60 * 1000),
    });
    return { allowed: true, remaining: 49 };
  }

  // Check if limit exceeded (50 per hour for anonymous)
  if (limit.count >= 50) {
    return { allowed: false, remaining: 0 };
  }

  // Increment counter
  limit.count++;
  return { allowed: true, remaining: 50 - limit.count };
}

/**
 * POST /api/v1/quick-check
 * Quick URL check without authentication
 * Limited to 50 requests per hour per IP
 * Does not save to database
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(clientIp);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded. Try again in an hour.",
        },
        { status: 429 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { url } = body;

    // Validate input
    if (!url || typeof url !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Valid URL is required",
        },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid URL format",
        },
        { status: 400 }
      );
    }

    // Perform quick analysis (parallel)
    const [safeBrowsingResult, mlResult, heuristicResult] = await Promise.all([
      analyzeUrl(url).catch(() => null),
      predictUrl(url).catch(() => null),
      Promise.resolve(analyzeUrlHeuristics(url)),
    ]);

    // Calculate scores
    let urlScore = 0;
    const detectedThreats: string[] = [];

    // Google Safe Browsing (highest priority)
    if (safeBrowsingResult?.isThreat) {
      urlScore = 0.95;
      detectedThreats.push("Flagged by Google Safe Browsing");
    }

    // ML prediction
    if (mlResult?.score) {
      urlScore = Math.max(urlScore, mlResult.score);
    }

    // Heuristics
    if (heuristicResult.threatCount > 0) {
      const heuristicScore = Math.min(heuristicResult.threatCount * 0.2, 0.85);
      urlScore = Math.max(urlScore, heuristicScore);
      detectedThreats.push(...heuristicResult.threats);
    }

    // Determine risk level
    let riskLevel: "safe" | "low" | "medium" | "high" | "critical";
    if (urlScore >= 0.8) riskLevel = "critical";
    else if (urlScore >= 0.6) riskLevel = "high";
    else if (urlScore >= 0.4) riskLevel = "medium";
    else if (urlScore >= 0.2) riskLevel = "low";
    else riskLevel = "safe";

    const isPhishing = urlScore >= 0.5;

    return NextResponse.json(
      {
        success: true,
        data: {
          overallScore: urlScore,
          riskLevel,
          isPhishing,
          detectedThreats,
        },
      },
      {
        status: 200,
        headers: {
          "X-RateLimit-Remaining": String(rateLimit.remaining),
        },
      }
    );
  } catch (error) {
    console.error("Quick check error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Analysis failed",
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
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
