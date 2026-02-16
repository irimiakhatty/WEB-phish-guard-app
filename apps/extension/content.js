// --- CONFIGURATION ---
let lastScannedTextHash = "";
let scanTimeout = null;
let lastScannedText = "";

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
const MAX_DEEP_SCAN_CHARS = 5000;

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

function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
        .pg-flag {
            font-family: "Manrope", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
            display: flex;
            gap: 12px;
            align-items: flex-start;
            border-radius: 14px;
            border: 2px solid var(--pg-border);
            background: var(--pg-bg);
            color: var(--pg-text);
            padding: 12px 14px;
            margin: 12px 0;
            box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
            animation: pg-in 220ms ease-out;
        }
        .pg-flag--compact {
            padding: 8px 12px;
            align-items: center;
        }
        .pg-flag--compact .pg-flag__desc {
            display: none;
        }
        .pg-flag__icon {
            width: 34px;
            height: 34px;
            border-radius: 999px;
            background: var(--pg-icon-bg);
            color: var(--pg-icon);
            display: flex;
            align-items: center;
            justify-content: center;
            flex: 0 0 34px;
            animation: pg-pop 220ms ease-out;
        }
        .pg-flag__icon.pg-pulse {
            animation: pg-pop 220ms ease-out, pg-pulse 1.6s ease-out 1;
        }
        .pg-flag__icon svg {
            width: 18px;
            height: 18px;
            stroke: currentColor;
        }
        .pg-flag__content {
            display: flex;
            flex-direction: column;
            gap: 6px;
            min-width: 0;
        }
        .pg-flag__header {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }
        .pg-flag__title {
            font-weight: 700;
            font-size: 14px;
        }
        .pg-flag__badge {
            font-size: 11px;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            padding: 2px 8px;
            border-radius: 999px;
            background: var(--pg-badge-bg);
            color: var(--pg-badge-text);
            border: 1px solid var(--pg-badge-border);
        }
        .pg-flag__desc {
            font-size: 12px;
            color: var(--pg-muted);
        }
        .pg-flag__meta {
            font-size: 11px;
            color: var(--pg-muted);
        }
        .pg-flag__actions {
            margin-top: 2px;
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        .pg-flag__cta {
            border: none;
            background: #2563eb;
            color: #fff;
            font-size: 11px;
            font-weight: 600;
            padding: 6px 10px;
            border-radius: 999px;
            cursor: pointer;
        }
        .pg-flag__cta[disabled] {
            opacity: 0.7;
            cursor: default;
        }
        .pg-flag__cta--ghost {
            background: transparent;
            color: #2563eb;
            border: 1px solid #bfdbfe;
        }
        .pg-flag__ai {
            font-size: 11px;
            color: var(--pg-muted);
            background: rgba(255, 255, 255, 0.7);
            border: 1px dashed var(--pg-border);
            padding: 6px 8px;
            border-radius: 10px;
        }
        .pg-flag--safe {
            --pg-bg: #f0fdf4;
            --pg-border: #bbf7d0;
            --pg-text: #14532d;
            --pg-muted: #166534;
            --pg-icon-bg: #22c55e;
            --pg-icon: #ffffff;
            --pg-badge-bg: #dcfce7;
            --pg-badge-text: #166534;
            --pg-badge-border: #86efac;
        }
        .pg-flag--low {
            --pg-bg: #eff6ff;
            --pg-border: #bfdbfe;
            --pg-text: #1e3a8a;
            --pg-muted: #1e40af;
            --pg-icon-bg: #3b82f6;
            --pg-icon: #ffffff;
            --pg-badge-bg: #dbeafe;
            --pg-badge-text: #1e40af;
            --pg-badge-border: #bfdbfe;
        }
        .pg-flag--medium {
            --pg-bg: #fffbeb;
            --pg-border: #fde68a;
            --pg-text: #78350f;
            --pg-muted: #92400e;
            --pg-icon-bg: #f59e0b;
            --pg-icon: #ffffff;
            --pg-badge-bg: #fef3c7;
            --pg-badge-text: #92400e;
            --pg-badge-border: #fcd34d;
        }
        .pg-flag--high {
            --pg-bg: #fef2f2;
            --pg-border: #fecaca;
            --pg-text: #7f1d1d;
            --pg-muted: #991b1b;
            --pg-icon-bg: #ef4444;
            --pg-icon: #ffffff;
            --pg-badge-bg: #fee2e2;
            --pg-badge-text: #991b1b;
            --pg-badge-border: #fecaca;
        }
        .pg-flag--critical {
            --pg-bg: #fee2e2;
            --pg-border: #fca5a5;
            --pg-text: #7f1d1d;
            --pg-muted: #b91c1c;
            --pg-icon-bg: #dc2626;
            --pg-icon: #ffffff;
            --pg-badge-bg: #fecaca;
            --pg-badge-text: #7f1d1d;
            --pg-badge-border: #fca5a5;
        }
        @keyframes pg-in {
            from { opacity: 0; transform: translateY(-6px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pg-pop {
            0% { opacity: 0; transform: scale(0.9); }
            70% { opacity: 1; transform: scale(1.05); }
            100% { transform: scale(1); }
        }
        @keyframes pg-pulse {
            0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.35); }
            70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
            100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
    `;
    document.head.appendChild(style);
}

function buildIconSvg(type) {
    if (type === "check") {
        return `<svg viewBox="0 0 24 24" fill="none"><path d="M6 12.5l4 4L18 9" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }
    return `<svg viewBox="0 0 24 24" fill="none"><path d="M12 3l9 16H3l9-16z" stroke-width="2" stroke-linejoin="round"/><path d="M12 9v4" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17" r="1.2" fill="currentColor"/></svg>`;
}

// --- 1. UTILS ---
console.log("PhishGuard Content Script Loaded on:", location.href);

function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
}

