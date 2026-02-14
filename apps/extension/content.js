// --- CONFIGURATION ---
let lastScannedTextHash = "";
let scanTimeout = null;

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
    // Remove previous flag if exists
    const oldFlag = document.getElementById('phishguard-scan-flag');
    if (oldFlag) oldFlag.remove();

    // Find email body (Gmail/Outlook)
    let target = document.querySelector('.a3s.aiL') || document.querySelector('[aria-label="Message body"]') || document.querySelector('.ReadingPane');
    if (!target) return;

    // Create flag element
    const flag = document.createElement('div');
    flag.id = 'phishguard-scan-flag';
    flag.style.position = 'relative';
    flag.style.display = 'flex';
    flag.style.alignItems = 'center';
    flag.style.gap = '8px';
    flag.style.margin = '12px 0';
    flag.style.fontWeight = 'bold';
    flag.style.fontSize = '1rem';

    // SVGs for check/warning
    const checkSVG = `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="14" cy="14" r="14" fill="#22c55e"/><path d="M8 14l4 4 8-8" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const warnSVG = `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="14" cy="14" r="14" fill="#f43f5e"/><path d="M14 9v5" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><circle cx="14" cy="18" r="1.5" fill="#fff"/></svg>`;

    // Decide flag type
    const isPhish = response && (Math.max(response.textScore || 0, response.urlScore || 0, response.heuristicScore || 0) > 0.5);
    if (isPhish) {
        flag.innerHTML = `${warnSVG} <span style='color:#f43f5e'>Phishing Detected!</span>`;
    } else {
        flag.innerHTML = `${checkSVG} <span style='color:#22c55e'>Safe Email</span>`;
    }

    // Insert at top of email body
    target.prepend(flag);

    // --- TRACKING CLICKS ON SUSPICIOUS LINKS ---
    if (isPhish) {
        // Attach click listeners to all links in the email body
        const links = target.querySelectorAll('a[href]');
        links.forEach(link => {
            link.addEventListener('click', function (e) {
                // Send message to background for logging user action
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
