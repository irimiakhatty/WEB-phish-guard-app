const DEFAULT_API_URL = "https://phish-guard-rho.vercel.app";
const POPUP_SCAN_TIMEOUT_MS = 10000;
const POPUP_SCAN_SLOW_HINT_MS = 3500;
let activeScanId = 0;

const SCAN_ERROR_MESSAGES = {
  TIMEOUT: "Analysis is taking longer than expected. Keep the popup open or try again.",
  AUTO_UNAVAILABLE: "Inbox analysis could not reach the server. Set API URL to your running app in extension settings.",
  ANALYZE_FAILED: "Analysis failed. Check your connection and API URL in settings.",
  ANALYZE_UNAVAILABLE: "Server analysis is unavailable. Sign in again or verify the app URL.",
  NETWORK_ERROR: "Could not reach the PhishGuard server.",
  RUNTIME_ERROR: "Extension service is unavailable. Reload the extension and try again.",
  UNKNOWN_ERROR: "Something went wrong during analysis.",
};
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
  "analyzePayloadPublicKey",
];

const loginSection = document.getElementById("login-section");
const scanSection = document.getElementById("scan-section");
const loginBtn = document.getElementById("loginBtn");
const openSettingsBtn = document.getElementById("openSettingsBtn");
const logoutBtn = document.getElementById("logoutBtn");
const dashboardBtn = document.getElementById("dashboardBtn");
const subscriptionInfo = document.getElementById("subscriptionInfo");
const statusTitle = document.getElementById("statusTitle");
const statusSubtitle = document.getElementById("statusSubtitle");
const scanBtn = document.getElementById("scanBtn");
const resultDiv = document.getElementById("result");
const loader = document.getElementById("loader");
const loginError = document.getElementById("loginError");

const toggleManualAuth = document.getElementById("toggleManualAuth");
const manualAuthBox = document.getElementById("manualAuthBox");
const manualTokenInput = document.getElementById("manualTokenInput");
const saveTokenBtn = document.getElementById("saveTokenBtn");

const accountPanel = document.getElementById("accountPanel");
const accountSummary = document.getElementById("accountSummary");
const usageSummary = document.getElementById("usageSummary");

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

function isTrialExpired(status) {
  return status === "trial_expired";
}

function formatTrialPlanName(planName) {
  const safeName = String(planName || "Free").trim();
  return /trial$/i.test(safeName) ? safeName : `${safeName} trial`;
}

function setPlanChip(text, variant) {
  if (!subscriptionInfo) {
    return;
  }

  subscriptionInfo.textContent = text;
  subscriptionInfo.className = `plan-chip plan-chip--${variant}`;
}

function clearLoginError() {
  if (!loginError) {
    return;
  }

  loginError.textContent = "";
  loginError.classList.add("hidden");
}

function showLoginError(message) {
  if (!loginError) {
    return;
  }

  loginError.textContent = message;
  loginError.classList.remove("hidden");
}

async function readExtensionState() {
  const syncData = await chrome.storage.sync.get({
    apiUrl: DEFAULT_API_URL,
    authToken: null,
    apiToken: null,
    userPlan: null,
    subscriptionStatus: null,
    userRole: "user",
    userName: "",
    userEmail: "",
    planName: "Free",
    subscriptionType: "none",
    scansRemaining: 0,
    scansUsed: 0,
    scansLimit: 0,
    organizationName: null,
    organizationSlug: null,
    workspaceType: "personal",
  });
  const localData = await chrome.storage.local.get({
    authToken: null,
    apiToken: null,
    extensionAccount: null,
  });

  return {
    ...syncData,
    ...localData,
    apiUrl: syncData.apiUrl || DEFAULT_API_URL,
  };
}

async function refreshContextIfPossible() {
  try {
    await sendRuntimeMessage({ action: "REFRESH_CONTEXT" });
  } catch (_error) {
    // Ignore refresh failures in popup and fall back to cached storage.
  }
}

function normalizeRiskLevel(level) {
  if (typeof level !== "string") {
    return "safe";
  }

  const normalized = level.toLowerCase();
  if (["safe", "low", "medium", "high", "critical"].includes(normalized)) {
    return normalized;
  }

  return "safe";
}

function showLoginUI() {
  loginSection.classList.remove("hidden");
  scanSection.classList.add("hidden");

  if (logoutBtn) logoutBtn.classList.add("hidden");
  if (dashboardBtn) dashboardBtn.classList.add("hidden");
  if (accountPanel) accountPanel.classList.add("hidden");
}

