importScripts('tf.min.js');

// --- CONFIGURATION ---
const TEXT_MAX_LEN = 150;
const URL_MAX_LEN = 150;
const TEXT_OOV = "<OOV>";
const URL_OOV = "<OOV>";
const PHISHING_THRESHOLD = 0.5;

// Heuristic Keywords (Must match WebApp)
const SUSPICIOUS_KEYWORDS = {
    urgency: ["immediately", "urgent", "24 hours", "suspend", "close account", "lock", "restricted"],
    action: ["verify", "login", "click here", "update", "confirm"],
    generic: ["dear customer", "dear user", "valued customer"]
};

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
        chrome.storage.sync.get(['authToken', 'apiToken', 'userPlan', 'scansRemaining'], async (items) => {
            const { userPlan, scansRemaining } = items;
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
});

async function processScan(request, sender, sendResponse, remainingScans) {
    predict(request.text, request.url).then(result => {
        // Update Badge
        // Hybrid Scoring: Max of AI scores and Heuristic score
        const finalScore = Math.max(result.textScore, result.urlScore, result.heuristicScore);
        const isPhish = finalScore > PHISHING_THRESHOLD;

        if (isPhish) {
            // ALWAYS Alert on Phishing (Auto or Manual)
            chrome.action.setBadgeText({ text: "WARN", tabId: sender.tab.id });
            chrome.action.setBadgeBackgroundColor({ color: "#FF0000", tabId: sender.tab.id });

            // Log Incident to Backend
            logIncident({
                url: request.url,
                textScore: result.textScore,
                urlScore: result.urlScore
            });

            // System Notification (Crucial for Auto-Scan)
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'assets/icon128.png',
                title: '⚠️ Phishing Detected!',
                message: `PhishGuard detected a threat in this email.\nText Score: ${result.textScore.toFixed(2)}`,
                priority: 2
            });
        } else {
            // Safe
            chrome.action.setBadgeText({ text: "SAFE", tabId: sender.tab.id });
            chrome.action.setBadgeBackgroundColor({ color: "#00FF00", tabId: sender.tab.id });
        }

        // Return result + updated quota
        sendResponse({
            ...result,
            scansRemaining: remainingScans
        });
    });
}

// --- 5. EXTERNAL MESSAGING (AUTH HANDOFF) ---
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
    if (request.action === "AUTH_HANDOFF") {
        console.log("Background: Received Auth Token from Web App");

        const { token, user } = request;

        // Save to Storage
        chrome.storage.sync.set({
            authToken: token,
            apiToken: token, // Save as both for compatibility
            userPlan: user.plan || 'free',
            scansRemaining: 10 // Reset or fetch from API in future
        }, () => {
            sendResponse({ success: true });
        });

        return true; // Async response
    }
});

// Initialize on load
loadResources();
