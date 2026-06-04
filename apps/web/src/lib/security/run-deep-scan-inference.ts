import { analyzePhishing } from "@/server/actions/analyze";

import {
  decryptTextPayload,
  type EncryptedPayloadEnvelope,
} from "@/lib/security/payload-crypto";

export type DeepScanInferenceInput = {
  userId: string;
  textHash?: string;
  encryptedPayload: EncryptedPayloadEnvelope;
  url?: string;
};

export type DeepScanInferenceResult = {
  score: number;
  riskLevel: "safe" | "low" | "medium" | "high" | "critical";
  explanation: string;
  confidence: number;
  model: string;
};

export async function runDeepScanInference(
  input: DeepScanInferenceInput
): Promise<DeepScanInferenceResult> {
  const textContent = decryptTextPayload(input.encryptedPayload, input.textHash);
  const result = await analyzePhishing(
    { textContent, url: input.url },
    { userId: input.userId, source: "api", enforceLimits: false }
  );

  return {
    score: result.overallScore,
    riskLevel: result.riskLevel,
    explanation: result.analysis,
    confidence: result.confidence,
    model: "inline-analyze",
  };
}