function renderAccountContext(data) {
  if (!accountPanel || !accountSummary || !usageSummary) {
    return;
  }

  const identity = data.userName || data.userEmail || "Connected account";
  const orgName = data.organizationName || data.extensionAccount?.account?.organizationName;
  const workspaceLabel = orgName ? `${identity} on ${orgName}` : identity;
  const scansUsed = Number(data.scansUsed || data.extensionAccount?.subscription?.scansUsed || 0);
  const scansLimit = Number(data.scansLimit || data.extensionAccount?.subscription?.scansLimit || 0);
  const scansRemaining = Number(
    data.scansRemaining || data.extensionAccount?.subscription?.scansRemaining || 0
  );
  const role = data.userRole || data.extensionAccount?.user?.role;
  const planId = data.userPlan || data.extensionAccount?.subscription?.planId || null;
  const subscriptionStatus =
    data.subscriptionStatus || data.extensionAccount?.subscription?.status || null;

  accountSummary.textContent = workspaceLabel;

  if (isAdminRole(role)) {
    usageSummary.textContent = "Admin access";
  } else if (isTrialExpired(subscriptionStatus)) {
    usageSummary.textContent = "Trial ended - upgrade required";
  } else if (isTrialStatus(subscriptionStatus)) {
    usageSummary.textContent = "Trial active - live inbox checks enabled";
  } else if (scansLimit > 0) {
    usageSummary.textContent = `${scansUsed}/${scansLimit} used - ${scansRemaining} left`;
  } else if (!isLimitedPlan(planId, role)) {
    usageSummary.textContent = "Unlimited realtime scans";
  } else {
    usageSummary.textContent = "Usage sync pending";
  }

  accountPanel.classList.remove("hidden");
}

function renderProtectionState(data) {
  const role = data.userRole || data.extensionAccount?.user?.role;
  const planId = data.userPlan || data.extensionAccount?.subscription?.planId || null;
  const planName = data.planName || data.extensionAccount?.subscription?.planName || "Free";
  const subscriptionStatus =
    data.subscriptionStatus || data.extensionAccount?.subscription?.status || null;
  const scansRemaining = Number(
    data.scansRemaining || data.extensionAccount?.subscription?.scansRemaining || 0
  );
  const limitedPlan = isLimitedPlan(planId, role);

  if (role === "super_admin") {
    setPlanChip("Super Admin - Unlimited", "admin");
    if (statusTitle) statusTitle.textContent = "Realtime inbox analysis is active";
    if (statusSubtitle) {
      statusSubtitle.textContent =
        "Every opened email is checked automatically and flagged in your inbox without any scan limit.";
    }
    return;
  }

  if (role === "admin") {
    setPlanChip("Admin access - Unlimited", "admin");
    if (statusTitle) statusTitle.textContent = "Organization inbox protection is live";
    if (statusSubtitle) {
      statusSubtitle.textContent =
        "Opened emails are analyzed automatically and flagged in real time across the workspace.";
    }
    return;
  }

  if (limitedPlan && isTrialExpired(subscriptionStatus)) {
    setPlanChip(`${formatTrialPlanName(planName)} - Ended`, "warning");
    if (statusTitle) statusTitle.textContent = "Trial ended";
    if (statusSubtitle) {
      statusSubtitle.textContent =
        "Upgrade to restore automatic inbox analysis and keep safe or warning flags appearing in real time.";
    }
    return;
  }

  if (limitedPlan && isTrialStatus(subscriptionStatus)) {
    setPlanChip(`${formatTrialPlanName(planName)} - Live protection`, "active");
    if (statusTitle) statusTitle.textContent = "Trial inbox protection is active";
    if (statusSubtitle) {
      statusSubtitle.textContent =
        "During the trial, opened emails are analyzed automatically and flagged in real time without asking before each scan.";
    }
    return;
  }

  if (limitedPlan && scansRemaining <= 0) {
    setPlanChip(`${planName} - Limit reached`, "warning");
    if (statusTitle) statusTitle.textContent = "Scan limit reached";
    if (statusSubtitle) {
      statusSubtitle.textContent =
        "Automatic inbox analysis pauses until your scans reset or you upgrade to an unlimited plan.";
    }
    return;
  }

  if (limitedPlan) {
    setPlanChip(`${planName} - ${scansRemaining} left`, "limited");
    if (statusTitle) statusTitle.textContent = "Ask before each inbox scan";
    if (statusSubtitle) {
      statusSubtitle.textContent =
        "For scan-limited plans, PhishGuard asks for confirmation before analyzing an opened email because each check costs 1 scan.";
    }
    return;
  }

  setPlanChip(`${planName} - Live protection`, "active");
  if (statusTitle) statusTitle.textContent = "Realtime inbox analysis is active";
  if (statusSubtitle) {
    statusSubtitle.textContent =
      "Emails are analyzed automatically and flagged as safe or risky the moment you open them.";
  }
}

