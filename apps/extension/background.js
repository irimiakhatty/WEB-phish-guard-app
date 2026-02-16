importScripts('tf.min.js');

// --- CONFIGURATION ---
const TEXT_MAX_LEN = 150;
const URL_MAX_LEN = 150;
const TEXT_OOV = "<OOV>";
const URL_OOV = "<OOV>";
const RISK_THRESHOLDS = {
    low: 0.2,
    medium: 0.4,
    high: 0.6,
    critical: 0.8
};

const DEEP_SCAN_MAX_CHARS = 5000;

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

    // Best-effort wipe
    payload.fill(0);

    return {
        iv: arrayBufferToBase64(iv.buffer),
        ciphertext: arrayBufferToBase64(ciphertext),
        wrappedKey: arrayBufferToBase64(wrappedKey),
        alg: "AES-GCM",
        keyAlg: "RSA-OAEP-256"
    };
}

// Heuristic Keywords (Must match WebApp)
const SUSPICIOUS_KEYWORDS = {
    urgency: ["immediately", "urgent", "24 hours", "suspend", "close account", "lock", "restricted"],
    action: ["verify", "login", "click here", "update", "confirm"],
    generic: ["dear customer", "dear user", "valued customer"]
};

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

let textModel, urlModel;
let textVocab, urlVocab;
let isModelsLoaded = false;

// --- 1. LOAD RESOURCES ---
async function loadResources() {
    if (isModelsLoaded) return;

    console.log("Background: Loading models...");
    try {
        // Load Models
        textModel = await tf.loadLayersModel('assets/text_model/model.json');
        urlModel = await tf.loadLayersModel('assets/url_model/model.json');

        // Load Dictionaries
        const textVocabReq = await fetch('assets/word_index.json');
        textVocab = await textVocabReq.json();

        const urlVocabReq = await fetch('assets/url_char_index.json');
        urlVocab = await urlVocabReq.json();

        isModelsLoaded = true;
        console.log("Background: All resources loaded!");
    } catch (e) {
        console.error("Background: Error loading resources:", e);
    }
}

// --- 2. PRE-PROCESSING FUNCTIONS ---
function preprocessText(text) {
    const words = text.toLowerCase().replace(/[^\w\s]/gi, '').split(/\s+/);
    const sequence = words.map(w => textVocab[w] || textVocab[TEXT_OOV] || 1);

    const padded = new Array(TEXT_MAX_LEN).fill(0);
    for (let i = 0; i < Math.min(sequence.length, TEXT_MAX_LEN); i++) {
        padded[i] = sequence[i];
    }
    return tf.tensor2d([padded]);
}

function preprocessURL(url) {
    const chars = url.split('');
    const sequence = chars.map(c => urlVocab[c] || urlVocab[URL_OOV] || 1);

    const padded = new Array(URL_MAX_LEN).fill(0);
    for (let i = 0; i < Math.min(sequence.length, URL_MAX_LEN); i++) {
        padded[i] = sequence[i];
    }
    return tf.tensor2d([padded]);
}

// --- 3. PREDICTION LOGIC ---
async function predict(text, url) {
    await loadResources();

    let textScore = 0;
    let urlScore = 0;

    if (text) {
        const textTensor = preprocessText(text);
        const pred = textModel.predict(textTensor);
        textScore = (await pred.data())[0];
        textTensor.dispose();
    }

    if (url) {
        const urlTensor = preprocessURL(url);
        const pred = urlModel.predict(urlTensor);
        urlScore = (await pred.data())[0];
        urlTensor.dispose();
    }

    // 3. Heuristic Analysis
    let heuristicScore = 0;
    const lowerText = text ? text.toLowerCase() : "";

    // Provider Mismatch Check
    if (lowerText.includes("microsoft") && lowerText.includes("@gmail.com")) {
        heuristicScore += 0.4;
    }

    SUSPICIOUS_KEYWORDS.urgency.forEach(word => {
        if (lowerText.includes(word)) heuristicScore += 0.2;
    });
    SUSPICIOUS_KEYWORDS.action.forEach(word => {
        if (lowerText.includes(word)) heuristicScore += 0.1;
    });
    SUSPICIOUS_KEYWORDS.generic.forEach(word => {
        if (lowerText.includes(word)) heuristicScore += 0.15;
    });
    heuristicScore = Math.min(heuristicScore, 0.9);

    return { textScore, urlScore, heuristicScore };
}

