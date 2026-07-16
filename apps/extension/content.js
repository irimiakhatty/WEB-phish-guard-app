// --- CONFIGURATION ---
let lastScannedTextHash = "";
let scanTimeout = null;
let lastScannedText = "";
let lastDismissedTextHash = "";
let lastScanResult = null;

const RISK_THRESHOLDS = {
    low: 0.2,
    medium: 0.4,
    high: 0.6,
    critical: 0.8
};

function getRiskLevelFromScore(score) {
    if (score < RISK_THRESHOLDS.low) return "safe";
    if (score < RISK_THRESHOLDS.medium) return "low";
    if (score < RISK_THRESHOLDS.high) return "medium";
    if (score < RISK_THRESHOLDS.critical) return "high";
    return "critical";
}

const STYLE_ID = "phishguard-scan-style";
const FLAG_ID = "phishguard-scan-flag";
const PROMPT_ID = "phishguard-scan-prompt";
const CONTAINER_ID = "phishguard-scan-container";
const MAX_DEEP_SCAN_CHARS = 5000;
const MIN_EMAIL_SCAN_CHARS = 50;
const SCAN_BURST_DELAYS_MS = [0, 500, 1200, 2500, 5000, 9000];
const scanCacheMemory = new Map();

function formatPercent(score) {
    const safeScore = Number.isFinite(score) ? Math.min(Math.max(score, 0), 1) : 0;
    return `${Math.round(safeScore * 100)}%`;
}

function getOverallScore(response) {
    if (typeof response?.overallScore === "number") return response.overallScore;
    const textScore = response?.textScore || 0;
    const urlScore = response?.urlScore || 0;
    const heuristicScore = response?.heuristicScore || 0;
    return Math.max(textScore, urlScore, heuristicScore);
}

const EXTENSION_UI_VERSION = "1.2.5";
const INBOX_STYLE_VERSION = "6";
let cachedInboxCss = null;

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

const INBOX_ERROR_COPY = {
    UNAUTHORIZED: "Sign in via the PhishGuard extension popup to analyze emails.",
    AUTO_UNAVAILABLE: "Could not reach the analysis server. Check API URL in extension settings.",
    ANALYZE_UNAVAILABLE: "Server analysis is unavailable right now.",
    ANALYZE_FAILED: "Analysis failed. Try reopening the email.",
    LIMIT_REACHED: "Scan limit reached. Upgrade or wait for the next billing cycle.",
    RUNTIME_ERROR: "Extension service unavailable. Reload the extension.",
    TIMEOUT: "Analysis timed out. Reopen the email to retry."
};

function getOrCreateStyleElement() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
        style = document.createElement("style");
        style.id = STYLE_ID;
        document.head.appendChild(style);
    }
    return style;
}

function ensureStyles() {
    const style = getOrCreateStyleElement();
    if (style.dataset.version === INBOX_STYLE_VERSION && cachedInboxCss) {
        return;
    }

    if (cachedInboxCss) {
        style.textContent = cachedInboxCss;
        style.dataset.version = INBOX_STYLE_VERSION;
        return;
    }

    // Minimal fallback so the badge is visible even before CSS fetch completes
    style.textContent = `
        .pg-container { display: block; width: 100%; margin: 0 0 10px; clear: both; }
        .pg-flag, .pg-prompt {
            display: flex; flex-direction: row; align-items: center; flex-wrap: wrap; gap: 8px;
            width: 100%; padding: 10px 14px; margin: 0; border-radius: 10px;
            background: #09090b; color: #fafafa; border: 1px solid #27272a;
            font-family: system-ui, sans-serif; box-sizing: border-box;
        }
    `;

    if (style.dataset.loading === "1") {
        return;
    }
    style.dataset.loading = "1";

    fetch(chrome.runtime.getURL("inbox-styles.css"))
        .then((response) => response.text())
        .then((css) => {
            cachedInboxCss = css;
            style.textContent = css;
            style.dataset.version = INBOX_STYLE_VERSION;
            delete style.dataset.loading;
        })
        .catch((error) => {
            console.warn("PhishGuard: inbox-styles.css load failed", error);
            delete style.dataset.loading;
        });
}