function showScanUI(data) {
  loginSection.classList.add("hidden");
  scanSection.classList.remove("hidden");

  if (logoutBtn) logoutBtn.classList.remove("hidden");
  if (dashboardBtn) dashboardBtn.classList.remove("hidden");

  renderProtectionState(data);
  renderAccountContext(data);
}

async function checkAuth() {
  await refreshContextIfPossible();
  const data = await readExtensionState();
  const token = data.apiToken || data.authToken;

  if (token) {
    clearLoginError();
    showScanUI(data);
  } else {
    showLoginUI();
  }
}

async function login() {
  const items = await chrome.storage.sync.get({ apiUrl: DEFAULT_API_URL });
  chrome.tabs.create({ url: `${items.apiUrl}/ext-auth` });
}

function openSettings() {
  void chrome.runtime.openOptionsPage();
}

async function logout() {
  try {
    await sendRuntimeMessage({ action: "LOGOUT" });
  } catch (_error) {
    // Ignore background failures and clear local state anyway.
  }

  await chrome.storage.sync.remove(AUTH_STORAGE_KEYS);
  await chrome.storage.local.remove(AUTH_STORAGE_KEYS);
  clearLoginError();
  showLoginUI();
}

function openDashboard() {
  chrome.storage.sync.get({ apiUrl: DEFAULT_API_URL }, (items) => {
    chrome.tabs.create({ url: `${items.apiUrl}/dashboard` });
  });
}

function getScanErrorMessage(errorCode) {
  if (typeof errorCode !== "string") {
    return SCAN_ERROR_MESSAGES.UNKNOWN_ERROR;
  }
  return SCAN_ERROR_MESSAGES[errorCode] || SCAN_ERROR_MESSAGES.UNKNOWN_ERROR;
}

function renderScanError(message, variant = "neutral") {
  if (!resultDiv) {
    return;
  }
  resultDiv.className = `result-card result-${variant}`;
  resultDiv.innerHTML = `
    <div class="result-card__title">Analysis unavailable</div>
    <div class="result-card__meta">${escapeHtml(message)}</div>
  `;
}

function getResultVariant(riskLevel, isPhishing, hardBlock) {
  if (hardBlock || isPhishing || riskLevel === "high" || riskLevel === "critical") {
    return "phish";
  }
  if (riskLevel === "medium" || riskLevel === "low") {
    return "warn";
  }
  return "safe";
}

function renderScanResult(response) {
  if (!resultDiv) {
    return;
  }

  if (response?.error) {
    renderScanError(getScanErrorMessage(response.error), "neutral");
    return;
  }

  const textScore = typeof response.textScore === "number" ? response.textScore : 0;
  const urlScore = typeof response.urlScore === "number" ? response.urlScore : 0;
  const heuristicScore = typeof response.heuristicScore === "number" ? response.heuristicScore : 0;
  const finalScore =
    typeof response.overallScore === "number"
      ? response.overallScore
      : Math.max(textScore, urlScore, heuristicScore);
  const riskLevel = normalizeRiskLevel(response.riskLevel);
  const policyAction = response?.policyDecision?.action;
  const hardBlock = Boolean(response.hardBlockApplied) || policyAction === "block";
  const isPhishing =
    typeof response.isPhishing === "boolean"
      ? response.isPhishing
      : riskLevel === "high" || riskLevel === "critical" || hardBlock;
  const variant = getResultVariant(riskLevel, isPhishing, hardBlock);

  const title =
    hardBlock || riskLevel === "block"
      ? "Blocked"
      : `${riskLevel} risk`;

  let meta = `${(finalScore * 100).toFixed(1)}% overall`;
  if (typeof response.confidence === "number") {
    meta += ` · ${(response.confidence * 100).toFixed(1)}% confidence`;
  }
  if (typeof response.durationMs === "number") {
    meta += ` · ${Math.round(response.durationMs)}ms`;
  }
  if (typeof policyAction === "string") {
    meta += ` · Policy ${policyAction.toUpperCase()}`;
  }

  let detailHtml = "";
  if (typeof response.analysis === "string" && response.analysis.length > 0) {
    const trimmed =
      response.analysis.length > 160
        ? `${response.analysis.slice(0, 157)}...`
        : response.analysis;
    detailHtml = `<div class="result-card__detail">${escapeHtml(trimmed)}</div>`;
  }

  resultDiv.className = `result-card result-${variant}`;
  resultDiv.innerHTML = `
    <div class="result-card__title">${escapeHtml(title)}</div>
    <div class="result-card__meta">${escapeHtml(meta)}</div>
    ${detailHtml}
  `;
}

async function fetchExtensionContext(apiUrl, token) {
  const response = await fetch(`${apiUrl}/api/v1/extension/context`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.success || !payload?.data) {
    throw new Error(payload?.error || `Failed to verify token (${response.status})`);
  }

  return payload.data;
}

