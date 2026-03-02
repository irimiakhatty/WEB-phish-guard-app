// --- CONFIGURATION ---
const RISK_THRESHOLDS = {
    low: 0.2,
    medium: 0.4,
    high: 0.6,
    critical: 0.8
};

const DEEP_SCAN_MAX_CHARS = 5000;
const ANALYZE_TIMEOUT_MS = 8000;
const FALLBACK_SCORING_VERSION = "extension_fallback_weighted_v1";
const MAX_ANALYZE_TEXT_CHARS = 6000;
const POLICY_DEFAULTS = {
    // GDPR strict defaults: do not rely on local fallback path.
    allowLocalFallback: false,
    strictServerOnly: true,
    disableHardBlock: false
};
const latestScanByTab = new Map();

function bootstrapPolicyDefaults(force = false) {
    chrome.storage.sync.get(
        ["allowLocalFallback", "strictServerOnly", "disableHardBlock"],
        (items) => {
            const updates = {};

            if (force || typeof items.allowLocalFallback !== "boolean") {
                updates.allowLocalFallback = POLICY_DEFAULTS.allowLocalFallback;
            }
            if (force || typeof items.strictServerOnly !== "boolean") {
                updates.strictServerOnly = POLICY_DEFAULTS.strictServerOnly;
            }
            if (force || typeof items.disableHardBlock !== "boolean") {
                updates.disableHardBlock = POLICY_DEFAULTS.disableHardBlock;
            }

            if (Object.keys(updates).length > 0) {
                chrome.storage.sync.set(updates);
            }
        }
    );
}

bootstrapPolicyDefaults();

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

function pemToArrayBuffer(pem) {
    const clean = pem.replace(/-----BEGIN PUBLIC KEY-----/g, "")
        .replace(/-----END PUBLIC KEY-----/g, "")
        .replace(/\s+/g, "");
    return base64ToArrayBuffer(clean);
}

async function importRsaPublicKey(pem) {
    const keyData = pemToArrayBuffer(pem);
    return crypto.subtle.importKey(
        "spki",
        keyData,
        { name: "RSA-OAEP", hash: "SHA-256" },
        false,
        ["encrypt"]
    );
}

async function hashTextSha256(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function encryptDeepScanText(text, publicKeyPem) {
    const encoder = new TextEncoder();
    const payload = encoder.encode(text);
    const aesKey = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        aesKey,
        payload
    );
    const rawKey = await crypto.subtle.exportKey("raw", aesKey);
    const publicKey = await importRsaPublicKey(publicKeyPem);
    const wrappedKey = await crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        publicKey,
        rawKey
    );

    payload.fill(0);

    return {
        iv: arrayBufferToBase64(iv.buffer),
        ciphertext: arrayBufferToBase64(ciphertext),
        wrappedKey: arrayBufferToBase64(wrappedKey),
        alg: "AES-GCM",
        keyAlg: "RSA-OAEP-256"
    };
}

const SUSPICIOUS_KEYWORDS = {
    urgency: ["immediately", "urgent", "24 hours", "suspend", "close account", "lock", "restricted"],
    action: ["verify", "login", "click here", "update", "confirm"],
    generic: ["dear customer", "dear user", "valued customer"]
};

function clampScore(value) {
    if (typeof value !== "number" || Number.isNaN(value)) return 0;
    return Math.max(0, Math.min(value, 1));
}

function getRiskLevel(score) {
    if (score < RISK_THRESHOLDS.low) return "safe";
    if (score < RISK_THRESHOLDS.medium) return "low";
    if (score < RISK_THRESHOLDS.high) return "medium";
    if (score < RISK_THRESHOLDS.critical) return "high";
    return "critical";
}

function isPhishingScore(score) {
    return score >= RISK_THRESHOLDS.high;
}