function buildIconSvg(type) {
    if (type === "check") {
        return `<svg viewBox="0 0 24 24" fill="none"><path d="M6 12.5l4 4L18 9" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }
    return `<svg viewBox="0 0 24 24" fill="none"><path d="M12 3l9 16H3l9-16z" stroke-width="2" stroke-linejoin="round"/><path d="M12 9v4" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17" r="1.2" fill="currentColor"/></svg>`;
}

// --- 1. UTILS ---
console.log(`PhishGuard content script v${EXTENSION_UI_VERSION} on:`, location.href);

function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
}

const INBOX_SETTINGS_DEFAULTS = {
    autoScan: true,
    userPlan: null,
    subscriptionStatus: null,
    userRole: "user",
    scansRemaining: 0,
    planName: "Free"
};

async function fetchInboxSettings() {
    try {
        const response = await sendRuntimeMessage({ action: "GET_INBOX_SETTINGS" });
        if (!response || typeof response !== "object") {
            return { ...INBOX_SETTINGS_DEFAULTS };
        }
        return { ...INBOX_SETTINGS_DEFAULTS, ...response };
    } catch {
        return { ...INBOX_SETTINGS_DEFAULTS };
    }
}

function sendRuntimeMessage(message) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
            }
            resolve(response);
        });
    });
}

function isAdminRole(role) {
    return role === "admin" || role === "super_admin";
}

function isLimitedPlan(planId, role) {
    return !isAdminRole(role) && (!planId || planId === "free" || planId === "team_free");
}

function isTrialStatus(status) {
    return status === "trialing";
}

function requiresScanConfirmation(planId, role, status) {
    return isLimitedPlan(planId, role) && !isTrialStatus(status);
}

function formatTrialPlanName(planName) {
    const safeName = String(planName || "Free").trim();
    return /trial$/i.test(safeName) ? safeName : `${safeName} trial`;
}

function removeScanFlag() {
    const flag = document.getElementById(FLAG_ID);
    if (flag) {
        flag.remove();
    }
    cleanupUiContainerIfEmpty();
}

function removeScanPrompt() {
    const prompt = document.getElementById(PROMPT_ID);
    if (prompt) {
        prompt.remove();
    }
    cleanupUiContainerIfEmpty();
}

function isElementVisible(element) {
    if (!element || !(element instanceof Element)) {
        return false;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) {
        return false;
    }

    const style = window.getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity) > 0.05;
}

function findGmailBodyElements() {
    const selectors = [
        ".a3s.aiL",
        ".a3s",
        "div[data-message-id] .a3s",
        "div[role=\"document\"]",
        ".ii.gt"
    ];
    const seen = new Set();
    const elements = [];

    selectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((node) => {
            if (!(node instanceof HTMLElement) || seen.has(node)) {
                return;
            }
            seen.add(node);
            elements.push(node);
        });
    });

    return elements;
}

function pickVisibleEmailBody(elements) {
    if (!elements.length) {
        return null;
    }

    for (let i = elements.length - 1; i >= 0; i -= 1) {
        if (isElementVisible(elements[i])) {
            return elements[i];
        }
    }

    return elements[elements.length - 1];
}

function getMessageMountPoint(bodyTarget) {
    if (!bodyTarget) {
        return null;
    }

    return (
        bodyTarget.closest("[data-message-id]") ||
        bodyTarget.closest("[data-legacy-message-id]") ||
        bodyTarget.closest(".gs") ||
        bodyTarget.parentElement
    );
}

function cleanupUiContainerIfEmpty() {
    const container = document.getElementById(CONTAINER_ID);
    if (container && container.childElementCount === 0) {
        container.remove();
    }
}

function removeScanContainer() {
    const container = document.getElementById(CONTAINER_ID);
    if (container) {
        container.remove();
    }
}

// --- 2. TEXT EXTRACTION ---
function getEmailTarget() {
    const gmailBody = pickVisibleEmailBody(findGmailBodyElements());
    if (gmailBody) {
        return gmailBody;
    }

    const outlookBody = document.querySelector('[aria-label="Message body"]');
    if (outlookBody && isElementVisible(outlookBody)) {
        return outlookBody;
    }

    const readingPane = document.querySelector(".ReadingPane");
    if (readingPane && isElementVisible(readingPane)) {
        return readingPane;
    }

    return null;
}

function getEmailContent() {
    const target = getEmailTarget();
    if (target) {
        return target.innerText.trim().substring(0, 3000);
    }

    return "";
}

