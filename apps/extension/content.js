// --- CONFIGURATION ---
let lastScannedTextHash = "";
let scanTimeout = null;

// --- 1. UTILS ---
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
        // console.log("PhishGuard Auto-Scan Result:", response);
    });
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
