// Lightweight bridge injected on the PhishGuard web app only.
// Relays the auth handoff/logout postMessage from the page to the
// background service worker. Deliberately does NOT include any of the
// Gmail/Outlook inbox-scanning logic from content.js (MutationObservers,
// scan bursts, etc.) — running that machinery against a highly dynamic
// React page caused the extension to flood the background with messages
// on every DOM mutation.
window.addEventListener("message", (event) => {
  // We only accept messages from ourselves
  if (event.source !== window) return;

  if (event.data.type && event.data.type === "PHISHGUARD_AUTH_SUCCESS") {
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
    }, () => {});
  }

  if (event.data.type && event.data.type === "PHISHGUARD_LOGOUT") {
     chrome.runtime.sendMessage({ action: "LOGOUT" });
  }
});
