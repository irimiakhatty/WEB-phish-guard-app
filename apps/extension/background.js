// --- CONFIGURATION ---
// Default to the deployed app so sign-in works even when local dev is offline.
const DEFAULT_API_URL = "https://phish-guard-rho.vercel.app";

const RISK_THRESHOLDS = {
    low: 0.2,
    medium: 0.4,
    high: 0.6,
    critical: 0.8
};

const DEEP_SCAN_MAX_CHARS = 5000;
const ANALYZE_TIMEOUT_MS = 7000;
const SCAN_KEEPALIVE_MS = 20000;
const FALLBACK_SCORING_VERSION = "extension_fallback_weighted_v1";
const MAX_ANALYZE_TEXT_CHARS = 6000;
const POLICY_DEFAULTS = {
    // GDPR strict defaults: do not rely on local fallback path.
    allowLocalFallback: false,
    strictServerOnly: true,
    disableHardBlock: false
};
const latestScanByTab = new Map();
const inboxScanCache = new Map();
const INBOX_SCAN_CACHE_MAX = 40;
let scanKeepAliveTimer = null;

function getInboxScanCache(contentHash) {
    return inboxScanCache.get(String(contentHash)) || null;
}

function setInboxScanCache(contentHash, result) {
    const key = String(contentHash);
    inboxScanCache.set(key, result);
    if (inboxScanCache.size > INBOX_SCAN_CACHE_MAX) {
        const oldest = inboxScanCache.keys().next().value;
        if (oldest !== undefined) {
            inboxScanCache.delete(oldest);
        }
    }
}

function startScanKeepAlive() {
    stopScanKeepAlive();
    scanKeepAliveTimer = setInterval(() => {
        chrome.runtime.getPlatformInfo(() => {});
    }, SCAN_KEEPALIVE_MS);
}

function stopScanKeepAlive() {
    if (scanKeepAliveTimer) {
        clearInterval(scanKeepAliveTimer);
        scanKeepAliveTimer = null;
    }
}

function setExtensionTabBadge(tabId, { riskLevel, hardBlockApplied, state }) {
    if (typeof tabId !== "number") {
        return;
    }

    let badgeText = "";
    let badgeColor = "#6e7681";

    if (state === "pending") {
        badgeText = "...";
        badgeColor = "#58a6ff";
    } else if (state === "error") {
        badgeText = "!";
        badgeColor = "#6e7681";
    } else if (hardBlockApplied) {
        badgeText = "BLOCK";
        badgeColor = "#da3633";
    } else if (riskLevel === "medium") {
        badgeText = "RISK";
        badgeColor = "#d29922";
    } else if (riskLevel === "high" || riskLevel === "critical") {
        badgeText = "WARN";
        badgeColor = "#f85149";
    } else if (riskLevel === "low") {
        badgeText = "LOW";
        badgeColor = "#58a6ff";
    } else {
        badgeText = "SAFE";
        badgeColor = "#3fb950";
    }

    chrome.action.setBadgeText({ text: badgeText, tabId });
    chrome.action.setBadgeBackgroundColor({ color: badgeColor, tabId });
}

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

const AUTH_STORAGE_KEYS = [
    "authToken",
    "apiToken",
    "userPlan",
    "subscriptionStatus",
    "userRole",
    "userName",
    "userEmail",
    "planName",
    "subscriptionType",
    "scansRemaining",
    "scansUsed",
    "scansLimit",
    "organizationName",
    "organizationSlug",
    "workspaceType",
    "extensionAccount",
    "recentScans",
    "lastContextSyncAt",
    "deepScanPublicKey",
    "analyzePayloadPublicKey"
];

function isAdminRole(role) {
    return role === "admin" || role === "super_admin";
}

function isLimitedPlan(planId, role) {
    return !isAdminRole(role) && (!planId || planId === "free" || planId === "team_free");
}

function normalizeRecentScans(items) {
    if (!Array.isArray(items)) {
        return [];
    }

    return items
        .filter((item) => item && typeof item === "object")
        .slice(0, 5)
        .map((item) => ({
            id: typeof item.id === "string" ? item.id : "scan-" + Date.now(),
            url: typeof item.url === "string" ? item.url : null,
            riskLevel: typeof item.riskLevel === "string" ? item.riskLevel : "safe",
            overallScore: typeof item.overallScore === "number" ? item.overallScore : 0,
            isPhishing: Boolean(item.isPhishing),
            source: typeof item.source === "string" ? item.source : null,
            createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString()
        }));
}

