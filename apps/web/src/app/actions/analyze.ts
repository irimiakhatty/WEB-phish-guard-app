"use server";

import prisma from "@phish-guard-app/db";
import { requireAuth } from "@/lib/auth-helpers";
import { checkSafeBrowsing, getThreatSeverity } from "@/lib/safe-browsing";
import { analyzeTextML, analyzeUrlML } from "@/lib/ml-service";
import { checkScanLimits, getUserSubscriptionInfo } from "@/lib/subscription-helpers";

type AnalyzeInput = {
  url?: string;
  textContent?: string;
  imageUrl?: string;
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

function calculateRiskLevel(score: number): "safe" | "low" | "medium" | "high" | "critical" {
  if (score < 0.15) return "safe";
  if (score < 0.3) return "low";
  if (score < 0.5) return "medium";
  if (score < 0.75) return "high";
  return "critical";
}

export async function analyzePhishing(input: AnalyzeInput): Promise<AnalysisResult> {
  const session = await requireAuth();

  // Check scan limits based on subscription
  const limitsCheck = await checkScanLimits(session.user.id);
  if (!limitsCheck.allowed) {
    throw new Error(limitsCheck.reason || "Scan limit exceeded");
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
  if (input.url) {
    // 1. Google Safe Browsing (authoritative database)
    const safeBrowsingResult = await checkSafeBrowsing(input.url);
    
    if (!safeBrowsingResult.isSafe) {
      safeBrowsingScore = getThreatSeverity(safeBrowsingResult.threatTypes);
      allThreats.push(...safeBrowsingResult.threats);
    }

    // 1. ML Model via Service (trained on phishing URLs)
    try {
      const mlScore = await analyzeUrlML(input.url);
      if (mlScore !== null && mlScore >= 0) {
        urlMLScore = mlScore;
        mlDetectionUsed = true;
        if (mlScore > 0.7) {
          allThreats.push(`ML model detected phishing patterns (confidence: ${(mlScore * 100).toFixed(0)}%)`);
        }
      }
    } catch (error) {
      console.error('URL ML analysis error:', error);
    }

    // 3. Heuristic analysis (rule-based)
    const urlAnalysis = analyzeUrlHeuristic(input.url);
    allThreats.push(...urlAnalysis.threats);

    // Combine scores: prioritize Safe Browsing > ML > Heuristics
    if (safeBrowsingScore > 0) {
      urlScore = safeBrowsingScore; // Google flagged it - highest confidence
    } else if (urlMLScore > 0) {
      urlScore = Math.max(urlMLScore, urlAnalysis.score); // ML or heuristics, whichever higher
    } else {
      urlScore = urlAnalysis.score; // Only heuristics
    }
  }

  // === TEXT ANALYSIS ===
  let textMLScore = 0;
  if (extractedText && extractedText.length > 0) {
    // 1. ML Model via Service (trained on phishing emails)
    try {
      const mlScore = await analyzeTextML(extractedText);
      if (mlScore !== null && mlScore >= 0) {
        textMLScore = mlScore;
        mlDetectionUsed = true;
        if (mlScore > 0.7) {
          allThreats.push(`ML model detected suspicious text patterns (confidence: ${(mlScore * 100).toFixed(0)}%)`);
        }
      }
    } catch (error) {
      console.error('Text ML analysis error:', error);
    }

    // 2. Heuristic analysis
    const textAnalysis = analyzeTextHeuristic(extractedText);
    allThreats.push(...textAnalysis.threats);

    // Combine scores: ML takes priority if available
    textScore = textMLScore > 0 ? Math.max(textMLScore, textAnalysis.score) : textAnalysis.score;
  }

  // Calculate overall score (Google Safe Browsing has priority)
  const overallScore = safeBrowsingScore > 0 
    ? safeBrowsingScore // If Google flags it, that's the score
    : input.url && input.textContent 
      ? (urlScore + textScore) / 2 
      : urlScore || textScore;

  const riskLevel = calculateRiskLevel(overallScore);
  const isPhishing = overallScore > 0.5;
  
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

  // Generate analysis message
  let analysisMethod = '';
  if (safeBrowsingScore > 0) {
    analysisMethod = 'Google Safe Browsing flagged this URL as dangerous. ';
  } else if (mlDetectionUsed) {
    analysisMethod = 'AI-powered detection analyzed this content. ';
  }

  const analysis = isPhishing
    ? `This ${input.url ? "URL" : input.imageUrl ? "image" : "content"} shows ${allThreats.length} suspicious indicator${allThreats.length !== 1 ? 's' : ''} commonly associated with phishing attempts. ${analysisMethod}Risk score: ${(overallScore * 100).toFixed(1)}%. Exercise caution and verify the source before proceeding.`
    : `No significant threats detected in this ${input.url ? "URL" : input.imageUrl ? "image" : "content"}. ${mlDetectionUsed ? 'AI models analyzed the content and found it safe. ' : ''}Risk score: ${(overallScore * 100).toFixed(1)}%. However, always verify the sender's identity and be cautious with personal information.`;

  // Get subscription info to determine organization context
  const subInfo = await getUserSubscriptionInfo(session.user.id);

  // Save to database (with organization if applicable)
  await prisma.scan.create({
    data: {
      userId: session.user.id,
      organizationId: subInfo.organizationId || null,
      url: input.url,
      textContent: extractedText || input.textContent,
      imageUrl: input.imageUrl,
      textScore,
      urlScore,
      overallScore,
      riskLevel,
      isPhishing,
      confidence,
      detectedThreats: allThreats,
      analysis,
      source: "web",
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
