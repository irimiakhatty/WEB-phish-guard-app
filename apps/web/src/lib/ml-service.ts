/**
 * ML Service Client
 * Communicates with a Python FastAPI microservice for ML predictions.
 */

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:5000";

interface MLResponse {
  score: number;
  is_phishing: boolean;
  confidence: number;
  model_version: string;
}

export interface MLPrediction {
  score: number;
  isPhishing: boolean;
  confidence: number;
  modelVersion: string;
}

interface MLServiceHealth {
  status: string;
  models_loaded: {
    text: boolean;
    url: boolean;
    email: boolean;
  };
  tensorflow_version: string;
}

function toPrediction(result: MLResponse): MLPrediction {
  return {
    score: result.score,
    isPhishing: result.is_phishing,
    confidence: result.confidence,
    modelVersion: result.model_version,
  };
}

/**
 * Check if ML service is available.
 */
export async function isMLServiceAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${ML_SERVICE_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    });

    if (!response.ok) return false;

    const health: MLServiceHealth = await response.json();
    return health.status === "healthy";
  } catch (error) {
    console.warn("ML service unavailable:", error);
    return false;
  }
}

/**
 * Analyze text using ML model.
 * Returns a score only for backward compatibility.
 */
export async function analyzeTextML(text: string): Promise<number | null> {
  const result = await analyzeTextMLDetailed(text);
  return result ? result.score : null;
}

/**
 * Analyze text using ML model with metadata for evaluation.
 */
export async function analyzeTextMLDetailed(text: string): Promise<MLPrediction | null> {
  try {
    const response = await fetch(`${ML_SERVICE_URL}/analyze/text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.error("ML text analysis failed:", response.status);
      return null;
    }

    const result: MLResponse = await response.json();
    console.log(`Text ML analysis: score=${result.score.toFixed(3)}, model=${result.model_version}`);
    return toPrediction(result);
  } catch (error) {
    console.error("Error in text ML analysis:", error);
    return null;
  }
}

/**
 * Analyze URL using ML model.
 * Returns a score only for backward compatibility.
 */
export async function analyzeUrlML(url: string): Promise<number | null> {
  const result = await analyzeUrlMLDetailed(url);
  return result ? result.score : null;
}

/**
 * Analyze URL using ML model with metadata for evaluation.
 */
export async function analyzeUrlMLDetailed(url: string): Promise<MLPrediction | null> {
  try {
    const response = await fetch(`${ML_SERVICE_URL}/analyze/url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.error("ML URL analysis failed:", response.status);
      return null;
    }

    const result: MLResponse = await response.json();
    console.log(`URL ML analysis: score=${result.score.toFixed(3)}, model=${result.model_version}`);
    return toPrediction(result);
  } catch (error) {
    console.error("Error in URL ML analysis:", error);
    return null;
  }
}

/**
 * Analyze email using ML model.
 */
export async function analyzeEmailML(subject: string, body: string, sender: string): Promise<number | null> {
  try {
    const response = await fetch(`${ML_SERVICE_URL}/analyze/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ subject, body, sender }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.error("ML email analysis failed:", response.status);
      return null;
    }

    const result: MLResponse = await response.json();
    console.log(`Email ML analysis: score=${result.score.toFixed(3)}, model=${result.model_version}`);
    return result.score;
  } catch (error) {
    console.error("Error in email ML analysis:", error);
    return null;
  }
}

/**
 * Get ML service status for debugging.
 */
export async function getMLServiceStatus(): Promise<MLServiceHealth | null> {
  try {
    const response = await fetch(`${ML_SERVICE_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    });

    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error("Error getting ML service status:", error);
    return null;
  }
}