function buildLegacyContextFromRequest(request) {
    const planId = request?.subscription?.planId || request?.user?.plan || "free";
    const scansRemaining = typeof request?.subscription?.scansRemaining === "number"
        ? request.subscription.scansRemaining
        : typeof request?.subscription?.limit === "number"
            ? request.subscription.limit
            : 0;
    const scansLimit = typeof request?.subscription?.scansLimit === "number"
        ? request.subscription.scansLimit
        : typeof request?.subscription?.limit === "number"
            ? request.subscription.limit
            : 0;
    const derivedSubscriptionType = request?.subscription?.subscriptionType
        || (planId.startsWith("team_") ? "team" : planId === "free" ? "none" : "personal");

    return {
        user: {
            id: request?.user?.id || "",
            email: request?.user?.email || "",
            name: request?.user?.name || request?.user?.email || "",
            role: request?.user?.role || "user"
        },
        account: request?.account || {
            workspaceType: derivedSubscriptionType === "team" ? "organization" : "personal",
            organizationId: null,
            organizationName: null,
            organizationSlug: null,
            isOrgAdmin: false
        },
        subscription: {
            subscriptionType: derivedSubscriptionType,
            planId,
            planName: request?.subscription?.planName || planId.replace(/_/g, " "),
            status: request?.subscription?.status || null,
            isPaid: !["free", "team_free"].includes(planId),
            usageScope: request?.subscription?.usageScope
                || (request?.account?.workspaceType === "organization" ? "organization" : "personal"),
            scansUsed: typeof request?.subscription?.scansUsed === "number"
                ? request.subscription.scansUsed
                : Math.max(0, scansLimit - scansRemaining),
            scansRemaining,
            scansLimit,
            currentPeriodEnd: request?.subscription?.currentPeriodEnd || null,
            cancelAtPeriodEnd: Boolean(request?.subscription?.cancelAtPeriodEnd),
            maxApiTokens: typeof request?.subscription?.maxApiTokens === "number"
                ? request.subscription.maxApiTokens
                : 0,
            advancedAnalytics: Boolean(request?.subscription?.advancedAnalytics),
            apiAccess: request?.subscription?.apiAccess !== false
        },
        activity: request?.activity || {
            scansThisMonth: 0,
            threatsThisMonth: 0,
            safeScansThisMonth: 0
        },
        recentScans: normalizeRecentScans(request?.recentScans),
        keys: request?.keys || {
            deepScanPublicKey: request?.deepScanPublicKey || null,
            analyzePayloadPublicKey: request?.analyzePayloadPublicKey || request?.deepScanPublicKey || null
        }
    };
}

function buildStoredAuthState(token, context) {
    const safeContext = context && typeof context === "object"
        ? context
        : buildLegacyContextFromRequest({ user: { plan: "free" } });
    const recentScans = normalizeRecentScans(safeContext.recentScans);

    return {
        authToken: token,
        apiToken: token,
        userPlan: safeContext.subscription?.planId || "free",
        subscriptionStatus: safeContext.subscription?.status || null,
        userRole: safeContext.user?.role || "user",
        userName: safeContext.user?.name || safeContext.user?.email || "",
        userEmail: safeContext.user?.email || "",
        planName: safeContext.subscription?.planName || "Free",
        subscriptionType: safeContext.subscription?.subscriptionType || "none",
        scansRemaining: typeof safeContext.subscription?.scansRemaining === "number"
            ? safeContext.subscription.scansRemaining
            : 0,
        scansUsed: typeof safeContext.subscription?.scansUsed === "number"
            ? safeContext.subscription.scansUsed
            : 0,
        scansLimit: typeof safeContext.subscription?.scansLimit === "number"
            ? safeContext.subscription.scansLimit
            : 0,
        organizationName: safeContext.account?.organizationName || null,
        organizationSlug: safeContext.account?.organizationSlug || null,
        workspaceType: safeContext.account?.workspaceType || "personal",
        extensionAccount: {
            user: safeContext.user || null,
            account: safeContext.account || null,
            subscription: safeContext.subscription || null,
            activity: safeContext.activity || null,
            recentScans
        },
        recentScans,
        lastContextSyncAt: new Date().toISOString(),
        deepScanPublicKey: safeContext.keys?.deepScanPublicKey || null,
        analyzePayloadPublicKey:
            safeContext.keys?.analyzePayloadPublicKey || safeContext.keys?.deepScanPublicKey || null
    };
}

