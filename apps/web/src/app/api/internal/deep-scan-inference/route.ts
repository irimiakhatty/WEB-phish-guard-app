import { NextRequest, NextResponse } from "next/server";

import {
  runDeepScanInference,
  type DeepScanInferenceInput,
} from "@/lib/security/run-deep-scan-inference";
import type { EncryptedPayloadEnvelope } from "@/lib/security/payload-crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Optional Deep Scan target for local dev (DEEP_SCAN_INFERENCE_URL).
 * Not available in production deployments.
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const configuredToken = process.env.DEEP_SCAN_INFERENCE_TOKEN;
  if (configuredToken) {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (token !== configuredToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const body = await request.json();
    const payload = parseInferenceBody(body);
    const result = await runDeepScanInference(payload);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Dev deep-scan inference error:", error);
    const message = error instanceof Error ? error.message : "Inference failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export function parseInferenceBody(body: unknown): DeepScanInferenceInput {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const userId = typeof record.userId === "string" ? record.userId : "";
  const textHash = typeof record.textHash === "string" ? record.textHash : undefined;
  const url = typeof record.url === "string" ? record.url : undefined;
  const encryptedPayload = record.encryptedPayload as EncryptedPayloadEnvelope | undefined;

  if (!userId) {
    throw new Error("userId is required");
  }
  if (!encryptedPayload?.iv || !encryptedPayload?.ciphertext || !encryptedPayload?.wrappedKey) {
    throw new Error("encryptedPayload is required");
  }

  return { userId, textHash, url, encryptedPayload };
}