async function readCachedScanResult(contentHash) {
    const memoryHit = scanCacheMemory.get(String(contentHash));
    if (memoryHit) {
        return memoryHit;
    }

    try {
        const response = await sendRuntimeMessage({
            action: "GET_SCAN_CACHE",
            contentHash
        });
        const hit = response?.result || null;
        if (hit) {
            scanCacheMemory.set(String(contentHash), hit);
        }
        return hit;
    } catch {
        return null;
    }
}

function writeCachedScanResult(contentHash, result) {
    scanCacheMemory.set(String(contentHash), result);
    sendRuntimeMessage({
        action: "SET_SCAN_CACHE",
        contentHash,
        result
    }).catch(() => {});
}

// --- 3. SCANNING LOGIC ---
function mountInboxCard(element, target) {
    if (!target) {
        return false;
    }

    ensureStyles();

    const parent = target.parentElement;
    if (!parent) {
        try {
            target.before(element);
            return true;
        } catch (error) {
            console.warn("PhishGuard: direct badge insert failed", error);
            return false;
        }
    }

    let container = target.previousElementSibling;
    if (!container || container.id !== CONTAINER_ID) {
        container = parent.querySelector(`#${CONTAINER_ID}`);
    }

    try {
        if (!container) {
            container = document.createElement("div");
            container.id = CONTAINER_ID;
            container.className = "pg-container";
            container.dataset.pgVersion = EXTENSION_UI_VERSION;
            parent.insertBefore(container, target);
        } else if (container.nextElementSibling !== target) {
            parent.insertBefore(container, target);
        }

        container.replaceChildren(element);
        return true;
    } catch (error) {
        console.warn("PhishGuard: mountInboxCard failed, fallback insert", error);
        try {
            target.before(element);
            return true;
        } catch (fallbackError) {
            console.warn("PhishGuard: fallback badge insert failed", fallbackError);
            return false;
        }
    }
}

function injectScanPending() {
    const target = getEmailTarget();
    if (!target) {
        return;
    }

    ensureStyles();
    removeScanFlag();

    const flag = document.createElement("div");
    flag.id = FLAG_ID;
    flag.className = "pg-flag pg-flag--pending pg-flag--compact";
    flag.innerHTML = `
        <div class="pg-flag__icon">${buildIconSvg("check")}</div>
        <div class="pg-flag__main">
            <div class="pg-flag__primary">
                <span class="pg-flag__title">Analyzing email</span>
                <span class="pg-flag__badge">PhishGuard</span>
            </div>
        </div>
    `;
    mountInboxCard(flag, target);
}

function injectScanErrorFlag(errorCode, extraMessage) {
    const target = getEmailTarget();
    if (!target) {
        return;
    }

    ensureStyles();
    removeScanFlag();

    const message =
        extraMessage ||
        INBOX_ERROR_COPY[errorCode] ||
        "PhishGuard could not analyze this email.";

    const flag = document.createElement("div");
    flag.id = FLAG_ID;
    flag.className = "pg-flag pg-flag--neutral";
    flag.innerHTML = `
        <div class="pg-flag__icon">${buildIconSvg("warn")}</div>
        <div class="pg-flag__main">
            <div class="pg-flag__primary">
                <span class="pg-flag__title">Analysis unavailable</span>
                <span class="pg-flag__badge">PhishGuard</span>
            </div>
            <p class="pg-flag__desc">${escapeHtml(message)}</p>
        </div>
    `;
    mountInboxCard(flag, target);
}

function handleAutoScanResponseError(response, {
    currentHash,
    text,
    url,
    planName,
    subscriptionStatus,
    onResult
}) {
    const errorCode = response?.error || "UNKNOWN_ERROR";

    if (errorCode === "LIMIT_REACHED") {
        injectFreePlanPrompt({
            currentHash,
            text,
            url,
            scansRemaining: Number(response?.scansRemaining || 0),
            planName,
            subscriptionStatus: response?.subscriptionStatus || subscriptionStatus || null,
            isLimitReached: true
        });
    } else if (errorCode === "UNAUTHORIZED") {
        injectScanErrorFlag("UNAUTHORIZED");
    } else {
        injectScanErrorFlag(errorCode, response?.message);
    }

    if (typeof onResult === "function") {
        onResult(response || { error: errorCode });
    }
}