function classifyAttackType(text) {
    const normalized = (text || "").toLowerCase();
    const rules = [
        { type: "CEO Fraud", keywords: ["ceo", "cfo", "director", "executive", "urgent request", "wire transfer", "gift card", "payment approval", "director general", "transfer bancar", "plata urgenta"] },
        { type: "Credential Harvesting", keywords: ["login", "sign in", "password", "verify", "account", "confirm", "reset", "autentificare", "parola", "verifica", "cont"] },
        { type: "Invoice/Payment", keywords: ["invoice", "payment", "bank", "iban", "swift", "ach", "factura", "plata", "transfer", "remittance"] },
        { type: "Account Suspension", keywords: ["suspend", "locked", "disabled", "deactivate", "account limited", "suspendat", "blocat", "dezactivat"] },
        { type: "Delivery/Logistics", keywords: ["delivery", "package", "shipment", "tracking", "dhl", "fedex", "ups", "livrare", "colet"] }
    ];

    for (const rule of rules) {
        if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
            return rule.type;
        }
    }

    return "Other";
}

function scoreTextHeuristic(text) {
    const lowerText = (text || "").toLowerCase();
    let score = 0;

    if (lowerText.includes("microsoft") && lowerText.includes("@gmail.com")) {
        score += 0.35;
    }

    SUSPICIOUS_KEYWORDS.urgency.forEach((word) => {
        if (lowerText.includes(word)) score += 0.08;
    });
    SUSPICIOUS_KEYWORDS.action.forEach((word) => {
        if (lowerText.includes(word)) score += 0.05;
    });
    SUSPICIOUS_KEYWORDS.generic.forEach((word) => {
        if (lowerText.includes(word)) score += 0.1;
    });

    return clampScore(score);
}

function scoreUrlHeuristic(url) {
    if (!url) return 0;

    let score = 0;
    const raw = String(url).toLowerCase();
    if (raw.includes("@")) score += 0.35;

    try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        const path = parsed.pathname.toLowerCase();

        if (parsed.protocol !== "https:") score += 0.2;
        if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) score += 0.35;

        const highRiskTlds = [".tk", ".ml", ".ga", ".cf", ".gq"];
        const suspiciousTlds = [".xyz", ".top", ".work", ".click", ".loan"];
        if (highRiskTlds.some((tld) => host.endsWith(tld))) score += 0.35;
        else if (suspiciousTlds.some((tld) => host.endsWith(tld))) score += 0.2;

        if (host.split(".").length > 4) score += 0.1;

        const phishingKeywords = ["verify", "account", "update", "secure", "login", "signin", "confirm", "suspended", "urgent"];
        const hostHits = phishingKeywords.filter((keyword) => host.includes(keyword)).length;
        const pathHits = phishingKeywords.filter((keyword) => path.includes(keyword)).length;
        score += Math.min((hostHits * 0.07) + (pathHits * 0.04), 0.25);
    } catch (_error) {
        score += 0.4;
    }

    return clampScore(score);
}

function computeWeightedScore(textScore, urlScore, heuristicScore, hasText, hasUrl) {
    const components = [];
    if (hasText) components.push({ score: textScore, weight: 0.45 });
    if (hasUrl) components.push({ score: urlScore, weight: 0.45 });
    if (hasText || hasUrl) components.push({ score: heuristicScore, weight: 0.1 });

    if (components.length === 0) return 0;
    const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
    const weighted = components.reduce((sum, c) => sum + (c.score * c.weight), 0);
    return clampScore(weighted / totalWeight);
}

function runFallbackAnalysis(text, url) {
    const textScore = scoreTextHeuristic(text);
    const urlScore = scoreUrlHeuristic(url);
    const heuristicScore = clampScore((textScore + urlScore) / 2);
    const overallScore = computeWeightedScore(textScore, urlScore, heuristicScore, Boolean(text), Boolean(url));
    const riskLevel = getRiskLevel(overallScore);
    const isPhishing = isPhishingScore(overallScore);

    return {
        textScore,
        urlScore,
        heuristicScore,
        overallScore,
        riskLevel,
        isPhishing,
        confidence: 0.6,
        detectedThreats: ["fallback_heuristics", `scoring_version:${FALLBACK_SCORING_VERSION}`],
        analysis: "Local fallback heuristics used because API analysis was unavailable.",
        scoringVersion: FALLBACK_SCORING_VERSION,
        scoreBreakdown: {
            textHeuristicScore: textScore,
            urlHeuristicScore: urlScore,
            weightedScore: overallScore
        },
        modelVersions: {
            textModel: null,
            urlModel: null,
            safeBrowsingHit: false
        },
        origin: "fallback_local"
    };
}