function getSyncStoragePayload(state) {
    return {
        authToken: state.authToken,
        apiToken: state.apiToken,
        userPlan: state.userPlan,
        subscriptionStatus: state.subscriptionStatus,
        userRole: state.userRole,
        userName: state.userName,
        userEmail: state.userEmail,
        planName: state.planName,
        subscriptionType: state.subscriptionType,
        scansRemaining: state.scansRemaining,
        scansUsed: state.scansUsed,
        scansLimit: state.scansLimit,
        organizationName: state.organizationName,
        organizationSlug: state.organizationSlug,
        workspaceType: state.workspaceType,
        lastContextSyncAt: state.lastContextSyncAt,
        deepScanPublicKey: state.deepScanPublicKey,
        analyzePayloadPublicKey: state.analyzePayloadPublicKey
    };
}

async function writeAuthState(token, context) {
    const state = buildStoredAuthState(token, context);
    await chrome.storage.sync.set(getSyncStoragePayload(state));
    await chrome.storage.local.set(state);
    return state;
}

async function getStoredRuntimeSettings() {
    const syncState = await chrome.storage.sync.get({
        apiUrl: DEFAULT_API_URL,
        authToken: null,
        apiToken: null
    });
    const localState = await chrome.storage.local.get({
        authToken: null,
        apiToken: null
    });

    return {
        apiUrl: syncState.apiUrl || DEFAULT_API_URL,
        authToken: syncState.authToken || localState.authToken || null,
        apiToken: syncState.apiToken || localState.apiToken || null
    };
}