async function submitScan({ text, url, currentHash, source, onResult, planName, subscriptionStatus }) {
    lastScannedTextHash = currentHash;
    lastScannedText = text;
    lastScanResult = null;

    const isAutoSource = source === "auto" || source === "auto_confirmed";

    if (source === "auto") {
        console.log("PhishGuard: Auto-scanning new content...");
    }

    if (isAutoSource) {
        injectScanPending();
    }

    let response;
    try {
        response = await sendRuntimeMessage({
            action: "scan_page",
            source,
            text,
            url
        });
    } catch (runtimeError) {
        console.warn("PhishGuard: scan message failed", runtimeError);
        if (isAutoSource) {
            handleAutoScanResponseError(
                { error: "RUNTIME_ERROR" },
                { currentHash, text, url, planName, subscriptionStatus, onResult }
            );
        } else if (typeof onResult === "function") {
            onResult({ error: "RUNTIME_ERROR" });
        }
        return;
    }

    if (!response || response.error) {
        if (isAutoSource) {
            handleAutoScanResponseError(response, {
                currentHash,
                text,
                url,
                planName,
                subscriptionStatus,
                onResult
            });
            return;
        }

        if ((!response || response.error === "LIMIT_REACHED") && typeof onResult !== "function") {
            injectFreePlanPrompt({
                currentHash,
                text,
                url,
                scansRemaining: Number(response?.scansRemaining || 0),
                planName,
                subscriptionStatus: response?.subscriptionStatus || subscriptionStatus || null,
                isLimitReached: true
            });
        }

        if (typeof onResult === "function") {
            onResult(response || { error: "UNKNOWN_ERROR" });
        }
        return;
    }

    removeScanPrompt();
    lastScanResult = response;
    injectScanFlag(response);
    void writeCachedScanResult(currentHash, response);

    if (typeof onResult === "function") {
        onResult(response);
    }
}

function injectFreePlanPrompt({
    currentHash,
    text,
    url,
    scansRemaining,
    planName,
    subscriptionStatus,
    isLimitReached
}) {
    const target = getEmailTarget();
    if (!target) {
        return;
    }

    ensureStyles();
    removeScanFlag();

    const existingPrompt = document.getElementById(PROMPT_ID);
    if (
        existingPrompt &&
        existingPrompt.dataset.hash === String(currentHash) &&
        existingPrompt.dataset.mode === (isLimitReached ? "limit" : "confirm")
    ) {
        return;
    }

    removeScanPrompt();

    const prompt = document.createElement("div");
    prompt.id = PROMPT_ID;
    prompt.dataset.hash = String(currentHash);
    prompt.dataset.mode = isLimitReached ? "limit" : "confirm";
    prompt.className = `pg-prompt ${isLimitReached ? "pg-prompt--limit" : ""}`;

    const isTrialExpired = subscriptionStatus === "trial_expired";
    const title = isTrialExpired
        ? "Trial ended"
        : isLimitReached
        ? "No scans left for this cycle"
        : "Analyze this email before spending 1 scan?";
    const description = isTrialExpired
        ? `${formatTrialPlanName(planName)} has ended. Upgrade to keep opened emails analyzed automatically.`
        : isLimitReached
        ? `${planName || "Current plan"} has reached its scan limit. Upgrade to restore live inbox checks.`
        : `${planName || "Current plan"} will use 1 scan to analyze this opened email.`;
    const meta = isTrialExpired
        ? "Realtime inbox flags stay paused until you upgrade to a paid plan."
        : isLimitReached
        ? "Automatic protection will resume after your plan resets or you upgrade."
        : `${Math.max(0, Number(scansRemaining || 0))} scans remaining right now.`;

    prompt.innerHTML = `
        <div class="pg-prompt__icon">${buildIconSvg(isLimitReached ? "warn" : "check")}</div>
        <div class="pg-prompt__content">
            <div class="pg-prompt__eyebrow">${isTrialExpired ? "Trial ended" : isLimitReached ? "Plan limit" : "Scan confirmation"}</div>
            <div class="pg-prompt__title">${escapeHtml(title)}</div>
            <div class="pg-prompt__desc">${escapeHtml(description)}</div>
            <div class="pg-prompt__meta">${escapeHtml(meta)}</div>
            <div class="pg-prompt__actions">
                ${
                    isLimitReached
                        ? `<button class="pg-prompt__button pg-prompt__button--secondary" data-action="dismiss">Dismiss</button>`
                        : `
                            <button class="pg-prompt__button pg-prompt__button--primary" data-action="confirm">Use 1 scan</button>
                            <button class="pg-prompt__button pg-prompt__button--secondary" data-action="skip">Skip for now</button>
                        `
                }
            </div>
            <div class="pg-prompt__status"></div>
        </div>
    `;

    mountInboxCard(prompt, target);

    const status = prompt.querySelector(".pg-prompt__status");
    const dismissButton = prompt.querySelector('[data-action="dismiss"]');
    const skipButton = prompt.querySelector('[data-action="skip"]');
    const confirmButton = prompt.querySelector('[data-action="confirm"]');

    if (dismissButton) {
        dismissButton.addEventListener("click", () => {
            lastDismissedTextHash = currentHash;
            removeScanPrompt();
        });
    }

    if (skipButton) {
        skipButton.addEventListener("click", () => {
            lastDismissedTextHash = currentHash;
            removeScanPrompt();
        });
    }

    if (confirmButton && status) {
        confirmButton.addEventListener("click", () => {
            confirmButton.disabled = true;
            if (skipButton) {
                skipButton.disabled = true;
            }
            status.textContent = "Analyzing this email now...";

            submitScan({
                text,
                url,
                currentHash,
                source: "auto_confirmed",
                onResult: (result) => {
                    if (!result || !result.error) {
                        lastDismissedTextHash = "";
                        return;
                    }

                    if (result.error === "LIMIT_REACHED") {
                        status.textContent = "No scans left. Upgrade to continue realtime analysis.";
                        lastDismissedTextHash = currentHash;
                        if (skipButton) {
                            skipButton.disabled = false;
                        }
                        return;
                    }

                    if (result.error === "UNAUTHORIZED") {
                        status.textContent = "Sign in again in the extension popup to continue.";
                        lastScannedTextHash = "";
                        confirmButton.disabled = false;
                        if (skipButton) {
                            skipButton.disabled = false;
                        }
                        return;
                    }

                    status.textContent = "Scan failed. Try again in a moment.";
                    lastScannedTextHash = "";
                    confirmButton.disabled = false;
                    if (skipButton) {
                        skipButton.disabled = false;
                    }
                }
            });
        });
    }
}

