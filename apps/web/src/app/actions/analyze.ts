"use server";

import prisma from "@phish-guard-app/db";
import { createHash } from "crypto";
import { requireAuth } from "@/lib/auth-helpers";
import { checkSafeBrowsing, getThreatSeverity } from "@/lib/safe-browsing";
import { analyzeTextMLDetailed, analyzeUrlMLDetailed } from "@/lib/ml-service";
import { checkScanLimits, getUserSubscriptionInfo } from "@/lib/subscription-helpers";
import { getRiskLevel, isPhishingScore } from "@/lib/risk-levels";

const SCORING_VERSION = "weighted_v1";
const WEIGHTED_SCORE_CONFIG = {
  urlSignal: 0.55,
  textSignal: 0.45,
  mlInsideSignal: 0.75,
  heuristicInsideSignal: 0.25,
} as const;

function readBooleanEnv(keys: string[], fallback: boolean): boolean {
  for (const key of keys) {
    const raw = process.env[key];
    if (typeof raw === "string") {
      return raw.toLowerCase() === "true";
    }
  }
  return fallback;
}

const FORENSICS_MODE = readBooleanEnv(["FORENSICS_MODE", "PG_FORENSICS_MODE"], false);

const STORAGE_POLICY = {
  // New names first, PG_* kept for backward compatibility.
  storeSafeContent: readBooleanEnv(["STORE_SAFE_CONTENT", "PG_STORE_SAFE_CONTENT"], false),
  storePhishingContent: readBooleanEnv(["STORE_PHISHING_CONTENT", "PG_STORE_PHISHING_CONTENT"], false),
  storeSafeUrl: readBooleanEnv(["STORE_SAFE_URL", "PG_STORE_SAFE_URL"], false),
  storePhishingUrl: readBooleanEnv(["STORE_PHISHING_URL", "PG_STORE_PHISHING_URL"], true),
  storeFullUrl: readBooleanEnv(["STORE_FULL_URL", "PG_STORE_FULL_URL"], false),
} as const;

const ENFORCEMENT_POLICY = {
  hardBlockRisk: (process.env.PG_HARD_BLOCK_RISK || "critical").toLowerCase(),
  minConfidenceForHardBlock: Number(process.env.PG_HARD_BLOCK_MIN_CONFIDENCE || "0.9"),
} as const;

export type AnalyzeInput = {
  url?: string;
  textContent?: string;
  imageUrl?: string;
};

export type ScoreBreakdown = {
  urlMlScore: number;
  urlHeuristicScore: number;
  textMlScore: number;
  textHeuristicScore: number;
  safeBrowsingScore: number;
  weightedScore: number;
};

export type ModelVersions = {
  urlModel: string | null;
  textModel: string | null;
  safeBrowsingHit: boolean;
};

export type PolicyDecision = {
  action: "allow" | "warn" | "block";
  reason: string;
  hardBlock: boolean;
};

export type RetentionPolicy = {
  storedText: boolean;
  storedUrl: boolean;
  usedUrlHostOnly: boolean;
  forensicsMode: boolean;
};

type AnalyzeContext = {
  userId?: string;
  source?: "web" | "extension" | "api";
  enforceLimits?: boolean;
};

export type AnalysisResult = {
  textScore: number;
  urlScore: number;
  overallScore: number;
  riskLevel: "safe" | "low" | "medium" | "high" | "critical";
  isPhishing: boolean;
  confidence: number;
  detectedThreats: string[];
  analysis: string;
  scanId: string;
  scoringVersion: string;
  scoreBreakdown: ScoreBreakdown;
  modelVersions: ModelVersions;
  policyDecision: PolicyDecision;
  retentionPolicy: RetentionPolicy;
};

