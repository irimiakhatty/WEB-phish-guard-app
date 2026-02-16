import { getRiskLevel } from "@/lib/risk-levels";

/**
 * PhishGuard Heuristics Engine
 * Rule-based analysis for detecting high-confidence phishing attempts.
 */

export interface HeuristicResult {
  score: number; // 0.0 to 1.0 (1.0 = Definite Phishing)
  reasons: string[];
  riskLevel: "safe" | "warning" | "high" | "critical";
  isSafeDomain?: boolean;
}

const SUSPICIOUS_TLDS = [
  ".xyz",
  ".top",
  ".gq",
  ".tk",
  ".ml",
  ".cf",
  ".ga",
  ".cn",
  ".ru",
  ".work",
  ".click",
  ".loan",
];

const BRAND_DOMAINS: Record<string, string[]> = {
  paypal: ["paypal.com", "paypal.me", "www.paypal.com"],
  google: [
    "google.com",
    "google.co.uk",
    "gmail.com",
    "accounts.google.com",
    "www.google.com",
  ],
  microsoft: [
    "microsoft.com",
    "live.com",
    "office.com",
    "outlook.com",
    "azure.com",
    "www.microsoft.com",
  ],
  apple: ["apple.com", "icloud.com", "www.apple.com"],
  facebook: ["facebook.com", "fb.com", "messenger.com", "www.facebook.com"],
  instagram: ["instagram.com", "www.instagram.com"],
  amazon: ["amazon.com", "amazon.co.uk", "amazon.de", "www.amazon.com"],
  netflix: ["netflix.com", "www.netflix.com"],
  dhl: ["dhl.com", "www.dhl.com"],
  yahoo: ["yahoo.com", "mail.yahoo.com"],
  linkedin: ["linkedin.com", "www.linkedin.com"],
};

const URGENCY_KEYWORDS = [
  "immediately",
  "24 hours",
  "suspend",
  "lock",
  "unauthorized",
  "verify identity",
  "account limited",
  "action required",
  "urgent",
  "security alert",
  "compromised",
  "closing your account",
  "deactivation",
  "terminating",
];

export function analyzeHeuristics(text: string, url: string): HeuristicResult {
  let score = 0;
  const reasons: string[] = [];
  const lowerText = text.toLowerCase();
  const lowerUrl = url.toLowerCase().trim();
  let isSafeDomain = false;

  // --- URL ANALYSIS ---
  if (lowerUrl) {
    try {
      const urlToParse = lowerUrl.startsWith("http")
        ? lowerUrl
        : `http://${lowerUrl}`;
      const urlObj = new URL(urlToParse);
      const domain = urlObj.hostname;

      // Whitelist check
      for (const [_, officialDomains] of Object.entries(BRAND_DOMAINS)) {
        if (
          officialDomains.some(
            (od) => domain === od || domain.endsWith(`.${od}`)
          )
        ) {
          isSafeDomain = true;
          break;
        }
      }

      if (!isSafeDomain) {
        // IP address detection
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (ipRegex.test(domain)) {
          score += 1.0;
          reasons.push(
            "Critical: URL uses an IP address instead of a domain name."
          );
        }

        // Suspicious TLDs
        const tldParts = domain.split(".");
        if (tldParts.length > 1) {
          const tld = tldParts.pop();
          if (tld && SUSPICIOUS_TLDS.includes(`.${tld}`)) {
            score += 0.3;
            reasons.push(`Suspicious TLD detected: .${tld}`);
          }
        }

        // Credential embedding
        if (lowerUrl.includes("@")) {
          score += 0.8;
          reasons.push(
            "High Risk: URL contains '@' symbol, possibly hiding true destination."
          );
        }

        // Homograph/mixed script attacks
        if (/[^\u0000-\u007F]+/.test(domain)) {
          score += 0.2;
          reasons.push(
            "Warning: Domain contains special/non-Latin characters."
          );
        }

        // Brand impersonation
        Object.entries(BRAND_DOMAINS).forEach(([brand, officialDomains]) => {
          if (lowerUrl.includes(brand) || lowerText.includes(brand)) {
            const isOfficial = officialDomains.some(
              (od) => domain === od || domain.endsWith(`.${od}`)
            );
            if (!isOfficial) {
              score += 0.8;
              reasons.push(
                `High Risk: URL impersonates ${brand.toUpperCase()} but is not an official domain.`
              );
            }
          }
        });
      }
    } catch (e) {
      score += 0.5;
      reasons.push("Warning: Invalid URL format.");
    }
  }

  // --- TEXT ANALYSIS ---
  if (lowerText) {
    // Urgency & panic
    let urgencyCount = 0;
    URGENCY_KEYWORDS.forEach((word) => {
      if (lowerText.includes(word)) {
        urgencyCount++;
      }
    });

    if (urgencyCount > 0) {
      score += Math.min(urgencyCount * 0.15, 0.45);
      reasons.push(
        `Suspicious language: Detected ${urgencyCount} urgency/panic keywords.`
      );
    }

    // Generic greetings
    if (
      lowerText.includes("dear customer") ||
      lowerText.includes("dear user") ||
      lowerText.includes("dear member")
    ) {
      score += 0.2;
      reasons.push(
        "Warning: Generic greeting ('Dear Customer') is common in phishing."
      );
    }

    // Provider mismatch
    if (
      (lowerText.includes("microsoft") || lowerText.includes("office 365")) &&
      (lowerText.includes("@gmail.com") || lowerText.includes("@yahoo.com"))
    ) {
      score += 0.7;
      reasons.push(
        "High Risk: Corporate security alert sent to a personal email address."
      );
    }
  }

  // HTML/Script analysis
  if (lowerText.includes("<script>") || lowerText.includes("javascript:")) {
    score += 0.9;
    reasons.push("Critical: Detected potential XSS script injection attempt.");
  }

  // Final score cap
  score = Math.min(score, 1.0);

  let riskLevel: HeuristicResult["riskLevel"] = "safe";
  const normalized = getRiskLevel(score);
  if (normalized === "critical") riskLevel = "critical";
  else if (normalized === "high") riskLevel = "high";
  else if (normalized === "medium" || normalized === "low") riskLevel = "warning";

  return { score, reasons, riskLevel, isSafeDomain };
}
