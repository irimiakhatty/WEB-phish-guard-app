/**
 * Google Safe Browsing API Integration
 * Checks URLs against Google's database of unsafe websites
 */

interface SafeBrowsingResponse {
  matches?: Array<{
    threatType: string;
    platformType: string;
    threatEntryType: string;
    threat: {
      url: string;
    };
  }>;
}

export interface SafeBrowsingResult {
  isSafe: boolean;
  threats: string[];
  threatTypes: string[];
}

/**
 * Check URL against Google Safe Browsing API
 */
export async function checkSafeBrowsing(url: string): Promise<SafeBrowsingResult> {
  const apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY;

  if (!apiKey) {
    console.warn("Google Safe Browsing API key not configured");
    return {
      isSafe: true,
      threats: [],
      threatTypes: [],
    };
  }

  try {
    const response = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client: {
            clientId: "phishguard",
            clientVersion: "1.0.0",
          },
          threatInfo: {
            threatTypes: [
              "MALWARE",
              "SOCIAL_ENGINEERING",
              "UNWANTED_SOFTWARE",
              "POTENTIALLY_HARMFUL_APPLICATION",
            ],
            platformTypes: ["ANY_PLATFORM"],
            threatEntryTypes: ["URL"],
            threatEntries: [{ url }],
          },
        }),
      }
    );

    if (!response.ok) {
      console.error("Safe Browsing API error:", response.statusText);
      return {
        isSafe: true,
        threats: [],
        threatTypes: [],
      };
    }

    const data: SafeBrowsingResponse = await response.json();

    if (!data.matches || data.matches.length === 0) {
      return {
        isSafe: true,
        threats: [],
        threatTypes: [],
      };
    }

    const threats = data.matches.map((match) => {
      switch (match.threatType) {
        case "MALWARE":
          return "URL flagged as malware distributor";
        case "SOCIAL_ENGINEERING":
          return "URL flagged as phishing/social engineering";
        case "UNWANTED_SOFTWARE":
          return "URL distributes unwanted software";
        case "POTENTIALLY_HARMFUL_APPLICATION":
          return "URL contains potentially harmful applications";
        default:
          return `URL flagged as ${match.threatType}`;
      }
    });

    const threatTypes = data.matches.map((match) => match.threatType);

    return {
      isSafe: false,
      threats,
      threatTypes,
    };
  } catch (error) {
    console.error("Safe Browsing API error:", error);
    return {
      isSafe: true,
      threats: [],
      threatTypes: [],
    };
  }
}

/**
 * Get threat severity score from threat types
 */
export function getThreatSeverity(threatTypes: string[]): number {
  if (threatTypes.length === 0) return 0;

  let maxSeverity = 0;
  
  threatTypes.forEach((type) => {
    switch (type) {
      case "SOCIAL_ENGINEERING":
        maxSeverity = Math.max(maxSeverity, 1.0); // Phishing is critical
        break;
      case "MALWARE":
        maxSeverity = Math.max(maxSeverity, 0.9);
        break;
      case "UNWANTED_SOFTWARE":
        maxSeverity = Math.max(maxSeverity, 0.7);
        break;
      case "POTENTIALLY_HARMFUL_APPLICATION":
        maxSeverity = Math.max(maxSeverity, 0.6);
        break;
      default:
        maxSeverity = Math.max(maxSeverity, 0.5);
    }
  });

  return maxSeverity;
}