// Heuristic analysis for URLs
function analyzeUrlHeuristic(url: string): { score: number; threats: string[] } {
  const threats: string[] = [];
  let suspiciousCount = 0;

  // Define legitimate brand domains
  const BRAND_DOMAINS: Record<string, string[]> = {
    paypal: ["paypal.com", "paypal.me"],
    google: ["google.com", "gmail.com", "accounts.google.com", "youtube.com"],
    microsoft: ["microsoft.com", "live.com", "office.com", "outlook.com", "azure.com"],
    apple: ["apple.com", "icloud.com"],
    facebook: ["facebook.com", "fb.com", "messenger.com", "instagram.com"],
    amazon: ["amazon.com", "amazon.co.uk", "amazon.de", "amazon.ca"],
    netflix: ["netflix.com"],
    dhl: ["dhl.com"],
    yahoo: ["yahoo.com", "mail.yahoo.com"],
    linkedin: ["linkedin.com"],
    twitter: ["twitter.com", "x.com"],
    bank: ["chase.com", "wellsfargo.com", "bankofamerica.com", "citibank.com"],
  };

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname.toLowerCase();
    
    // Normalize hostname by removing www. for brand checking
    const normalizedHostname = hostname.replace(/^www\./, '');
    
    console.log(`🔍 Analyzing URL: ${url}`);
    console.log(`   Hostname: ${hostname}`);
    console.log(`   Normalized: ${normalizedHostname}`);

    // Check for IP address instead of domain
    const isIPAddress = /^\d+\.\d+\.\d+\.\d+$/.test(urlObj.hostname);
    if (isIPAddress) {
      threats.push("Uses IP address instead of domain name");
      suspiciousCount += 3; // Increased from 2 to 3
    }

    // Check for suspicious TLDs
    const highRiskTLDs = [".tk", ".ml", ".ga", ".cf", ".gq"]; // Very high risk
    const suspiciousTLDs = [".xyz", ".top", ".work", ".click", ".loan"];
    
    if (highRiskTLDs.some((tld) => urlObj.hostname.endsWith(tld))) {
      threats.push("Uses HIGH RISK top-level domain commonly abused for phishing");
      suspiciousCount += 2.5; // Increased penalty for very dangerous TLDs
    } else if (suspiciousTLDs.some((tld) => urlObj.hostname.endsWith(tld))) {
      threats.push("Uses suspicious top-level domain");
      suspiciousCount += 1.5;
    }

    // Check for excessive subdomains
    const subdomains = urlObj.hostname.split(".");
    if (subdomains.length > 4) {
      threats.push("Contains excessive subdomains");
      suspiciousCount += 1.5;
    }

    // Check for common phishing keywords in domain or path
    const phishingKeywords = [
      "verify",
      "account",
      "update",
      "secure",
      "banking",
      "login",
      "signin",
      "confirm",
      "suspended",
      "validate",
      "authentication",
      "prize",
      "winner",
      "reward",
      "free",
      "gift",
      "claim",
      "urgent",
    ];
    const foundKeywordsInHost = phishingKeywords.filter((keyword) => hostname.includes(keyword));
    const foundKeywordsInPath = phishingKeywords.filter((keyword) => pathname.includes(keyword));
    
    if (foundKeywordsInHost.length > 0) {
      threats.push(`Contains suspicious keywords in domain: ${foundKeywordsInHost.join(", ")}`);
      suspiciousCount += foundKeywordsInHost.length * 1.5;
    }
    
    if (foundKeywordsInPath.length > 0) {
      threats.push(`Contains suspicious keywords in path: ${foundKeywordsInPath.join(", ")}`);
      suspiciousCount += foundKeywordsInPath.length;
    }

    // Check for @ symbol (can hide real domain)
    if (url.includes("@")) {
      threats.push("Contains @ symbol which can hide the real domain");
      suspiciousCount += 3;
      
      // Extra penalty: check for phishing keywords BEFORE the @ symbol
      const beforeAt = url.split("@")[0].toLowerCase();
      const atPhishingKeywords = [
        "account", "suspended", "urgent", "verify", "confirm", 
        "security", "alert", "warning", "locked", "blocked",
        "update", "validate", "expire", "immediate"
      ];
      
      const foundAtKeywords = atPhishingKeywords.filter(keyword => beforeAt.includes(keyword));
      if (foundAtKeywords.length > 0) {
        threats.push(`CRITICAL: Phishing keywords in URL disguise: ${foundAtKeywords.join(", ")}`);
        suspiciousCount += foundAtKeywords.length * 2; // 2 points per keyword
      }
    }

    // Check for URL shorteners
    const shorteners = ["bit.ly", "tinyurl.com", "goo.gl", "t.co", "ow.ly"];
    if (shorteners.some((shortener) => hostname.includes(shortener))) {
      threats.push("Uses URL shortener which can hide destination");
      suspiciousCount += 1;
    }

    // CRITICAL: Check for brand impersonation
    for (const [brandName, officialDomains] of Object.entries(BRAND_DOMAINS)) {
      // Check if domain contains the brand name (use normalized hostname)
      let containsBrand = normalizedHostname.includes(brandName);
      
      // Also check for common character substitutions (typosquatting)
      if (!containsBrand && brandName === "facebook") {
        // Check for variations like: fac8b00k, faceb00k, face8ook, etc.
        const fbVariations = [
          /face?b[o0]{2}k/i,     // facebo0k, faceb00k, facebOOk
          /fac[e38][b8][o0]{2}k/i, // fac8b00k, fac3b00k, face800k
          /f[a4]c[e3][b8][o0]{2}k/i, // f4ceb00k, face800k
        ];
        containsBrand = fbVariations.some(pattern => pattern.test(normalizedHostname));
      } else if (!containsBrand && brandName === "paypal") {
        const ppVariations = [
          /p[a4]yp[a4][l1]/i,    // p4ypal, paypa1, p4yp4l
        ];
        containsBrand = ppVariations.some(pattern => pattern.test(normalizedHostname));
      } else if (!containsBrand && brandName === "google") {
        const ggVariations = [
          /g[o0]{2}g[l1][e3]/i,  // goog1e, g00gle, goog13
        ];
        containsBrand = ggVariations.some(pattern => pattern.test(normalizedHostname));
      } else if (!containsBrand && brandName === "amazon") {
        const azVariations = [
          /[a4]m[a4]z[o0]n/i,    // amaz0n, 4mazon, am4z0n
        ];
        containsBrand = azVariations.some(pattern => pattern.test(normalizedHostname));
      }
      
      if (containsBrand) {
        // Verify if it's actually an official domain
        const isOfficialDomain = officialDomains.some(
          (official) => normalizedHostname === official || normalizedHostname.endsWith(`.${official}`)
        );
        
        // Debug logging
        console.log(`🔍 Brand check: "${brandName}" in "${normalizedHostname}" | Official: ${isOfficialDomain}`);
        
        if (!isOfficialDomain) {
          threats.push(`CRITICAL: Impersonates ${brandName.toUpperCase()} but is NOT an official domain`);
          suspiciousCount += 7; // Very high penalty for brand impersonation (increased from 5)
          console.log(`⚠️ DETECTED IMPERSONATION: ${brandName} in ${normalizedHostname}`);
        }
      }
    }

    // Check for typosquatting patterns (common character substitutions)
    const typoPatterns = [
      { real: 'o', fake: '0' },  // facebook00k
      { real: 'l', fake: '1' },  // paypa1
      { real: 'i', fake: '1' },  // microsoftl
      { real: 'o', fake: 'o0' }, // goo0gle
    ];
    
    // Check for numbers mixed with letters in suspicious ways
    if (/[a-z]+[0-9]+[a-z]|[a-z][0-9]{2,}/.test(hostname)) {
      threats.push("Suspicious character pattern detected (possible typosquatting)");
      suspiciousCount += 2;
    }

    // Check for HTTPS - more severe penalty
    if (urlObj.protocol !== "https:") {
      threats.push("Does not use HTTPS encryption");
      suspiciousCount += 2; // Increased from 1 to 2
      
      // Extra penalty if no HTTPS AND has sensitive keywords
      if (foundKeywordsInPath.length > 0 || foundKeywordsInHost.length > 0) {
        threats.push("Critical: Sensitive operation without HTTPS encryption");
        suspiciousCount += 2;
      }
      
      // Extra critical penalty if no HTTPS AND using IP
      if (isIPAddress) {
        threats.push("Critical: IP address without HTTPS - highly suspicious");
        suspiciousCount += 3;
      }
    }

    // Check for suspicious port numbers
    if (urlObj.port && !["80", "443", "8080"].includes(urlObj.port)) {
      threats.push(`Uses non-standard port: ${urlObj.port}`);
      suspiciousCount += 1.5;
    }

  } catch (error) {
    threats.push("Invalid or malformed URL");
    suspiciousCount += 3;
  }

  // Improved scoring: More sensitive to multiple red flags
  // 0-2: low risk (20%)
  // 3-5: medium risk (30-50%)
  // 6-8: high risk (60-80%)
  // 9+: critical risk (90-100%)
  const score = Math.min(suspiciousCount / 12, 1);
  return { score, threats };
}