// --- 4. MESSAGE HANDLING ---
async function logIncident(data) {
    try {
        // Retrieve API URL and token from storage
        const { apiUrl, authToken } = await chrome.storage.sync.get({ 
            apiUrl: 'http://localhost:3001',
            authToken: null 
        });

        // Skip if no auth token
        if (!authToken) {
            console.log("No auth token, skipping incident log");
            return;
        }

        const response = await fetch(`${apiUrl}/api/v1/incidents`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                url: data.url,
                textScore: data.textScore,
                urlScore: data.urlScore,
                heuristicScore: data.heuristicScore,
                overallScore: data.overallScore,
                attackType: data.attackType,
                timestamp: new Date().toISOString(),
                source: 'extension'
            })
        });
        console.log("Incident logged:", await response.json());
    } catch (e) {
        console.error("Failed to log incident:", e);
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scan_page") {

        // --- SUBSCRIPTION CHECK ---
        chrome.storage.sync.get(['authToken', 'apiToken', 'userPlan', 'userRole', 'scansRemaining'], async (items) => {
            const { userPlan, userRole, scansRemaining } = items;
            const authToken = items.apiToken || items.authToken;

            // 1. Auth Check
            if (!authToken) {
                // If auto-scan, just ignore. If manual, return error.
                if (request.source === 'auto') {
                    sendResponse({ error: "SILENT_FAIL" });
                } else {
                    sendResponse({ error: "UNAUTHORIZED" });
                }
                return;
            }

            // 2. Quota Check
            // Admins bypass limits
            if (userRole === 'admin' || userRole === 'super_admin') {
                 processScan(request, sender, sendResponse, undefined);
                 return;
            }

            if (userPlan === 'free') {
                if (scansRemaining <= 0) {
                    // If auto-scan, silent fail (don't spam user)
                    if (request.source === 'auto') {
                        console.log("Background: Auto-scan skipped (Limit Reached)");
                        sendResponse({ error: "SILENT_FAIL" });
                    } else {
                        sendResponse({ error: "LIMIT_REACHED" });
                    }
                    return;
                }

                // Decrement Quota
                const newRemaining = scansRemaining - 1;
                await chrome.storage.sync.set({ scansRemaining: newRemaining });

                // Proceed with scan...
                processScan(request, sender, sendResponse, newRemaining);
            } else {
                // Paid user - unlimited
                processScan(request, sender, sendResponse, undefined);
            }
        });

        return true; // Keep channel open for async response
    }
    
    // --- DEEP SCAN (PAID ONLY) ---
    if (request.action === "deep_scan") {
        chrome.storage.sync.get(['authToken', 'apiToken', 'userPlan', 'userRole', 'deepScanPublicKey'], async (items) => {
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
                const { apiUrl } = await chrome.storage.sync.get({ apiUrl: 'http://localhost:3001' });

                const response = await fetch(`${apiUrl}/api/v1/deep-scan`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
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

        // --- TRACK USER CLICK ON SUSPICIOUS LINK ---
        if (request.action === "user_action_click_suspicious_link") {
            chrome.storage.sync.get(['authToken', 'apiToken', 'userPlan', 'userRole'], async (items) => {
                const authToken = items.apiToken || items.authToken;
                if (!authToken) return;
                const { apiUrl } = await chrome.storage.sync.get({ apiUrl: 'http://localhost:3001' });
                try {
                    await fetch(`${apiUrl}/api/v1/user-actions`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}`
                        },
                        body: JSON.stringify({
                            actionType: 'clicked_suspicious_link',
                            link: request.link,
                            actionAt: new Date().toISOString(),
                            // emailScanId: poate fi adăugat dacă este disponibil
                            // Se poate adăuga și emailUrl pentru context
                            emailUrl: request.emailUrl
                        })
                    });
                } catch (e) {
                    console.error('Failed to log user action:', e);
                }
            });
            return;
        }
});

async function processScan(request, sender, sendResponse, remainingScans) {
    const start = performance.now();
    predict(request.text, request.url).then(result => {
        const durationMs = performance.now() - start;
        // Update Badge
        // Hybrid Scoring: Max of AI scores and Heuristic score
        const finalScore = Math.max(result.textScore, result.urlScore, result.heuristicScore);
        const riskLevel = getRiskLevel(finalScore);
        const isPhish = isPhishingScore(finalScore);
        const attackType = classifyAttackType(request.text || "");

        if (durationMs > 200) {
            console.warn(`PhishGuard: scan exceeded 200ms (${durationMs.toFixed(0)}ms)`);
        }

        let badgeText = "SAFE";
        let badgeColor = "#22C55E";
        if (riskLevel === "medium") {
            badgeText = "RISK";
            badgeColor = "#F59E0B";
        } else if (riskLevel === "high" || riskLevel === "critical") {
            badgeText = "WARN";
            badgeColor = "#DC2626";
        }

        chrome.action.setBadgeText({ text: badgeText, tabId: sender.tab.id });
        chrome.action.setBadgeBackgroundColor({ color: badgeColor, tabId: sender.tab.id });

        // Log scan to backend (for BI & org analytics)
        logIncident({
            url: request.url,
            textScore: result.textScore,
            urlScore: result.urlScore,
            heuristicScore: result.heuristicScore,
            overallScore: finalScore,
            attackType
        });

        if (isPhish) {
            // System Notification (Crucial for Auto-Scan)
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'assets/logo-128.png',
                title: 'Phishing detected',
                message: `PhishGuard detected a threat in this email.\nRisk score: ${(finalScore * 100).toFixed(0)}%`,
                priority: 2
            });
        }

        // Return result + updated quota
        sendResponse({
            ...result,
            overallScore: finalScore,
            riskLevel,
            attackType,
            durationMs,
            scansRemaining: remainingScans
        });
    });
}

// --- 5. EXTERNAL MESSAGING (AUTH HANDOFF) ---
function handleAuthHandoff(request, sender, sendResponse) {
	// DEBUG LOG
	console.log("Background: Message Received", request);
    // LOGOUT ACTION
    if (request.action === "LOGOUT") {
        console.log("Background: LOGOUT ACTION TRIGGERED");
        
        // Clear everything
        const keys = ['authToken', 'apiToken', 'userPlan', 'scansRemaining', 'deepScanPublicKey'];
        
        chrome.storage.sync.remove(keys, () => {
             console.log("Background: Sync storage cleared");
        });
        
        chrome.storage.local.remove(keys, () => {
             console.log("Background: Local storage cleared");
             sendResponse({ success: true });
        });
        
        // Also badge update
        chrome.action.setBadgeText({ text: "" });
        
        return true; 
    }

    // AUTH HANDOFF ACTION
    if (request.action === "AUTH_HANDOFF") {
        console.log("Background: Received Auth Token");

        const { token, user, subscription, deepScanPublicKey } = request;

        // Save to Storage (Both Sync and Local for reliability)
        const data = {
            authToken: token,
            apiToken: token,
            userPlan: user.plan || 'free',
            userRole: user.role || 'user',
            scansRemaining: subscription ? subscription.scansRemaining : 10,
            deepScanPublicKey: deepScanPublicKey || null
        };

        chrome.storage.sync.set(data);
        chrome.storage.local.set(data, () => {
             console.log("Background: Token saved to storage.");
             sendResponse({ success: true });
        });

        return true; // Async response
    }
}

chrome.runtime.onMessageExternal.addListener(handleAuthHandoff);
chrome.runtime.onMessage.addListener(handleAuthHandoff);

// Initialize on load
loadResources();

// --- INSTALL/UPDATE HANDLER ---
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install' || details.reason === 'update') {
        console.log("Background: Extension installed/updated. Clearing storage to prevent compatibility issues.");
        const keys = ['authToken', 'apiToken', 'userPlan', 'userRole', 'scansRemaining', 'apiUrl', 'deepScanPublicKey'];
        
        chrome.storage.local.remove(keys);
        chrome.storage.sync.remove(keys);
    }
});