async function analyzeViaApi(request, authToken) {
    const { apiUrl, analyzePayloadPublicKey, deepScanPublicKey } = await chrome.storage.sync.get({
        apiUrl: "http://localhost:3001",
        analyzePayloadPublicKey: null,
        deepScanPublicKey: null
    });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ANALYZE_TIMEOUT_MS);
    const sanitizedText = typeof request.text === "string"
        ? request.text.slice(0, MAX_ANALYZE_TEXT_CHARS)
        : "";
    const payloadPublicKey = analyzePayloadPublicKey || deepScanPublicKey || null;

    try {
        const requestBody = {
            url: request.url,
            source: "extension"
        };

        if (sanitizedText) {
            if (payloadPublicKey) {
                try {
                    const textHash = await hashTextSha256(sanitizedText);
                    const encryptedPayload = await encryptDeepScanText(sanitizedText, payloadPublicKey);
                    requestBody.payloadEncoding = "rsa_oaep_aes_gcm_v1";
                    requestBody.textHash = textHash;
                    requestBody.encryptedPayload = encryptedPayload;
                } catch (encryptError) {
                    console.warn("PhishGuard: analyze payload encryption failed, falling back to plaintext.", encryptError);
                    requestBody.payloadEncoding = "plaintext_fallback";
                    requestBody.textContent = sanitizedText;
                }
            } else {
                requestBody.textContent = sanitizedText;
            }
        }

        const response = await fetch(`${apiUrl}/api/v1/analyze`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.success) {
            const err = new Error(payload?.error || `API_ANALYZE_FAILED_${response.status}`);
            err.status = response.status;
            throw err;
        }

        const data = payload.data || {};
        const textScore = clampScore(data.textScore || 0);
        const urlScore = clampScore(data.urlScore || 0);
        const heuristicScore = clampScore(
            ((data?.scoreBreakdown?.textHeuristicScore || 0) +
            (data?.scoreBreakdown?.urlHeuristicScore || 0)) / 2
        );
        const overallScore = clampScore(
            typeof data.overallScore === "number"
                ? data.overallScore
                : Math.max(textScore, urlScore, heuristicScore)
        );
        const riskLevel = typeof data.riskLevel === "string" ? data.riskLevel : getRiskLevel(overallScore);
        const isPhishing = typeof data.isPhishing === "boolean" ? data.isPhishing : isPhishingScore(overallScore);

        return {
            textScore,
            urlScore,
            heuristicScore,
            overallScore,
            riskLevel,
            isPhishing,
            confidence: clampScore(data.confidence || 0.75),
            detectedThreats: Array.isArray(data.detectedThreats) ? data.detectedThreats : [],
            analysis: typeof data.analysis === "string" ? data.analysis : "",
            scoringVersion: typeof data.scoringVersion === "string" ? data.scoringVersion : "weighted_v1",
            scoreBreakdown: data.scoreBreakdown || null,
            modelVersions: data.modelVersions || null,
            policyDecision: data.policyDecision || null,
            retentionPolicy: data.retentionPolicy || null,
            scanId: data.scanId || null,
            origin: "server"
        };
    } finally {
        clearTimeout(timeoutId);
    }
}

