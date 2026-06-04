const DEFAULT_API_URL = "https://phish-guard-rho.vercel.app";
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

function renderScanResult(response) {
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

  if (isPhishing || hardBlock) {
    resultDiv.className = "result-card result-phish";
    let content = hardBlock
      ? "<div><strong>THREAT BLOCKED BY POLICY</strong></div>"
      : "<div><strong>PHISHING DETECTED</strong></div>";
    content += `<div style='font-size:0.8rem; margin-top:0.5rem'>Risk: ${(finalScore * 100).toFixed(
      0
    )}% (${riskLevel.toUpperCase()})</div>`;
    if (typeof policyAction === "string") {
      content += `<div style='font-size:0.75rem; margin-top:0.35rem; opacity:0.9;'>Policy action: ${policyAction.toUpperCase()}</div>`;
    }
    if (typeof response.analysis === "string" && response.analysis.length > 0) {
      const trimmed =
        response.analysis.length > 140
          ? `${response.analysis.slice(0, 137)}...`
          : response.analysis;
      content += `<div style='font-size:0.75rem; margin-top:0.5rem; opacity:0.9;'>${trimmed}</div>`;
    }
    resultDiv.innerHTML = content;
    return;
  }

  resultDiv.className = "result-card result-safe";
  resultDiv.innerHTML = `<div><strong>SAFE</strong></div><div style='font-size:0.8rem; margin-top:0.5rem'>Risk: ${(
    finalScore * 100
  ).toFixed(0)}% (${riskLevel.toUpperCase()})</div>`;
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

async function scan() {
  const urlField = document.getElementById("urlText");
  const textField = document.getElementById("emailText");
  const textInput = textField ? textField.value : "";
  const urlInput = urlField ? urlField.value : "";

  if (!textInput && !urlInput) {
    resultDiv.className = "result-card";
    resultDiv.innerHTML =
      "<span style='color:var(--muted-foreground)'>Please enter text or a URL to scan.</span>";
    return;
  }

  if (loader) loader.classList.remove("hidden");
  if (scanBtn) scanBtn.disabled = true;
  resultDiv.innerHTML = "";
  resultDiv.className = "";

  // Safety timeout: if sendResponse never fires (e.g. service worker crash),
  // unblock the UI after POPUP_SCAN_TIMEOUT_MS instead of hanging indefinitely.
  const POPUP_SCAN_TIMEOUT_MS = 6000;
  let responded = false;
  const timeoutHandle = setTimeout(() => {
    if (responded) return;
    responded = true;
    if (loader) loader.classList.add("hidden");
    if (scanBtn) scanBtn.disabled = false;
    resultDiv.className = "result-card";
    resultDiv.innerText = "Analysis timed out. Please try again.";
  }, POPUP_SCAN_TIMEOUT_MS);

  chrome.runtime.sendMessage(
    {
      action: "scan_page",
      text: textInput,
      url: urlInput,
    },
    async (response) => {
      if (responded) return; // already handled by timeout
      responded = true;
      clearTimeout(timeoutHandle);

      if (loader) loader.classList.add("hidden");
      if (scanBtn) scanBtn.disabled = false;

      if (chrome.runtime.lastError) {
        resultDiv.className = "result-card";
        resultDiv.innerText = "Error connecting to service.";
        console.error(chrome.runtime.lastError);
        return;
      }

      if (!response) {
        resultDiv.className = "result-card";
        resultDiv.innerText = "No response from analysis service.";
        return;
      }

      if (response.error === "LIMIT_REACHED") {
        const data = await readExtensionState();
        const subscriptionStatus =
          data.subscriptionStatus || data.extensionAccount?.subscription?.status || null;
        resultDiv.className = "result-card result-phish";
        resultDiv.innerHTML = `
          <div style="font-weight: 800;">${
            isTrialExpired(subscriptionStatus) ? "Trial ended" : "Monthly limit reached"
          }</div>
          <div style="font-size: 0.82rem; margin-top: 0.45rem;">${
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

      renderScanResult(response);
      const data = await readExtensionState();
      showScanUI(data);
    }
  );
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