// Heuristic analysis for text content
function analyzeTextHeuristic(text: string): { score: number; threats: string[] } {
  const threats: string[] = [];
  let suspiciousCount = 0;

  const lowerText = text.toLowerCase();

  // Check for urgency tactics
  const urgencyWords = [
    "urgent",
    "immediate",
    "immediately",
    "act now",
    "limited time",
    "expires",
    "verify now",
    "confirm immediately",
    "24 hours",
    "48 hours",
    "action required",
    "respond now",
    "click here now",
  ];
  urgencyWords.forEach((word) => {
    if (lowerText.includes(word)) {
      threats.push(`Uses urgency tactic: "${word}"`);
      suspiciousCount += 1.5;
    }
  });

  // Check for threatening language
  const threateningWords = [
    "account closed", 
    "account will be closed",
    "legal action", 
    "suspended", 
    "locked", 
    "blocked",
    "terminate",
    "deactivate",
    "unauthorized access",
    "unusual activity",
    "suspicious activity",
  ];
  threateningWords.forEach((word) => {
    if (lowerText.includes(word)) {
      threats.push(`Contains threatening language: "${word}"`);
      suspiciousCount += 1.5;
    }
  });

  // Check for requests for sensitive information (using word boundaries)
  const sensitiveRequests = [
    { term: "social security", regex: /social\s+security/i },
    { term: "password", regex: /\bpassword\b/i },
    { term: "pin", regex: /\bpin\b/i },  // Word boundary to avoid "shopping"
    { term: "credit card", regex: /credit\s+card/i },
    { term: "bank account", regex: /bank\s+account/i },
    { term: "ssn", regex: /\bssn\b/i },
    { term: "cvv", regex: /\bcvv\b/i },
    { term: "verify your account", regex: /verify\s+your\s+account/i },
    { term: "verify your identity", regex: /verify\s+your\s+identity/i },
    { term: "confirm your identity", regex: /confirm\s+your\s+identity/i },
    { term: "update your information", regex: /update\s+your\s+information/i },
    { term: "update payment", regex: /update\s+payment/i },
  ];
  sensitiveRequests.forEach(({ term, regex }) => {
    if (regex.test(lowerText)) {
      threats.push(`Requests sensitive information: "${term}"`);
      suspiciousCount += 2;
    }
  });

  // Check for generic greetings
  if (lowerText.includes("dear customer") || 
      lowerText.includes("dear user") ||
      lowerText.includes("dear member") ||
      lowerText.includes("valued customer")) {
    threats.push("Uses generic greeting instead of personal name");
    suspiciousCount += 1;
  }

  // Check for common phishing phrases
  const phishingPhrases = [
    "click here to",
    "click the link",
    "update account",
    "reactivate",
    "re-activate",
    "validate",
    "unusual sign-in",
    "suspicious sign-in",
  ];
  phishingPhrases.forEach((phrase) => {
    if (lowerText.includes(phrase)) {
      threats.push(`Contains phishing phrase: "${phrase}"`);
      suspiciousCount += 1;
    }
  });

  // Provider Mismatch Check - Corporate security alerts to personal emails
  if ((lowerText.includes("microsoft") || lowerText.includes("office 365") || lowerText.includes("account team")) &&
      (lowerText.includes("@gmail.com") || lowerText.includes("@yahoo.com") || lowerText.includes("@hotmail.com"))) {
    threats.push("HIGH RISK: Corporate security alert sent to personal email address");
    suspiciousCount += 3;
  }

  // Check for email masking patterns (ra**6@gmail.com)
  if (/[a-z]{1,3}\*+[0-9]@/i.test(text)) {
    threats.push("Uses masked email address pattern (e.g., ra**6@gmail.com)");
    suspiciousCount += 1.5;
  }

  // Check for IP address mentions (often in fake security alerts)
  if (/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(text)) {
    threats.push("Contains IP address (common in fake security alerts)");
    suspiciousCount += 0.5;
  }

  // Check for foreign language characters (Chinese, Cyrillic, Arabic)
  // These can indicate targeted phishing with wrong language
  const hasChinese = /[\u4e00-\u9fa5]/.test(text);
  const hasCyrillic = /[\u0400-\u04FF]/.test(text);
  const hasArabic = /[\u0600-\u06FF]/.test(text);
  
  if (hasChinese || hasCyrillic || hasArabic) {
    const langName = hasChinese ? "Chinese" : hasCyrillic ? "Cyrillic" : "Arabic";
    threats.push(`Contains ${langName} characters - verify expected language`);
    suspiciousCount += 2;
  }

  // Check for forwarded message patterns
  if (lowerText.includes("forwarded message") || 
      lowerText.includes("---------- forwarded") ||
      text.includes("Fwd:") || 
      lowerText.includes("date:") && lowerText.includes("from:") && lowerText.includes("subject:")) {
    threats.push("Appears to be a forwarded message (verify sender authenticity)");
    suspiciousCount += 1.5;
  }

  // Check for password/security change notifications
  if ((lowerText.includes("password") || lowerText.includes("security")) &&
      (lowerText.includes("changed") || lowerText.includes("modified") || 
       lowerText.includes("updated") || lowerText.includes("reset"))) {
    threats.push("Contains password/security change notification");
    suspiciousCount += 1.5;
  }

  // Check for account recovery/lock mentions
  if (lowerText.includes("account recovery") || 
      lowerText.includes("recover account") ||
      lowerText.includes("lock account") ||
      lowerText.includes("restore access")) {
    threats.push("Mentions account recovery (verify authenticity)");
    suspiciousCount += 1;
  }

  // Check for misspellings of common brands
  const brands = ["paypal", "amazon", "microsoft", "apple", "google", "facebook"];
  const misspellings: Record<string, string[]> = {
    paypal: ["paypai", "paypa1", "paypa"],
    amazon: ["arnazon", "arnazon", "amazom"],
    microsoft: ["rnicrosoft", "microsft"],
  };

  Object.entries(misspellings).forEach(([brand, variants]) => {
    variants.forEach((variant) => {
      if (lowerText.includes(variant)) {
        threats.push(`Possible brand impersonation: "${variant}" (${brand})`);
        suspiciousCount += 2;
      }
    });
  });

  // Calculate score with better scaling
  const score = Math.min(suspiciousCount / 6, 1); // Reduced denominator for higher sensitivity
  return { score, threats };
}

function roundScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  const clamped = Math.min(Math.max(score, 0), 1);
  return Number(clamped.toFixed(4));
}

function computeSignalScore(mlScore: number, heuristicScore: number): number {
  if (mlScore > 0) {
    return roundScore(
      mlScore * WEIGHTED_SCORE_CONFIG.mlInsideSignal +
        heuristicScore * WEIGHTED_SCORE_CONFIG.heuristicInsideSignal
    );
  }

  return roundScore(heuristicScore);
}

function computeWeightedScore(urlSignal: number, textSignal: number, hasUrl: boolean, hasText: boolean): number {
  const activeWeights: Array<{ score: number; weight: number }> = [];

  if (hasUrl) {
    activeWeights.push({ score: urlSignal, weight: WEIGHTED_SCORE_CONFIG.urlSignal });
  }

  if (hasText) {
    activeWeights.push({ score: textSignal, weight: WEIGHTED_SCORE_CONFIG.textSignal });
  }

  if (activeWeights.length === 0) return 0;

  const totalWeight = activeWeights.reduce((sum, item) => sum + item.weight, 0);
  const weighted = activeWeights.reduce((sum, item) => sum + item.score * item.weight, 0);
  return roundScore(weighted / totalWeight);
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function parseHardBlockRiskLevel(level: string): number {
  const normalized = level.toLowerCase();
  if (normalized === "low") return 1;
  if (normalized === "medium") return 2;
  if (normalized === "high") return 3;
  if (normalized === "critical") return 4;
  return 4;
}

function riskLevelToRank(level: string): number {
  if (level === "low") return 1;
  if (level === "medium") return 2;
  if (level === "high") return 3;
  if (level === "critical") return 4;
  return 0;
}

function computePolicyDecision(
  riskLevel: "safe" | "low" | "medium" | "high" | "critical",
  confidence: number,
  safeBrowsingHit: boolean
): PolicyDecision {
  const blockRiskRank = parseHardBlockRiskLevel(ENFORCEMENT_POLICY.hardBlockRisk);
  const currentRiskRank = riskLevelToRank(riskLevel);

  if (
    currentRiskRank >= blockRiskRank &&
    confidence >= ENFORCEMENT_POLICY.minConfidenceForHardBlock &&
    safeBrowsingHit
  ) {
    return {
      action: "block",
      reason: "high_confidence_reputation_hit",
      hardBlock: true,
    };
  }

  if (currentRiskRank >= riskLevelToRank("high")) {
    return {
      action: "warn",
      reason: "high_risk_requires_user_confirmation",
      hardBlock: false,
    };
  }

  if (currentRiskRank >= riskLevelToRank("medium")) {
    return {
      action: "warn",
      reason: "medium_risk_advisory",
      hardBlock: false,
    };
  }

  return {
    action: "allow",
    reason: "risk_below_enforcement_threshold",
    hardBlock: false,
  };
}

function sanitizeUrlForStorage(url: string | undefined, shouldStore: boolean): { value: string | null; host: string | null; usedHostOnly: boolean } {
  if (!url || !shouldStore) {
    return { value: null, host: null, usedHostOnly: false };
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (STORAGE_POLICY.storeFullUrl) {
      return {
        value: `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}`,
        host,
        usedHostOnly: false,
      };
    }

    return {
      value: host,
      host,
      usedHostOnly: true,
    };
  } catch {
    return {
      value: STORAGE_POLICY.storeFullUrl ? url : null,
      host: null,
      usedHostOnly: !STORAGE_POLICY.storeFullUrl,
    };
  }
}

export async function analyzePhishing(input: AnalyzeInput, context: AnalyzeContext = {}): Promise<AnalysisResult> {
  const session = context.userId ? null : await requireAuth();
  const userId = context.userId || session?.user.id;

  if (!userId) {
    throw new Error("Unauthorized - missing user context");
  }

  const source = context.source || (context.userId ? "api" : "web");
  const enforceLimits = context.enforceLimits ?? !context.userId;

  // Check scan limits based on subscription (can be bypassed in dev or disabled per context)
  const disableLimits = process.env.DISABLE_SCAN_LIMITS === "true";
  if (enforceLimits && !disableLimits) {
    const limitsCheck = await checkScanLimits(userId);
    if (!limitsCheck.allowed) {
      // Attach context so the client can show an upgrade CTA
      const subInfo = await getUserSubscriptionInfo(userId);
      const payload = {
        code: "SCAN_LIMIT_REACHED",
        message: limitsCheck.reason || "Scan limit exceeded",
        limits: limitsCheck.limits,
        planId: subInfo.planId,
        subscriptionType: subInfo.subscriptionType,
        organizationSlug: subInfo.organizationSlug,
      };
      // Serialize into message so it survives Server Action transport
      throw new Error(`PG_LIMIT:${JSON.stringify(payload)}`);
    }
  }

  let urlScore = 0;
  let textScore = 0;
  const allThreats: string[] = [];
  let mlDetectionUsed = false;
  let extractedText = input.textContent || "";

  // === IMAGE ANALYSIS (OCR) ===
  if (input.imageUrl) {
    try {
      console.log("🖼️ Processing image with OCR...");
      // Extract text from image using OCR
      const { extractTextFromImage } = await import("@/lib/ocr");
      
      // Fetch the image
      const response = await fetch(input.imageUrl);
      const blob = await response.blob();
      const file = new File([blob], "image.jpg", { type: blob.type });
      
      // Extract text
      const ocrText = await extractTextFromImage(file);
      extractedText = ocrText;
      console.log(`✅ OCR extracted ${ocrText.length} characters`);
      
      if (ocrText.length < 10) {
        allThreats.push("Image contains very little text - may be suspicious");
      }
    } catch (error) {
      console.error("OCR failed:", error);
      allThreats.push("Failed to extract text from image");
    }
  }

  // === URL ANALYSIS ===
  let safeBrowsingScore = 0;
  let urlMLScore = 0;
  let urlHeuristicScore = 0;
  let urlModelVersion: string | null = null;
  if (input.url) {
    // 1. Google Safe Browsing (authoritative database)
    const safeBrowsingResult = await checkSafeBrowsing(input.url);
    
    if (!safeBrowsingResult.isSafe) {
      safeBrowsingScore = getThreatSeverity(safeBrowsingResult.threatTypes);
      allThreats.push(...safeBrowsingResult.threats);
    }

    // 1. ML Model via Service (trained on phishing URLs)
    try {
      const mlResult = await analyzeUrlMLDetailed(input.url);
      if (mlResult && mlResult.score >= 0) {
        urlMLScore = mlResult.score;
        urlModelVersion = mlResult.modelVersion;
        mlDetectionUsed = true;
        if (mlResult.score > 0.7) {
          allThreats.push(`ML model detected phishing patterns (confidence: ${(mlResult.score * 100).toFixed(0)}%)`);
        }
      }
    } catch (error) {
      console.error('URL ML analysis error:', error);
    }

    // 2. Heuristic analysis (rule-based)
    const urlAnalysis = analyzeUrlHeuristic(input.url);
    urlHeuristicScore = urlAnalysis.score;
    allThreats.push(...urlAnalysis.threats);
  }

  // === TEXT ANALYSIS ===
  let textMLScore = 0;
  let textHeuristicScore = 0;
  let textModelVersion: string | null = null;
  if (extractedText && extractedText.length > 0) {
    // 1. ML Model via Service (trained on phishing emails)
    try {
      const mlResult = await analyzeTextMLDetailed(extractedText);
      if (mlResult && mlResult.score >= 0) {
        textMLScore = mlResult.score;
        textModelVersion = mlResult.modelVersion;
        mlDetectionUsed = true;
        if (mlResult.score > 0.7) {
          allThreats.push(`ML model detected suspicious text patterns (confidence: ${(mlResult.score * 100).toFixed(0)}%)`);
        }
      }
    } catch (error) {
      console.error('Text ML analysis error:', error);
    }

    // 2. Heuristic analysis
    const textAnalysis = analyzeTextHeuristic(extractedText);
    textHeuristicScore = textAnalysis.score;
    allThreats.push(...textAnalysis.threats);
  }

  // Weighted score composition (with Safe Browsing override for critical reputation hits)
  urlScore = computeSignalScore(urlMLScore, urlHeuristicScore);
  textScore = computeSignalScore(textMLScore, textHeuristicScore);
  const weightedScore = computeWeightedScore(urlScore, textScore, Boolean(input.url), Boolean(extractedText));
  const overallScore = roundScore(Math.max(weightedScore, safeBrowsingScore));

  const riskLevel = getRiskLevel(overallScore);
  const isPhishing = isPhishingScore(overallScore);
  
  // Confidence calculation based on detection methods used
  let confidence = 0.5; // Base confidence
  if (safeBrowsingScore > 0) {
    confidence = 0.95; // Very high confidence - Google's database
  } else if (mlDetectionUsed && (urlMLScore > 0.7 || textMLScore > 0.7)) {
    confidence = 0.88; // High confidence - ML detected strong patterns
  } else if (mlDetectionUsed) {
    confidence = Math.min(0.75 + (allThreats.length * 0.03), 0.92); // ML + heuristics
  } else {
    confidence = Math.min(0.65 + (allThreats.length * 0.05), 0.85); // Only heuristics
  }

  const scoreBreakdown: ScoreBreakdown = {
    urlMlScore: roundScore(urlMLScore),
    urlHeuristicScore: roundScore(urlHeuristicScore),
    textMlScore: roundScore(textMLScore),
    textHeuristicScore: roundScore(textHeuristicScore),
    safeBrowsingScore: roundScore(safeBrowsingScore),
    weightedScore: roundScore(weightedScore),
  };

  const modelVersions: ModelVersions = {
    urlModel: urlModelVersion,
    textModel: textModelVersion,
    safeBrowsingHit: safeBrowsingScore > 0,
  };

  const policyDecision = computePolicyDecision(riskLevel, confidence, modelVersions.safeBrowsingHit);

  // Forensics mode is an explicit override used for incident investigations.
  const shouldStoreText = FORENSICS_MODE
    ? true
    : isPhishing
      ? STORAGE_POLICY.storePhishingContent
      : STORAGE_POLICY.storeSafeContent;
  const shouldStoreUrl = isPhishing
    ? STORAGE_POLICY.storePhishingUrl
    : STORAGE_POLICY.storeSafeUrl;
  const storedUrl = sanitizeUrlForStorage(input.url, shouldStoreUrl);

  const persistedText = shouldStoreText ? (extractedText || input.textContent || null) : null;
  const persistedImageUrl = shouldStoreText ? input.imageUrl : null;
  const retentionPolicy: RetentionPolicy = {
    storedText: Boolean(persistedText),
    storedUrl: Boolean(storedUrl.value),
    usedUrlHostOnly: storedUrl.usedHostOnly,
    forensicsMode: FORENSICS_MODE,
  };

  const textHash = extractedText ? sha256Hex(extractedText) : null;
  const urlHash = input.url ? sha256Hex(input.url) : null;
  const indicatorCount = allThreats.length;

  allThreats.push(
    `scoring_version:${SCORING_VERSION}`,
    `weighted_score:${scoreBreakdown.weightedScore.toFixed(4)}`,
    urlModelVersion ? `model_url:${urlModelVersion}` : "model_url:none",
    textModelVersion ? `model_text:${textModelVersion}` : "model_text:none",
    modelVersions.safeBrowsingHit ? "safe_browsing:hit" : "safe_browsing:miss",
    `policy_action:${policyDecision.action}`,
    `policy_reason:${policyDecision.reason}`,
    `policy_forensics_mode:${FORENSICS_MODE ? "on" : "off"}`,
    `policy_store_safe_content:${STORAGE_POLICY.storeSafeContent ? "on" : "off"}`,
    `retention_text:${retentionPolicy.storedText ? "stored" : "redacted"}`,
    `retention_url:${retentionPolicy.storedUrl ? (retentionPolicy.usedUrlHostOnly ? "host_only" : "full") : "redacted"}`,
    textHash ? `text_sha256:${textHash}` : "text_sha256:none",
    urlHash ? `url_sha256:${urlHash}` : "url_sha256:none"
  );
  const uniqueThreats = Array.from(new Set(allThreats));

  // Generate analysis message
  let analysisMethod = '';
  if (safeBrowsingScore > 0) {
    analysisMethod = 'Google Safe Browsing flagged this URL as dangerous. ';
  } else if (mlDetectionUsed) {
    analysisMethod = 'AI-powered detection analyzed this content. ';
  }

  const analysis = isPhishing
    ? `This ${input.url ? "URL" : input.imageUrl ? "image" : "content"} shows ${indicatorCount} suspicious indicator${indicatorCount !== 1 ? 's' : ''} commonly associated with phishing attempts. ${analysisMethod}Risk score: ${(overallScore * 100).toFixed(1)}%. Exercise caution and verify the source before proceeding.`
    : `No significant threats detected in this ${input.url ? "URL" : input.imageUrl ? "image" : "content"}. ${mlDetectionUsed ? 'AI models analyzed the content and found it safe. ' : ''}Risk score: ${(overallScore * 100).toFixed(1)}%. However, always verify the sender's identity and be cautious with personal information.`;

  // Get subscription info to determine organization context
  const subInfo = await getUserSubscriptionInfo(userId);
  const memberDepartment = subInfo.organizationId
    ? await prisma.organizationMember.findFirst({
        where: {
          organizationId: subInfo.organizationId,
          userId,
        },
        select: {
          departmentId: true,
        },
      })
    : null;

  // Save to database (with organization if applicable)
  const scan = await prisma.scan.create({
    data: {
      userId,
      organizationId: subInfo.organizationId || null,
      departmentId: memberDepartment?.departmentId || null,
      url: storedUrl.value,
      textContent: persistedText,
      imageUrl: persistedImageUrl,
      textScore,
      urlScore,
      overallScore,
      riskLevel,
      isPhishing,
      confidence,
      detectedThreats: uniqueThreats,
      analysis,
      source,
    },
  });

  // Update user stats
  await prisma.dashboardStats.upsert({
    where: { userId },
    create: {
      userId,
      totalScans: 1,
      threatsBlocked: isPhishing ? 1 : 0,
      safeSites: isPhishing ? 0 : 1,
      scansThisWeek: 1,
      scansThisMonth: 1,
      lastScanAt: new Date(),
    },
    update: {
      totalScans: { increment: 1 },
      threatsBlocked: { increment: isPhishing ? 1 : 0 },
      safeSites: { increment: isPhishing ? 0 : 1 },
      scansThisWeek: { increment: 1 },
      scansThisMonth: { increment: 1 },
      lastScanAt: new Date(),
    },
  });

  return {
    textScore,
    urlScore,
    overallScore,
    riskLevel,
    isPhishing,
    confidence,
    detectedThreats: uniqueThreats,
    analysis,
    scanId: scan.id,
    scoringVersion: SCORING_VERSION,
    scoreBreakdown,
    modelVersions,
    policyDecision,
    retentionPolicy,
  };
}
