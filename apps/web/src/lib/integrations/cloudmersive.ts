import { getRiskLevel } from "@/lib/security/risk-levels";

const CLOUDMERSIVE_BASE_URL =
  process.env.CLOUDMERSIVE_API_URL || "https://api.cloudmersive.com";

export type CloudmersiveUnsafeUrlResult = {
  Url?: string;
  CleanResult?: boolean;
  ContainsPhishing?: boolean;
  PhishingRiskLevel?: number;
  ContainsSsrfThreat?: boolean;
};

export type CloudmersiveAdvancedResponse = {
  CleanResult?: boolean;
  ContainsPhishing?: boolean;
  ContainsUnsolicitedSales?: boolean;
  ContainsPromotionalContent?: boolean;
  ContainsWebUrls?: boolean;
  ContainsPhoneNumbers?: boolean;
  ContainsEmailAddresses?: boolean;
  ConfidenceLevel?: number;
  AnalysisRationale?: string;
  UnsafeUrls?: CloudmersiveUnsafeUrlResult[];
};

export type CloudmersivePhishingAnalysis = {
  score: number;
  riskLevel: ReturnType<typeof getRiskLevel>;
  explanation: string;
  confidence: number;
  model: string;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function normalizeConfidence(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0.5;
  }
  return value > 1 ? clamp01(value / 100) : clamp01(value);
}

export function mapCloudmersiveResponse(
  response: CloudmersiveAdvancedResponse
): CloudmersivePhishingAnalysis {
  const confidence = normalizeConfidence(response.ConfidenceLevel);
  const containsPhishing = response.ContainsPhishing === true;
  const isClean = response.CleanResult !== false && !containsPhishing;

  let score = isClean ? clamp01((1 - confidence) * 0.25) : clamp01(Math.max(confidence, 0.65));

  const unsafeUrls = response.UnsafeUrls || [];
  for (const unsafeUrl of unsafeUrls) {
    if (unsafeUrl.ContainsPhishing || unsafeUrl.CleanResult === false) {
      const urlRisk =
        typeof unsafeUrl.PhishingRiskLevel === "number"
          ? normalizeConfidence(unsafeUrl.PhishingRiskLevel)
          : 0.75;
      score = Math.max(score, urlRisk);
    }
  }

  const rationale = response.AnalysisRationale?.trim();
  const unsafeUrlSummary =
    unsafeUrls.length > 0
      ? unsafeUrls
          .filter((item) => item.ContainsPhishing || item.CleanResult === false)
          .slice(0, 3)
          .map((item) => item.Url)
          .filter(Boolean)
          .join(", ")
      : "";

  let explanation = rationale || "Cloudmersive Deep Scan completed.";
  if (containsPhishing || !isClean) {
    explanation = rationale || "Cloudmersive detected phishing indicators in this message.";
  } else if (unsafeUrlSummary) {
    explanation = `${explanation} Suspicious links: ${unsafeUrlSummary}.`;
  }

  return {
    score,
    riskLevel: getRiskLevel(score),
    explanation,
    confidence,
    model: "cloudmersive-advanced",
  };
}

export async function analyzeTextPhishingCloudmersive(
  text: string
): Promise<CloudmersivePhishingAnalysis> {
  const apiKey = process.env.CLOUDMERSIVE_API_KEY;

  if (!apiKey) {
    throw new Error("CLOUDMERSIVE_API_KEY is not configured");
  }

  const trimmedText = text.trim();
  if (!trimmedText) {
    return {
      score: 0,
      riskLevel: "safe",
      explanation: "No email content to analyze.",
      confidence: 0.5,
      model: "cloudmersive-advanced",
    };
  }

  const response = await fetch(
    `${CLOUDMERSIVE_BASE_URL}/phishing/detect/text-string/advanced`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Apikey: apiKey,
      },
      body: JSON.stringify({
        InputString: trimmedText,
        Model: "Advanced",
        ProvideAnalysisRationale: true,
      }),
      signal: AbortSignal.timeout(30_000),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `Cloudmersive API error (${response.status})${errorBody ? `: ${errorBody.slice(0, 200)}` : ""}`
    );
  }

  const data = (await response.json()) as CloudmersiveAdvancedResponse;
  return mapCloudmersiveResponse(data);
}

export function isCloudmersiveConfigured(): boolean {
  return Boolean(process.env.CLOUDMERSIVE_API_KEY);
}