async function fetchExtensionContext(authToken, apiUrl) {
    const response = await fetch(apiUrl + "/api/v1/extension/context", {
        method: "GET",
        headers: {
            "Authorization": "Bearer " + authToken
        }
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.success || !payload?.data) {
        const error = new Error(payload?.error || ("CONTEXT_FETCH_FAILED_" + response.status));
        error.status = response.status;
        throw error;
    }

    return payload.data;
}

async function refreshExtensionContext(explicitToken) {
    const settings = await getStoredRuntimeSettings();
    const authToken = explicitToken || settings.apiToken || settings.authToken;

    if (!authToken) {
        return null;
    }

    const context = await fetchExtensionContext(authToken, settings.apiUrl);
    return writeAuthState(authToken, context);
}

function buildRecentScanSnapshot(result, request) {
    return {
        id: typeof result?.scanId === "string" && result.scanId.length > 0
            ? result.scanId
            : "scan-" + Date.now(),
        url: typeof request?.url === "string" ? request.url : null,
        riskLevel: typeof result?.riskLevel === "string" ? result.riskLevel : "safe",
        overallScore: typeof result?.overallScore === "number" ? result.overallScore : 0,
        isPhishing: Boolean(result?.isPhishing),
        source: "extension",
        createdAt: new Date().toISOString()
    };
}

async function storeRecentScanSnapshot(result, request, remainingScans) {
    const snapshot = buildRecentScanSnapshot(result, request);
    const localState = await chrome.storage.local.get({
        extensionAccount: null,
        recentScans: []
    });
    const recentScans = normalizeRecentScans([
        snapshot,
        ...(Array.isArray(localState.recentScans) ? localState.recentScans : [])
    ]);
    const nextAccount = localState.extensionAccount && typeof localState.extensionAccount === "object"
        ? { ...localState.extensionAccount }
        : null;

    if (nextAccount?.activity) {
        nextAccount.activity = {
            ...nextAccount.activity,
            scansThisMonth: Number(nextAccount.activity.scansThisMonth || 0) + 1,
            threatsThisMonth: Number(nextAccount.activity.threatsThisMonth || 0) + (result?.isPhishing ? 1 : 0)
        };
        nextAccount.activity.safeScansThisMonth = Math.max(
            0,
            Number(nextAccount.activity.scansThisMonth || 0) - Number(nextAccount.activity.threatsThisMonth || 0)
        );
    }

    if (nextAccount?.subscription) {
        nextAccount.subscription = {
            ...nextAccount.subscription,
            scansUsed: Number(nextAccount.subscription.scansUsed || 0),
            scansRemaining: Number(nextAccount.subscription.scansRemaining || 0),
            scansLimit: Number(nextAccount.subscription.scansLimit || 0)
        };

        if (typeof remainingScans === "number") {
            nextAccount.subscription.scansRemaining = remainingScans;
            if (Number.isFinite(nextAccount.subscription.scansLimit)) {
                nextAccount.subscription.scansUsed = Math.max(
                    0,
                    nextAccount.subscription.scansLimit - remainingScans
                );
            }
        } else {
            nextAccount.subscription.scansUsed += 1;
            if (Number.isFinite(nextAccount.subscription.scansLimit) && nextAccount.subscription.scansLimit > 0) {
                nextAccount.subscription.scansRemaining = Math.max(
                    0,
                    nextAccount.subscription.scansLimit - nextAccount.subscription.scansUsed
                );
            }
        }
    }

    if (nextAccount) {
        nextAccount.recentScans = recentScans;
    }

    await chrome.storage.local.set({
        recentScans,
        extensionAccount: nextAccount || localState.extensionAccount || null
    });

    const syncUpdates = {};
    if (typeof remainingScans === "number") {
        syncUpdates.scansRemaining = remainingScans;
    }
    if (nextAccount?.subscription) {
        if (typeof nextAccount.subscription.scansUsed === "number") {
            syncUpdates.scansUsed = nextAccount.subscription.scansUsed;
        }
        if (typeof nextAccount.subscription.scansRemaining === "number") {
            syncUpdates.scansRemaining = nextAccount.subscription.scansRemaining;
        }
        if (typeof nextAccount.subscription.scansLimit === "number") {
            syncUpdates.scansLimit = nextAccount.subscription.scansLimit;
        }
    }

    if (Object.keys(syncUpdates).length > 0) {
        await chrome.storage.sync.set(syncUpdates);
    }
}

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
        apiUrl: DEFAULT_API_URL,
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
            err.code = payload?.error || null;
            err.details = payload?.details || null;
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
            apiUrl: DEFAULT_API_URL,
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
    if (request.action === "GET_INBOX_SETTINGS") {
        (async () => {
            try {
                const state = await chrome.storage.sync.get({
                    autoScan: true,
                    userPlan: null,
                    subscriptionStatus: null,
                    userRole: "user",
                    scansRemaining: 0,
                    planName: "Free"
                });
                sendResponse(state);
            } catch (settingsError) {
                console.warn("PhishGuard: inbox settings read failed", settingsError);
                sendResponse({
                    autoScan: true,
                    userPlan: null,
                    subscriptionStatus: null,
                    userRole: "user",
                    scansRemaining: 0,
                    planName: "Free"
                });
            }
        })();
        return true;
    }

    if (request.action === "GET_SCAN_CACHE") {
        sendResponse({ result: getInboxScanCache(request.contentHash) });
        return true;
    }

    if (request.action === "SET_SCAN_CACHE") {
        setInboxScanCache(request.contentHash, request.result);
        sendResponse({ success: true });
        return true;
    }

    if (request.action === "scan_page") {
        let scanResponded = false;
        const finishScan = (payload) => {
            if (scanResponded) {
                return;
            }
            scanResponded = true;
            stopScanKeepAlive();
            try {
                sendResponse(payload);
            } catch (responseError) {
                console.warn("PhishGuard: scan response channel closed.", responseError);
            }
        };

        startScanKeepAlive();
        (async () => {
            try {
                const items = await chrome.storage.sync.get([
                    "authToken",
                    "apiToken",
                    "userPlan",
                    "userRole",
                    "scansRemaining"
                ]);
                const authToken = items.apiToken || items.authToken;

                if (!authToken) {
                    if (request.source === "auto" || request.source === "auto_confirmed") {
                        setExtensionTabBadge(sender.tab?.id, { state: "error" });
                        finishScan({ error: "UNAUTHORIZED" });
                    } else {
                        finishScan({ error: "UNAUTHORIZED" });
                    }
                    return;
                }

                if (request.source === "auto" || request.source === "auto_confirmed") {
                    setExtensionTabBadge(sender.tab?.id, { state: "pending" });
                }

                await processScan(request, sender, finishScan, items.scansRemaining, authToken);
            } catch (scanError) {
                console.error("PhishGuard: scan_page handler failed", scanError);
                finishScan({ error: "ANALYZE_FAILED" });
            }
        })();

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
                const { apiUrl } = await chrome.storage.sync.get({ apiUrl: DEFAULT_API_URL });

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
                const { apiUrl } = await chrome.storage.sync.get({ apiUrl: DEFAULT_API_URL });
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
            const { apiUrl } = await chrome.storage.sync.get({ apiUrl: DEFAULT_API_URL });
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
            if (error?.status === 429 || error?.code === "SCAN_LIMIT_REACHED") {
                sendResponse({
                    error: "LIMIT_REACHED",
                    scansRemaining:
                        typeof error?.details?.scansRemaining === "number"
                            ? error.details.scansRemaining
                            : typeof remainingScans === "number"
                                ? remainingScans
                                : 0,
                    subscriptionStatus: error?.details?.subscriptionStatus || null,
                    details: error?.details || null
                });
                refreshExtensionContext(authToken).catch((refreshError) => {
                    console.warn("PhishGuard: context refresh after limit hit failed", refreshError);
                });
                return;
            }
            if (!allowLocalFallback) {
                const isAutoSource = request.source === "auto" || request.source === "auto_confirmed";
                if (sender?.tab?.id !== undefined && isAutoSource) {
                    setExtensionTabBadge(sender.tab.id, { state: "error" });
                }
                sendResponse({
                    error: isAutoSource ? "AUTO_UNAVAILABLE" : "ANALYZE_UNAVAILABLE",
                    message: error?.message || "Server analysis unavailable"
                });
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

            setExtensionTabBadge(sender.tab.id, { riskLevel, hardBlockApplied });
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

        // FIX: Send verdict immediately — do NOT block on context refresh.
        // refreshExtensionContext() was previously awaited before sendResponse,
        // causing a second full server round-trip to delay the visible result.
        // Context sync is now fire-and-forget in the background.
        sendResponse({
            ...result,
            overallScore: finalScore,
            riskLevel,
            attackType,
            hardBlockApplied,
            policyDecision: effectivePolicyDecision,
            durationMs,
            scansRemaining: typeof remainingScans === "number" ? remainingScans : null
        });

        // Background sync — does not affect popup UX
        refreshExtensionContext(authToken).catch((refreshError) => {
            console.warn("PhishGuard: background context refresh failed.", refreshError);
            storeRecentScanSnapshot({
                scanId: result.scanId || null,
                overallScore: finalScore,
                riskLevel,
                isPhishing: isPhish
            }, request, remainingScans).catch((storageError) => {
                console.warn("PhishGuard: failed to persist recent scan snapshot.", storageError);
            });
        });
    } catch (error) {
        console.error("PhishGuard: scan processing failed", error);
        const isAutoSource = request.source === "auto" || request.source === "auto_confirmed";
        if (sender?.tab?.id !== undefined && isAutoSource) {
            setExtensionTabBadge(sender.tab.id, { state: "error" });
        }
        sendResponse({
            error: isAutoSource ? "AUTO_UNAVAILABLE" : "ANALYZE_FAILED",
            message: error?.message || "Scan failed"
        });
    }
}

function handleAuthHandoff(request, sender, sendResponse) {
    if (request.action === "LOGOUT") {
        latestScanByTab.clear();

        chrome.storage.sync.remove(AUTH_STORAGE_KEYS, () => {});
        chrome.storage.local.remove(AUTH_STORAGE_KEYS, () => {
            sendResponse({ success: true });
        });

        chrome.action.setBadgeText({ text: "" });
        return true;
    }

    if (request.action === "REFRESH_CONTEXT") {
        (async () => {
            try {
                const data = await refreshExtensionContext();
                if (!data) {
                    sendResponse({ success: false, error: "UNAUTHORIZED" });
                    return;
                }
                sendResponse({ success: true, data });
            } catch (error) {
                console.warn("PhishGuard: context refresh failed", error);
                sendResponse({ success: false, error: "CONTEXT_REFRESH_FAILED" });
            }
        })();
        return true;
    }

    if (request.action === "AUTH_HANDOFF") {
        (async () => {
            try {
                if (!request.token) {
                    sendResponse({ success: false, error: "MISSING_TOKEN" });
                    return;
                }

                const context = request.context || buildLegacyContextFromRequest(request);
                const initialState = await writeAuthState(request.token, context);

                try {
                    const refreshedState = await refreshExtensionContext(request.token);
                    sendResponse({ success: true, data: refreshedState || initialState });
                } catch (refreshError) {
                    console.warn("PhishGuard: auth handoff refresh failed, using initial payload.", refreshError);
                    sendResponse({ success: true, data: initialState });
                }
            } catch (error) {
                console.error("PhishGuard: auth handoff failed", error);
                sendResponse({ success: false, error: "AUTH_HANDOFF_FAILED" });
            }
        })();

        return true;
    }
}

chrome.runtime.onMessageExternal.addListener(handleAuthHandoff);
chrome.runtime.onMessage.addListener(handleAuthHandoff);

chrome.runtime.onInstalled.addListener((details) => {
    latestScanByTab.clear();
    inboxScanCache.clear();

    if (details.reason === "install") {
        const keys = [...AUTH_STORAGE_KEYS];
        chrome.storage.local.remove(keys);
        chrome.storage.sync.remove(keys);
    }

    // Keep the selected environment and auth state across reloads/updates.
    bootstrapPolicyDefaults(true);
    refreshExtensionContext().catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
    refreshExtensionContext().catch(() => {});
});

chrome.tabs.onRemoved.addListener((tabId) => {
    latestScanByTab.delete(tabId);
});
