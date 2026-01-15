"use server";

import { auth } from "@phish-guard-app/auth";
import prisma from "@phish-guard-app/db";
import { headers } from "next/headers";

type AnalyzeInput = {
  url?: string;
  textContent?: string;
};

type AnalysisResult = {
  textScore: number;
  urlScore: number;
  overallScore: number;
  riskLevel: "safe" | "low" | "medium" | "high" | "critical";
  isPhishing: boolean;
  confidence: number;
  detectedThreats: string[];
  analysis: string;
};

// Heuristic analysis for URLs
function analyzeURL(url: string): { score: number; threats: string[] } {
  const threats: string[] = [];
  let suspiciousCount = 0;

  try {
    const urlObj = new URL(url);

    // Check for IP address instead of domain
    if (/^\d+\.\d+\.\d+\.\d+$/.test(urlObj.hostname)) {
      threats.push("Uses IP address instead of domain name");
      suspiciousCount += 2;
    }

    // Check for suspicious TLDs
    const suspiciousTLDs = [".tk", ".ml", ".ga", ".cf", ".gq", ".xyz", ".top"];
    if (suspiciousTLDs.some((tld) => urlObj.hostname.endsWith(tld))) {
      threats.push("Uses suspicious top-level domain");
      suspiciousCount += 1;
    }

    // Check for excessive subdomains
    const subdomains = urlObj.hostname.split(".");
    if (subdomains.length > 4) {
      threats.push("Contains excessive subdomains");
      suspiciousCount += 1;
    }

    // Check for common phishing keywords in domain
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
    ];
    const hostname = urlObj.hostname.toLowerCase();
    const foundKeywords = phishingKeywords.filter((keyword) => hostname.includes(keyword));
    if (foundKeywords.length > 0) {
      threats.push(`Contains suspicious keywords: ${foundKeywords.join(", ")}`);
      suspiciousCount += foundKeywords.length;
    }

    // Check for @ symbol (can hide real domain)
    if (url.includes("@")) {
      threats.push("Contains @ symbol which can hide the real domain");
      suspiciousCount += 2;
    }

    // Check for URL shorteners
    const shorteners = ["bit.ly", "tinyurl.com", "goo.gl", "t.co", "ow.ly"];
    if (shorteners.some((shortener) => hostname.includes(shortener))) {
      threats.push("Uses URL shortener which can hide destination");
      suspiciousCount += 1;
    }

    // Check for HTTPS
    if (urlObj.protocol !== "https:") {
      threats.push("Does not use HTTPS encryption");
      suspiciousCount += 1;
    }

    // Check for suspicious port numbers
    if (urlObj.port && !["80", "443", "8080"].includes(urlObj.port)) {
      threats.push(`Uses non-standard port: ${urlObj.port}`);
      suspiciousCount += 1;
    }

  } catch (error) {
    threats.push("Invalid or malformed URL");
    suspiciousCount += 3;
  }

  const score = Math.min(suspiciousCount / 10, 1);
  return { score, threats };
}

// Heuristic analysis for text content
function analyzeText(text: string): { score: number; threats: string[] } {
  const threats: string[] = [];
  let suspiciousCount = 0;

  const lowerText = text.toLowerCase();

  // Check for urgency tactics
  const urgencyWords = [
    "urgent",
    "immediate",
    "act now",
    "limited time",
    "expires",
    "suspended",
    "verify now",
    "confirm immediately",
  ];
  urgencyWords.forEach((word) => {
    if (lowerText.includes(word)) {
      threats.push(`Uses urgency tactic: "${word}"`);
      suspiciousCount += 1;
    }
  });

  // Check for threatening language
  const threats_words = ["account closed", "legal action", "suspended", "locked", "blocked"];
  threats_words.forEach((word) => {
    if (lowerText.includes(word)) {
      threats.push(`Contains threatening language: "${word}"`);
      suspiciousCount += 1;
    }
  });

  // Check for requests for sensitive information
  const sensitiveRequests = [
    "social security",
    "password",
    "pin",
    "credit card",
    "bank account",
    "ssn",
    "cvv",
  ];
  sensitiveRequests.forEach((request) => {
    if (lowerText.includes(request)) {
      threats.push(`Requests sensitive information: "${request}"`);
      suspiciousCount += 2;
    }
  });

  // Check for generic greetings
  if (lowerText.includes("dear customer") || lowerText.includes("dear user")) {
    threats.push("Uses generic greeting instead of personal name");
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

  const score = Math.min(suspiciousCount / 8, 1);
  return { score, threats };
}

function calculateRiskLevel(score: number): "safe" | "low" | "medium" | "high" | "critical" {
  if (score < 0.2) return "safe";
  if (score < 0.4) return "low";
  if (score < 0.6) return "medium";
  if (score < 0.8) return "high";
  return "critical";
}

export async function analyzePhishing(input: AnalyzeInput): Promise<AnalysisResult> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  let urlScore = 0;
  let textScore = 0;
  const allThreats: string[] = [];

  // Analyze URL if provided
  if (input.url) {
    const urlAnalysis = analyzeURL(input.url);
    urlScore = urlAnalysis.score;
    allThreats.push(...urlAnalysis.threats);
  }

  // Analyze text if provided
  if (input.textContent) {
    const textAnalysis = analyzeText(input.textContent);
    textScore = textAnalysis.score;
    allThreats.push(...textAnalysis.threats);
  }

  // Calculate overall score
  const overallScore = input.url && input.textContent 
    ? (urlScore + textScore) / 2 
    : urlScore || textScore;

  const riskLevel = calculateRiskLevel(overallScore);
  const isPhishing = overallScore > 0.5;
  const confidence = Math.min(0.6 + (allThreats.length * 0.05), 0.95);

  const analysis = isPhishing
    ? `This ${input.url ? "URL" : "content"} shows ${allThreats.length} suspicious indicators commonly associated with phishing attempts. Exercise caution and verify the source before proceeding.`
    : `No significant threats detected. However, always verify the sender's identity and be cautious with personal information.`;

  // Save to database
  await prisma.scan.create({
    data: {
      userId: session.user.id,
      url: input.url,
      textContent: input.textContent,
      textScore,
      urlScore,
      overallScore,
      riskLevel,
      isPhishing,
      confidence,
      detectedThreats: allThreats,
      analysis,
    },
  });

  // Update user stats
  await prisma.dashboardStats.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
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
    detectedThreats: allThreats,
    analysis,
  };
}