if (toggleManualAuth) {
  toggleManualAuth.addEventListener("click", () => {
    manualAuthBox.classList.toggle("hidden");
  });
}

if (saveTokenBtn) {
  saveTokenBtn.addEventListener("click", async () => {
    const token = manualTokenInput.value.trim();
    if (!token) {
      return;
    }

    clearLoginError();
    saveTokenBtn.disabled = true;
    saveTokenBtn.innerText = "Verifying...";

    try {
      const syncItems = await chrome.storage.sync.get({ apiUrl: DEFAULT_API_URL });
      const context = await fetchExtensionContext(syncItems.apiUrl, token);
      await chrome.storage.sync.set({ apiUrl: syncItems.apiUrl });
      await sendRuntimeMessage({ action: "AUTH_HANDOFF", token, context });
      manualTokenInput.value = "";
      await checkAuth();
    } catch (error) {
      showLoginError(error instanceof Error ? error.message : "Token verification failed.");
    } finally {
      saveTokenBtn.disabled = false;
      saveTokenBtn.innerText = "Save token";
    }
  });
}

function setLoaderMessage(message) {
  if (!loader) {
    return;
  }
  const label = loader.querySelector("span");
  if (label) {
    label.textContent = message;
  }
}

function finishScanUi(scanId) {
  if (scanId !== activeScanId) {
    return false;
  }
  if (loader) loader.classList.add("hidden");
  if (scanBtn) scanBtn.disabled = false;
  setLoaderMessage("Analyzing suspicious content...");
  return true;
}

async function scan() {
  const urlField = document.getElementById("urlText");
  const textField = document.getElementById("emailText");
  const textInput = textField ? textField.value.trim() : "";
  const urlInput = urlField ? urlField.value.trim() : "";

  if (!textInput && !urlInput) {
    renderScanError("Enter a URL or paste suspicious content to analyze.", "neutral");
    return;
  }

  const scanId = ++activeScanId;
  if (loader) loader.classList.remove("hidden");
  if (scanBtn) scanBtn.disabled = true;
  resultDiv.innerHTML = "";
  resultDiv.className = "";
  setLoaderMessage("Analyzing suspicious content...");

  const slowHintTimer = setTimeout(() => {
    if (scanId !== activeScanId) return;
    setLoaderMessage("Still analyzing — almost there...");
  }, POPUP_SCAN_SLOW_HINT_MS);

  let response;
  try {
    response = await Promise.race([
      sendRuntimeMessage({
        action: "scan_page",
        text: textInput,
        url: urlInput,
      }),
      new Promise((resolve) => {
        setTimeout(() => resolve({ error: "TIMEOUT" }), POPUP_SCAN_TIMEOUT_MS);
      }),
    ]);
  } catch (runtimeError) {
    console.error(runtimeError);
    if (!finishScanUi(scanId)) return;
    renderScanError(getScanErrorMessage("RUNTIME_ERROR"), "neutral");
    return;
  } finally {
    clearTimeout(slowHintTimer);
  }

  if (!finishScanUi(scanId)) return;

  if (!response) {
    renderScanError("No response from the analysis service.", "neutral");
    return;
  }

  if (response.error === "LIMIT_REACHED") {
    const data = await readExtensionState();
    const subscriptionStatus =
      data.subscriptionStatus || data.extensionAccount?.subscription?.status || null;
    resultDiv.className = "result-card result-phish";
    resultDiv.innerHTML = `
      <div class="result-card__title">${
        isTrialExpired(subscriptionStatus) ? "Trial ended" : "Monthly limit reached"
      }</div>
      <div class="result-card__meta">${
        isTrialExpired(subscriptionStatus)
          ? "Upgrade to restore automatic inbox analysis and manual scans."
          : "Upgrade your plan for unlimited realtime inbox analysis."
      }</div>
    `;
    showScanUI(data);
    return;
  }

  if (response.error === "UNAUTHORIZED") {
    await logout();
    return;
  }

  if (response.error) {
    renderScanError(getScanErrorMessage(response.error), "neutral");
    return;
  }

  renderScanResult(response);
  const data = await readExtensionState();
  showScanUI(data);
}

if (loginBtn) loginBtn.addEventListener("click", login);
if (openSettingsBtn) openSettingsBtn.addEventListener("click", openSettings);
if (logoutBtn) logoutBtn.addEventListener("click", logout);
if (dashboardBtn) dashboardBtn.addEventListener("click", openDashboard);
if (scanBtn) scanBtn.addEventListener("click", scan);

window.addEventListener("DOMContentLoaded", () => {
  void checkAuth();

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0] && tabs[0].url) {
      const urlInput = document.getElementById("urlText");
      if (urlInput) {
        urlInput.value = tabs[0].url;
      }
    }
  });
});