async function logIncident(data) {
    try {
        const { apiUrl, authToken } = await chrome.storage.sync.get({
            apiUrl: "http://localhost:3001",
            authToken: null
        });

        if (!authToken) return;

        await fetch(`${apiUrl}/api/v1/incidents`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify({
                url: data.url,
                textScore: data.textScore,
                urlScore: data.urlScore,
                heuristicScore: data.heuristicScore,
                overallScore: data.overallScore,
                attackType: data.attackType,
                timestamp: new Date().toISOString(),
                source: data.source || "extension"
            })
        });
    } catch (e) {
        console.error("Failed to log incident:", e);
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scan_page") {
        chrome.storage.sync.get(["authToken", "apiToken", "userPlan", "userRole", "scansRemaining"], async (items) => {
            const { userPlan, userRole, scansRemaining } = items;
            const authToken = items.apiToken || items.authToken;

            if (!authToken) {
                if (request.source === "auto") sendResponse({ error: "SILENT_FAIL" });
                else sendResponse({ error: "UNAUTHORIZED" });
                return;
            }

            if (userRole === "admin" || userRole === "super_admin") {
                processScan(request, sender, sendResponse, undefined, authToken);
                return;
            }

            if (userPlan === "free") {
                if (scansRemaining <= 0) {
                    if (request.source === "auto") sendResponse({ error: "SILENT_FAIL" });
                    else sendResponse({ error: "LIMIT_REACHED" });
                    return;
                }

                const newRemaining = scansRemaining - 1;
                await chrome.storage.sync.set({ scansRemaining: newRemaining });
                processScan(request, sender, sendResponse, newRemaining, authToken);
            } else {
                processScan(request, sender, sendResponse, undefined, authToken);
            }
        });

        return true;
    }

    if (request.action === "deep_scan") {
        chrome.storage.sync.get(["authToken", "apiToken", "userPlan", "userRole", "deepScanPublicKey"], async (items) => {
            const { userPlan } = items;
            const authToken = items.apiToken || items.authToken;
            const deepScanPublicKey = items.deepScanPublicKey;

            if (!authToken) {
                sendResponse({ error: "UNAUTHORIZED" });
                return;
            }

            if (!userPlan || userPlan === "free" || userPlan === "team_free") {
                sendResponse({ error: "PAYWALL" });
                return;
            }

            if (!request.text && !request.url) {
                sendResponse({ error: "EMPTY_INPUT" });
                return;
            }

            try {
                if (!deepScanPublicKey) {
                    sendResponse({ error: "NO_PUBLIC_KEY" });
                    return;
                }

                const truncatedText = String(request.text || "").slice(0, DEEP_SCAN_MAX_CHARS);
                const textHash = await hashTextSha256(truncatedText);
                const encryptedPayload = await encryptDeepScanText(truncatedText, deepScanPublicKey);
                const { apiUrl } = await chrome.storage.sync.get({ apiUrl: "http://localhost:3001" });

                const response = await fetch(`${apiUrl}/api/v1/deep-scan`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${authToken}`
                    },
                    body: JSON.stringify({
                        url: request.url,
                        textHash,
                        encryptedPayload
                    })
                });

                const data = await response.json();
                if (!response.ok || !data?.success) {
                    sendResponse({ error: data?.error || "ANALYZE_FAILED" });
                    return;
                }

                sendResponse({ success: true, data: data.data });
            } catch (e) {
                console.error("Deep scan failed:", e);
                sendResponse({ error: "NETWORK_ERROR" });
            }
        });
        return true;
    }

    if (request.action === "scan_feedback") {
        chrome.storage.sync.get(["authToken", "apiToken", "userRole"], async (items) => {
            const authToken = items.apiToken || items.authToken;
            if (!authToken) {
                sendResponse({ error: "UNAUTHORIZED" });
                return;
            }
            const trustLevel = (items.userRole === "admin" || items.userRole === "super_admin")
                ? "analyst"
                : "user";

            const tabId = sender?.tab?.id;
            const scanId = tabId !== undefined ? latestScanByTab.get(tabId) : null;
            if (!scanId) {
                sendResponse({ error: "NO_SCAN_CONTEXT" });
                return;
            }

            const label = typeof request.label === "string" ? request.label.toLowerCase() : "";
            if (!["safe", "phishing", "unsure"].includes(label)) {
                sendResponse({ error: "INVALID_LABEL" });
                return;
            }

            try {
                const { apiUrl } = await chrome.storage.sync.get({ apiUrl: "http://localhost:3001" });
                const response = await fetch(`${apiUrl}/api/v1/scans/${scanId}/feedback`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${authToken}`
                    },
                    body: JSON.stringify({
                        label,
                        note: typeof request.note === "string" ? request.note.slice(0, 400) : "",
                        trustLevel
                    })
                });

                const data = await response.json().catch(() => ({}));
                if (!response.ok || !data?.success) {
                    sendResponse({ error: data?.error || "FEEDBACK_FAILED" });
                    return;
                }

                sendResponse({ success: true, data: data.data });
            } catch (e) {
                console.error("Failed to save scan feedback:", e);
                sendResponse({ error: "NETWORK_ERROR" });
            }
        });
        return true;
    }

    if (request.action === "user_action_click_suspicious_link") {
        chrome.storage.sync.get(["authToken", "apiToken", "userRole"], async (items) => {
            const authToken = items.apiToken || items.authToken;
            if (!authToken) return;
            const trustLevel = (items.userRole === "admin" || items.userRole === "super_admin")
                ? "analyst"
                : "user";
            const { apiUrl } = await chrome.storage.sync.get({ apiUrl: "http://localhost:3001" });
            const tabId = sender?.tab?.id;
            const scanId = tabId !== undefined ? latestScanByTab.get(tabId) : null;

            try {
                if (scanId) {
                    await fetch(`${apiUrl}/api/v1/scans/${scanId}/feedback`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${authToken}`
                        },
                        body: JSON.stringify({
                            label: "phishing",
                            note: `Clicked suspicious link: ${request.link || "unknown"}`,
                            trustLevel
                        })
                    });
                }
            } catch (e) {
                console.error("Failed to log user action:", e);
            }
        });
        return;
    }
});

async function processScan(request, sender, sendResponse, remainingScans, authToken) {
    const start = performance.now();
    const policySettings = await chrome.storage.sync.get(POLICY_DEFAULTS);
    const allowLocalFallback = Boolean(policySettings.allowLocalFallback) && !Boolean(policySettings.strictServerOnly);

    try {
        let result;
        try {
            result = await analyzeViaApi(request, authToken);
        } catch (error) {
            if (error?.status === 401) {
                sendResponse({ error: "UNAUTHORIZED" });
                return;
            }
            if (!allowLocalFallback) {
                const unavailableError = request.source === "auto" ? "SILENT_FAIL" : "ANALYZE_UNAVAILABLE";
                sendResponse({ error: unavailableError });
                return;
            }
            console.warn("PhishGuard: API analyze unavailable, using fallback heuristics.", error);
            result = runFallbackAnalysis(request.text, request.url);
        }

        const durationMs = performance.now() - start;
        const finalScore = clampScore(result.overallScore);
        const riskLevel = result.riskLevel || getRiskLevel(finalScore);
        const isPhish = typeof result.isPhishing === "boolean" ? result.isPhishing : isPhishingScore(finalScore);
        const backendPolicy = result?.policyDecision && typeof result.policyDecision === "object"
            ? result.policyDecision
            : null;
        const hardBlockByPolicy = Boolean(backendPolicy?.action === "block");
        const hardBlockEnabled = !Boolean(policySettings.disableHardBlock);
        const hardBlockApplied = hardBlockByPolicy && hardBlockEnabled;
        const attackType = classifyAttackType(request.text || "");

        if (durationMs > 350) {
            console.warn(`PhishGuard: scan exceeded 350ms (${durationMs.toFixed(0)}ms)`);
        }

        if (sender?.tab?.id !== undefined) {
            if (typeof result.scanId === "string" && result.scanId.length > 0) {
                latestScanByTab.set(sender.tab.id, result.scanId);
            }

            let badgeText = "SAFE";
            let badgeColor = "#22C55E";

            if (hardBlockApplied) {
                badgeText = "BLOCK";
                badgeColor = "#7F1D1D";
            } else if (riskLevel === "medium") {
                badgeText = "RISK";
                badgeColor = "#F59E0B";
            } else if (riskLevel === "high" || riskLevel === "critical") {
                badgeText = "WARN";
                badgeColor = "#DC2626";
            }

            chrome.action.setBadgeText({ text: badgeText, tabId: sender.tab.id });
            chrome.action.setBadgeBackgroundColor({ color: badgeColor, tabId: sender.tab.id });
        }

        // Only log incidents from local fallback path to avoid duplicate DB rows.
        if (result.origin === "fallback_local") {
            logIncident({
                url: request.url,
                textScore: result.textScore,
                urlScore: result.urlScore,
                heuristicScore: result.heuristicScore,
                overallScore: finalScore,
                attackType,
                source: "extension_fallback"
            });
        }

        if (isPhish || hardBlockApplied) {
            chrome.notifications.create({
                type: "basic",
                iconUrl: "assets/logo-128.png",
                title: hardBlockApplied ? "Threat blocked by policy" : "Phishing detected",
                message: `PhishGuard detected a threat in this email.\nRisk score: ${(finalScore * 100).toFixed(0)}%`,
                priority: 2
            });
        }

        const effectivePolicyDecision = hardBlockApplied
            ? backendPolicy
            : (hardBlockByPolicy && !hardBlockEnabled)
                ? { action: "warn", reason: "hard_block_disabled_locally", hardBlock: false }
                : backendPolicy;

        sendResponse({
            ...result,
            overallScore: finalScore,
            riskLevel,
            attackType,
            hardBlockApplied,
            policyDecision: effectivePolicyDecision,
            durationMs,
            scansRemaining: remainingScans
        });
    } catch (error) {
        console.error("PhishGuard: scan processing failed", error);
        sendResponse({ error: "ANALYZE_FAILED" });
    }
}

function handleAuthHandoff(request, sender, sendResponse) {
    if (request.action === "LOGOUT") {
        const keys = ["authToken", "apiToken", "userPlan", "scansRemaining", "deepScanPublicKey", "analyzePayloadPublicKey"];
        latestScanByTab.clear();

        chrome.storage.sync.remove(keys, () => {});
        chrome.storage.local.remove(keys, () => {
            sendResponse({ success: true });
        });

        chrome.action.setBadgeText({ text: "" });
        return true;
    }

    if (request.action === "AUTH_HANDOFF") {
        const { token, user, subscription, deepScanPublicKey, analyzePayloadPublicKey } = request;
        const data = {
            authToken: token,
            apiToken: token,
            userPlan: user.plan || "free",
            userRole: user.role || "user",
            scansRemaining: subscription ? subscription.scansRemaining : 10,
            deepScanPublicKey: deepScanPublicKey || null,
            analyzePayloadPublicKey: analyzePayloadPublicKey || deepScanPublicKey || null
        };

        chrome.storage.sync.set(data);
        chrome.storage.local.set(data, () => {
            sendResponse({ success: true });
        });

        return true;
    }
}

chrome.runtime.onMessageExternal.addListener(handleAuthHandoff);
chrome.runtime.onMessage.addListener(handleAuthHandoff);

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install" || details.reason === "update") {
        latestScanByTab.clear();
        const keys = ["authToken", "apiToken", "userPlan", "userRole", "scansRemaining", "apiUrl", "deepScanPublicKey", "analyzePayloadPublicKey"];
        chrome.storage.local.remove(keys);
        chrome.storage.sync.remove(keys);
        // Re-apply strict defaults after auth/runtime keys are reset.
        bootstrapPolicyDefaults(true);
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    latestScanByTab.delete(tabId);
});