let scanInFlight = false;
let scanBurstGeneration = 0;

async function restoreVisibleVerdict(contentHash) {
    let cached = null;
    try {
        cached = await readCachedScanResult(contentHash);
    } catch {
        cached = null;
    }
    const payload = cached || lastScanResult;
    if (!payload || payload.error) {
        return false;
    }

    if (!document.getElementById(FLAG_ID)) {
        lastScanResult = payload;
        injectScanFlag(payload);
    }

    return Boolean(document.getElementById(FLAG_ID));
}

async function triggerScan() {
    if (scanInFlight) {
        return;
    }

    try {
        const text = getEmailContent();
        const url = location.href;
        const target = getEmailTarget();

        if (!target || text.length < MIN_EMAIL_SCAN_CHARS) {
            removeScanPrompt();
            return;
        }

        const currentHash = hashCode(text);
        await restoreVisibleVerdict(currentHash);

        if (currentHash === lastScannedTextHash) {
            if (!document.getElementById(FLAG_ID) && lastScanResult) {
                injectScanFlag(lastScanResult);
            }
            return;
        }

        scanInFlight = true;

        sendRuntimeMessage({ action: "REFRESH_CONTEXT" }).catch(() => {});

        const syncState = await fetchInboxSettings();

        if (syncState.autoScan === false) {
            removeScanPrompt();
            scanInFlight = false;
            return;
        }

        if (requiresScanConfirmation(
            syncState.userPlan,
            syncState.userRole,
            syncState.subscriptionStatus
        )) {
            if (currentHash === lastDismissedTextHash) {
                scanInFlight = false;
                return;
            }

            injectFreePlanPrompt({
                currentHash,
                text,
                url,
                scansRemaining: Number(syncState.scansRemaining || 0),
                planName: syncState.planName || "Free",
                subscriptionStatus: syncState.subscriptionStatus || null,
                isLimitReached: Number(syncState.scansRemaining || 0) <= 0
            });
            scanInFlight = false;
            return;
        }

        lastDismissedTextHash = "";
        removeScanPrompt();
        try {
            await submitScan({
                text,
                url,
                currentHash,
                source: "auto",
                planName: syncState.planName || "Free",
                subscriptionStatus: syncState.subscriptionStatus || null
            });
        } finally {
            scanInFlight = false;
        }
    } catch (error) {
        console.warn("PhishGuard: triggerScan failed", error);
        scanInFlight = false;
    }
}