// --- 2. TEXT EXTRACTION ---
function getEmailContent() {
    let bodyText = "";

    // GMAIL SELECTORS
    // .a3s.aiL = Message body container
    // .hP = Subject line (optional, but good for context)
    const gmailBodies = document.querySelectorAll('.a3s.aiL');
    if (gmailBodies.length > 0) {
        // Get the last one (usually the open email in conversation view)
        // Or concatenate all? Let's take the last visible one.
        for (let i = gmailBodies.length - 1; i >= 0; i--) {
            if (gmailBodies[i].offsetParent !== null) { // Check visibility
                bodyText += gmailBodies[i].innerText + "\n";
                break; // Only scan the latest/active email
            }
        }
    }

    // OUTLOOK SELECTORS
    // [aria-label="Message body"]
    const outlookBody = document.querySelector('[aria-label="Message body"]');
    if (outlookBody) {
        bodyText += outlookBody.innerText;
    }

    // Fallback for Outlook Reading Pane
    if (!bodyText) {
        const readingPane = document.querySelector('.ReadingPane');
        if (readingPane) bodyText += readingPane.innerText;
    }

    return bodyText.trim().substring(0, 3000); // Limit to 3000 chars
}

function getEmailTarget() {
    const gmailBodies = document.querySelectorAll('.a3s.aiL');
    if (gmailBodies.length > 0) {
        for (let i = gmailBodies.length - 1; i >= 0; i--) {
            if (gmailBodies[i].offsetParent !== null) {
                return gmailBodies[i];
            }
        }
        return gmailBodies[gmailBodies.length - 1];
    }

    return document.querySelector('[aria-label="Message body"]') || document.querySelector('.ReadingPane');
}

// --- 3. SCANNING LOGIC ---
function triggerScan() {
    const text = getEmailContent();
    const url = location.href;

    // 1. Validation
    if (text.length < 50) return; // Too short

    // 2. Deduplication
    const currentHash = hashCode(text);
    if (currentHash === lastScannedTextHash) return; // Already scanned

    lastScannedTextHash = currentHash;
    lastScannedText = text;
    console.log("PhishGuard: Auto-scanning new content...");

    // 3. Send to Background
    chrome.runtime.sendMessage({
        action: "scan_page",
        source: "auto",
        text: text,
        url: url
    }, (response) => {
        if (chrome.runtime.lastError) return;
        // --- INJECT VISUAL FLAG ---
        injectScanFlag(response);
    });
}