const RISK_COPY = {
    block: {
        title: "Threat blocked by policy",
        badge: "Blocked",
        description: "This message matches a workspace block policy.",
        icon: "warn"
    },
    safe: {
        title: "Safe email",
        badge: "Safe",
        description: "No risky signals detected.",
        icon: "check"
    },
    low: {
        title: "Low risk email",
        badge: "Low risk",
        description: "Minor indicators detected.",
        icon: "check"
    },
    medium: {
        title: "Suspicious email",
        badge: "Medium risk",
        description: "Possible phishing patterns detected.",
        icon: "warn"
    },
    high: {
        title: "High risk detected",
        badge: "High risk",
        description: "Phishing likely. Avoid clicking links.",
        icon: "warn"
    },
    critical: {
        title: "Critical risk detected",
        badge: "Critical",
        description: "Phishing very likely. Do not click links.",
        icon: "warn"
    }
};
const RISK_SEVERITY_ORDER = ["safe", "low", "medium", "high", "critical", "block"];

function riskSeverityRank(riskLevel) {
    const rank = RISK_SEVERITY_ORDER.indexOf(riskLevel);
    return rank === -1 ? -1 : rank;
}

// Re-styles an already-mounted flag in place (used when Deep Scan returns a
// more severe verdict than the initial heuristic scan) without discarding
// the Deep Scan result panel or feedback state already rendered inside it.
function escalateFlagRisk(flag, riskLevel, overallScore) {
    const config = RISK_COPY[riskLevel] || RISK_COPY.medium;
    const previousLevel = flag.dataset.riskLevel;
    if (previousLevel) {
        flag.classList.remove(`pg-flag--${previousLevel}`);
    }
    flag.classList.add(`pg-flag--${riskLevel}`);
    flag.dataset.riskLevel = riskLevel;

    const title = flag.querySelector(".pg-flag__title");
    const badge = flag.querySelector(".pg-flag__badge");
    const meta = flag.querySelector(".pg-flag__meta");
    const desc = flag.querySelector(".pg-flag__desc");

    if (title) title.textContent = config.title;
    if (badge) badge.textContent = config.badge;
    if (meta && typeof overallScore === "number") {
        meta.textContent = `Risk score: ${formatPercent(overallScore)} · Confirmed by Deep Scan`;
    }
    if (desc) desc.textContent = config.description;
}

function injectScanFlag(response) {
    if (!response || response.error) return;

    const oldFlag = document.getElementById(FLAG_ID);
    if (oldFlag) oldFlag.remove();

    const target = getEmailTarget();
    if (!target) return;

    ensureStyles();

    const overallScore = getOverallScore(response);
    const hardBlock = Boolean(response.hardBlockApplied) || response?.policyDecision?.action === "block";
    let riskLevel = response.riskLevel || getRiskLevelFromScore(overallScore);
    if (hardBlock && riskLevel !== "critical") {
        riskLevel = "block";
    }
    const attackType = response.attackType || "Other";

    const config = RISK_COPY[riskLevel] || RISK_COPY.medium;
    const isCompact = riskLevel === "safe" || riskLevel === "low";
    const showDeepScan = !hardBlock && (riskLevel === "medium" || riskLevel === "high");
    const isHighRisk = hardBlock || riskLevel === "high" || riskLevel === "critical" || riskLevel === "block";

    const metaParts = [`Risk score: ${formatPercent(overallScore)}`];
    if (!isCompact && attackType && attackType !== "Other") {
        metaParts.push(`Attack type: ${attackType}`);
    }

    const iconSvg = buildIconSvg(config.icon);
    const riskLabel = riskLevel === "block" ? "blocked" : `${riskLevel} risk`;

    const flag = document.createElement("div");
    flag.id = FLAG_ID;
    flag.className = `pg-flag pg-flag--${riskLevel} ${isCompact ? "pg-flag--compact" : ""}`;
    flag.innerHTML = `
        <div class="pg-flag__icon">${iconSvg}</div>
        <div class="pg-flag__main">
            <div class="pg-flag__primary">
                <span class="pg-flag__title">${escapeHtml(config.title)}</span>
                <span class="pg-flag__badge">${escapeHtml(config.badge)}</span>
                <span class="pg-flag__meta">${escapeHtml(metaParts.join(" · "))}</span>
            </div>
            ${isCompact ? "" : `<p class="pg-flag__desc">${escapeHtml(config.description)}</p>`}
            <div class="pg-flag__toolbar">
                ${showDeepScan ? `<button type="button" class="pg-btn pg-btn--primary pg-flag__cta">Deep Scan</button>` : ""}
                <button type="button" class="pg-btn" data-label="safe">Mark safe</button>
                <button type="button" class="pg-btn" data-label="phishing">Mark phishing</button>
                <button type="button" class="pg-btn" data-label="unsure">Unsure</button>
            </div>
            <div class="pg-flag__feedback-status" style="display:none;"></div>
            <div class="pg-flag__ai" style="display:none;"></div>
        </div>
    `;
    flag.dataset.riskLabel = riskLabel;
    flag.dataset.riskLevel = riskLevel;

    if (!mountInboxCard(flag, target)) {
        console.warn("PhishGuard: verdict badge could not be mounted");
        return;
    }

    // Deep Scan handler (paid plans only)
    const deepScanButton = flag.querySelector(".pg-flag__cta");
    const deepScanResult = flag.querySelector(".pg-flag__ai");
    if (deepScanButton && deepScanResult) {
        deepScanButton.addEventListener("click", () => {
            if (deepScanButton.disabled) return;
            const payloadText = (lastScannedText || "").slice(0, MAX_DEEP_SCAN_CHARS);
            if (!payloadText) return;

            deepScanButton.disabled = true;
            deepScanButton.textContent = "Scanning...";

            chrome.runtime.sendMessage({
                action: "deep_scan",
                text: payloadText,
                url: location.href
            }, (result) => {
                deepScanButton.disabled = false;
                deepScanButton.textContent = "Deep Scan";

                if (chrome.runtime.lastError || !result) {
                    deepScanResult.style.display = "block";
                    deepScanResult.textContent = "Deep scan failed. Try again.";
                    return;
                }

                if (result.error) {
                    deepScanResult.style.display = "block";
                    if (result.error === "PAYWALL") {
                        deepScanResult.textContent = "Deep Scan with AI is available on paid plans.";
                        deepScanButton.classList.remove("pg-btn--primary");
                    } else if (result.error === "NO_PUBLIC_KEY") {
                        deepScanResult.textContent = "Deep Scan is not configured yet. Contact your admin.";
                    } else if (result.error === "UNAUTHORIZED") {
                        deepScanResult.textContent = "Sign in to use Deep Scan with AI.";
                    } else {
                        deepScanResult.textContent = "Deep scan failed. Try again.";
                    }
                    return;
                }

                const data = result.data || {};
                const aiRiskLevel = typeof data.riskLevel === "string" ? data.riskLevel.toLowerCase() : null;
                const aiRisk = aiRiskLevel ? aiRiskLevel.toUpperCase() : "RESULT";
                const aiScore = typeof data.overallScore === "number" ? formatPercent(data.overallScore) : "";
                const analysis = typeof data.analysis === "string" ? data.analysis : "Deep scan completed.";
                const trimmed = analysis.length > 160 ? `${analysis.slice(0, 157)}...` : analysis;

                deepScanResult.style.display = "block";
                deepScanResult.textContent = `${aiRisk}${aiScore ? ` (${aiScore})` : ""}: ${trimmed}`;

                // Deep Scan is the higher-confidence verdict — escalate the banner
                // (title/badge/color) if it found more risk than the initial heuristic scan.
                if (
                    aiRiskLevel &&
                    riskSeverityRank(aiRiskLevel) > riskSeverityRank(flag.dataset.riskLevel)
                ) {
                    escalateFlagRisk(
                        flag,
                        aiRiskLevel,
                        typeof data.overallScore === "number" ? data.overallScore : null
                    );
                }
            });
        });
    }

    // Feedback handler (safe/phishing/unsure)
    const feedbackButtons = Array.from(flag.querySelectorAll('.pg-btn[data-label]'));
    const feedbackStatus = flag.querySelector(".pg-flag__feedback-status");
    if (feedbackButtons.length > 0 && feedbackStatus) {
        feedbackButtons.forEach((btn) => {
            btn.addEventListener("click", () => {
                if (!(btn instanceof HTMLElement)) return;
                const label = btn.dataset.label;
                if (!label) return;

                feedbackButtons.forEach((b) => {
                    if (b instanceof HTMLButtonElement) b.disabled = true;
                });
                feedbackStatus.style.display = "block";
                feedbackStatus.textContent = "Saving feedback...";

                chrome.runtime.sendMessage(
                    {
                        action: "scan_feedback",
                        label,
                        note: `risk=${riskLevel}; score=${formatPercent(overallScore)}; page=${location.hostname}`
                    },
                    (result) => {
                        feedbackButtons.forEach((b) => {
                            if (b instanceof HTMLButtonElement) b.disabled = false;
                        });

                        if (chrome.runtime.lastError || !result) {
                            feedbackStatus.textContent = "Feedback failed. Try again.";
                            return;
                        }

                        if (result.error) {
                            if (result.error === "NO_SCAN_CONTEXT") {
                                feedbackStatus.textContent = "Scan context missing. Re-open email and scan again.";
                            } else if (result.error === "UNAUTHORIZED") {
                                feedbackStatus.textContent = "Sign in to send feedback.";
                            } else {
                                feedbackStatus.textContent = "Feedback failed. Try again.";
                            }
                            return;
                        }

                        feedbackButtons.forEach((b) => {
                            if (b instanceof HTMLElement) {
                                if (b.dataset.label === label) b.classList.add("is-selected");
                                else b.classList.remove("is-selected");
                            }
                        });
                        feedbackStatus.textContent = `Feedback saved: ${String(label).toUpperCase()}`;
                    }
                );
            });
        });
    }

    // --- TRACKING CLICKS ON SUSPICIOUS LINKS ---
    if (isHighRisk) {
        const links = target.querySelectorAll('a[href]');
        links.forEach(link => {
            link.addEventListener('click', function () {
                chrome.runtime.sendMessage({
                    action: "user_action_click_suspicious_link",
                    link: link.href,
                    emailUrl: location.href
                });
            }, { once: true });
        });
    }
}