function injectScanFlag(response) {
    if (!response || response.error) return;

    // Remove previous flag if exists
    const oldFlag = document.getElementById(FLAG_ID);
    if (oldFlag) oldFlag.remove();

    // Find email body (Gmail/Outlook)
    const target = getEmailTarget();
    if (!target) return;

    ensureStyles();

    const overallScore = getOverallScore(response);
    const riskLevel = response.riskLevel || getRiskLevelFromScore(overallScore);
    const attackType = response.attackType || "Other";

    const copy = {
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

    const config = copy[riskLevel] || copy.medium;
    const isCompact = riskLevel === "safe" || riskLevel === "low";
    const showDeepScan = riskLevel === "medium" || riskLevel === "high";
    const isHighRisk = riskLevel === "high" || riskLevel === "critical";

    const metaParts = [`Risk score: ${formatPercent(overallScore)}`];
    if (!isCompact && attackType && attackType !== "Other") {
        metaParts.push(`Attack type: ${attackType}`);
    }

    const iconSvg = buildIconSvg(config.icon);
    const pulseClass = isHighRisk ? "pg-pulse" : "";

    const flag = document.createElement('div');
    flag.id = FLAG_ID;
    flag.className = `pg-flag pg-flag--${riskLevel} ${isCompact ? "pg-flag--compact" : ""}`;
    flag.innerHTML = `
        <div class="pg-flag__icon ${pulseClass}">${iconSvg}</div>
        <div class="pg-flag__content">
            <div class="pg-flag__header">
                <span class="pg-flag__title">${config.title}</span>
                <span class="pg-flag__badge">${config.badge}</span>
            </div>
            <div class="pg-flag__desc">${config.description}</div>
            <div class="pg-flag__meta">${metaParts.join(" | ")}</div>
            ${showDeepScan ? `<div class="pg-flag__actions"><button class="pg-flag__cta">Deep Scan with AI</button></div>` : ""}
            <div class="pg-flag__ai" style="display:none;"></div>
        </div>
    `;

    // Insert at top of email body
    target.prepend(flag);

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
                deepScanButton.textContent = "Deep Scan with AI";

                if (chrome.runtime.lastError || !result) {
                    deepScanResult.style.display = "block";
                    deepScanResult.textContent = "Deep scan failed. Try again.";
                    return;
                }

                if (result.error) {
                    deepScanResult.style.display = "block";
                    if (result.error === "PAYWALL") {
                        deepScanResult.textContent = "Deep Scan with AI is available on paid plans.";
                        deepScanButton.classList.add("pg-flag__cta--ghost");
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
                const aiRisk = data.riskLevel ? String(data.riskLevel).toUpperCase() : "RESULT";
                const aiScore = typeof data.overallScore === "number" ? formatPercent(data.overallScore) : "";
                const analysis = typeof data.analysis === "string" ? data.analysis : "Deep scan completed.";
                const trimmed = analysis.length > 160 ? `${analysis.slice(0, 157)}...` : analysis;

                deepScanResult.style.display = "block";
                deepScanResult.textContent = `${aiRisk}${aiScore ? ` (${aiScore})` : ""}: ${trimmed}`;
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
function scheduleScan() {
    if (scanTimeout) clearTimeout(scanTimeout);
    scanTimeout = setTimeout(triggerScan, 2000); // Wait 2s for full render
}

// --- 4. OBSERVERS ---

// A. URL Change Observer (for SPA navigation)
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        lastScannedTextHash = ""; // Reset hash on navigation
        scheduleScan();
    }
}).observe(document, { subtree: true, childList: true });

// B. DOM Mutation Observer (for email content loading)
const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
            scheduleScan();
            break;
        }
    }
});

// Start observing
observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Initial Scan
scheduleScan();

// --- 5. AUTH HANDOFF LISTENER ---
window.addEventListener("message", (event) => {
  // We only accept messages from ourselves
  if (event.source !== window) return;

  if (event.data.type && event.data.type === "PHISHGUARD_AUTH_SUCCESS") {
    // console.log("ContentScript: Received auth token from page");
    
    chrome.runtime.sendMessage({
        action: "AUTH_HANDOFF",
        token: event.data.token,
        user: event.data.user,
        subscription: event.data.subscription
    }, (response) => {
        // console.log("ContentScript: Handed off to background", response);
    });
  }

  if (event.data.type && event.data.type === "PHISHGUARD_LOGOUT") {
     chrome.runtime.sendMessage({ action: "LOGOUT" });
  }
});