// Debounce scan to avoid multiple calls during render
function scheduleScan(delayMs = 500) {
    if (scanTimeout) {
        clearTimeout(scanTimeout);
    }
    scanTimeout = setTimeout(() => {
        void triggerScan().catch((error) => {
            console.warn("PhishGuard: scheduled scan failed", error);
        });
    }, delayMs);
}

function scheduleScanBurst() {
    scanBurstGeneration += 1;
    const generation = scanBurstGeneration;

    SCAN_BURST_DELAYS_MS.forEach((delayMs) => {
        setTimeout(() => {
            if (generation !== scanBurstGeneration) {
                return;
            }
            void triggerScan().catch((error) => {
                console.warn("PhishGuard: burst scan failed", error);
            });
        }, delayMs);
    });
}

function resetScanUiState() {
    lastScannedTextHash = "";
    lastDismissedTextHash = "";
    lastScanResult = null;
    scanInFlight = false;
    removeScanPrompt();
    removeScanFlag();
    removeScanContainer();
}

function startInboxWatchers() {
    const emailRoot = document.querySelector('div[role="main"]') || document.body;

    new MutationObserver((mutations) => {
        let shouldScan = false;
        for (const mutation of mutations) {
            if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
                shouldScan = true;
                break;
            }
            if (mutation.type === "characterData") {
                shouldScan = true;
                break;
            }
        }
        if (shouldScan) {
            scheduleScan(450);
        }
    }).observe(emailRoot, {
        childList: true,
        subtree: true,
        characterData: true
    });

    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url === lastUrl) {
            return;
        }
        lastUrl = url;
        resetScanUiState();
        scheduleScanBurst();
    }).observe(document, { subtree: true, childList: true });

    scheduleScanBurst();
}

// --- 4. OBSERVERS ---
ensureStyles();
startInboxWatchers();

// --- 5. AUTH HANDOFF LISTENER ---
window.addEventListener("message", (event) => {
  // We only accept messages from ourselves
  if (event.source !== window) return;

  if (event.data.type && event.data.type === "PHISHGUARD_AUTH_SUCCESS") {
    // console.log("ContentScript: Received auth token from page");
    
    chrome.runtime.sendMessage({
        action: "AUTH_HANDOFF",
        token: event.data.token,
        context: event.data.context || null,
        user: event.data.user,
        account: event.data.account,
        subscription: event.data.subscription,
        activity: event.data.activity,
        recentScans: event.data.recentScans,
        keys: event.data.keys || null,
        deepScanPublicKey: event.data.deepScanPublicKey || null,
        analyzePayloadPublicKey: event.data.analyzePayloadPublicKey || null
    }, (response) => {
        // console.log("ContentScript: Handed off to background", response);
    });
  }

  if (event.data.type && event.data.type === "PHISHGUARD_LOGOUT") {
     chrome.runtime.sendMessage({ action: "LOGOUT" });
  }
});
