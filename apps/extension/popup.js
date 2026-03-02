// --- POPUP LOGIC ---

const loginSection = document.getElementById("login-section");
const scanSection = document.getElementById("scan-section");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const dashboardBtn = document.getElementById("dashboardBtn");
const subscriptionInfo = document.getElementById("subscriptionInfo");
const scanBtn = document.getElementById("scanBtn");
const resultDiv = document.getElementById("result");
const loader = document.getElementById("loader");

const toggleManualAuth = document.getElementById("toggleManualAuth");
const manualAuthBox = document.getElementById("manualAuthBox");
const manualTokenInput = document.getElementById("manualTokenInput");
const saveTokenBtn = document.getElementById("saveTokenBtn");

async function checkAuth() {
  let data = await chrome.storage.sync.get([
    "authToken",
    "apiToken",
    "userPlan",
    "userRole",
    "scansRemaining",
  ]);

  if (!data || (!data.authToken && !data.apiToken)) {
    data = await chrome.storage.local.get([
      "authToken",
      "apiToken",
      "userPlan",
      "userRole",
      "scansRemaining",
    ]);
  }

  const { authToken, apiToken, userPlan, userRole, scansRemaining } = data || {};
  const token = apiToken || authToken;
  if (token) showScanUI(userPlan, scansRemaining, userRole);
  else showLoginUI();
}

function showLoginUI() {
  loginSection.classList.remove("hidden");
  scanSection.classList.add("hidden");
  if (logoutBtn) logoutBtn.classList.add("hidden");
  if (dashboardBtn) dashboardBtn.classList.add("hidden");
}

function showScanUI(plan, scans, role) {
  loginSection.classList.add("hidden");
  scanSection.classList.remove("hidden");
  if (logoutBtn) logoutBtn.classList.remove("hidden");
  if (dashboardBtn) dashboardBtn.classList.remove("hidden");

  if (role === "admin" || role === "super_admin") {
    subscriptionInfo.innerText =
      role === "super_admin" ? "Super Admin Access - Unlimited" : "Admin Access - Unlimited";
    subscriptionInfo.style.color = "var(--safe-text)";
    return;
  }

  if (!plan || plan === "free") {
    subscriptionInfo.innerText = `Free Plan - ${scans !== undefined ? scans : 0} scans left`;
    subscriptionInfo.style.color = "var(--muted-foreground)";
    return;
  }

  subscriptionInfo.innerText = "Premium Plan - Protection Active";
  subscriptionInfo.style.color = "var(--safe-text)";
}

async function login() {
  const items = await chrome.storage.sync.get({ apiUrl: "http://localhost:3001" });
  chrome.tabs.create({ url: `${items.apiUrl}/ext-auth` });
}

async function logout() {
  await chrome.storage.sync.remove(["authToken", "apiToken", "userPlan", "scansRemaining"]);
  await chrome.storage.local.remove(["authToken", "apiToken", "userPlan", "scansRemaining"]);
  checkAuth();
}

function openDashboard() {
  chrome.storage.sync.get({ apiUrl: "http://localhost:3001" }, (items) => {
    chrome.tabs.create({ url: `${items.apiUrl}/dashboard` });
  });
}

function normalizeRiskLevel(level) {
  if (typeof level !== "string") return "safe";
  const normalized = level.toLowerCase();
  if (["safe", "low", "medium", "high", "critical"].includes(normalized)) return normalized;
  return "safe";
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

    if (textScore >= 0.6) {
      content += `<div style='font-size:0.8rem; margin-top:0.5rem'>Suspicious text signals (${Math.round(
        textScore * 100
      )}%)</div>`;
    }
    if (urlScore >= 0.6) {
      content += `<div style='font-size:0.8rem; margin-top:0.5rem'>Malicious URL signals (${Math.round(
        urlScore * 100
      )}%)</div>`;
    }
    if (heuristicScore >= 0.6) {
      content +=
        "<div style='font-size:0.8rem; margin-top:0.5rem'>Heuristic red flags detected</div>";
    }
    if (typeof response.analysis === "string" && response.analysis.length > 0) {
      const trimmed =
        response.analysis.length > 140
          ? `${response.analysis.slice(0, 137)}...`
          : response.analysis;
      content += `<div style='font-size:0.75rem; margin-top:0.5rem; opacity:0.9;'>${trimmed}</div>`;
    }
    if (response?.retentionPolicy && typeof response.retentionPolicy === "object") {
      const textState = response.retentionPolicy.storedText ? "stored" : "redacted";
      const urlState = response.retentionPolicy.storedUrl ? "stored" : "redacted";
      content += `<div style='font-size:0.72rem; margin-top:0.45rem; opacity:0.75;'>Privacy: text ${textState}, url ${urlState}</div>`;
    }

    resultDiv.innerHTML = content;
    return;
  }

  resultDiv.className = "result-card result-safe";
  resultDiv.innerHTML = `<div><strong>SAFE</strong></div><div style='font-size:0.8rem; margin-top:0.5rem'>Risk: ${(
    finalScore * 100
  ).toFixed(0)}% (${riskLevel.toUpperCase()})</div>`;
}

// --- MANUAL AUTH ---

if (toggleManualAuth) {
  toggleManualAuth.addEventListener("click", () => {
    manualAuthBox.classList.toggle("hidden");
  });
}

if (saveTokenBtn) {
  saveTokenBtn.addEventListener("click", () => {
    const token = manualTokenInput.value.trim();
    if (!token) return;

    const data = {
      authToken: token,
      apiToken: token,
      userPlan: "free",
      scansRemaining: 10,
    };

    chrome.storage.sync.set(data);
    chrome.storage.local.set(data, () => {
      checkAuth();
    });
  });
}

// --- SCANNING ---

async function scan() {
  const textInput = document.getElementById("emailText").value;
  const urlInput = document.getElementById("urlText").value;

  if (!textInput && !urlInput) {
    resultDiv.className = "result-card";
    resultDiv.style.border = "1px solid var(--border)";
    resultDiv.innerHTML =
      "<span style='color:var(--muted-foreground)'>Please enter text or a URL to scan.</span>";
    return;
  }

  if (loader) loader.classList.remove("hidden");
  if (scanBtn) scanBtn.disabled = true;
  resultDiv.innerHTML = "";
  resultDiv.className = "";

  try {
    chrome.runtime.sendMessage(
      {
        action: "scan_page",
        text: textInput,
        url: urlInput,
      },
      (response) => {
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
          resultDiv.className = "result-card result-phish";
          resultDiv.innerHTML = `
            <div style="font-weight: bold; color: white;">Daily Limit Reached</div>
            <div style="font-size: 0.8rem; margin-top: 0.5rem; color: var(--danger-text);">Upgrade to Premium for unlimited scans.</div>
          `;
          subscriptionInfo.innerText = "Free Plan - 0 scans left";
          return;
        }

        if (response.error === "UNAUTHORIZED") {
          logout();
          return;
        }

        if (response.scansRemaining !== undefined) {
          chrome.storage.sync.get(["userPlan"], (items) => {
            if (items.userPlan === "free") {
              subscriptionInfo.innerText = `Free Plan - ${response.scansRemaining} scans left`;
            }
          });
        }

        renderScanResult(response);
      }
    );
  } catch (_error) {
    if (loader) loader.classList.add("hidden");
    if (scanBtn) scanBtn.disabled = false;
    resultDiv.innerText = "An unexpected error occurred.";
  }
}

if (loginBtn) loginBtn.addEventListener("click", login);
if (logoutBtn) logoutBtn.addEventListener("click", logout);
if (dashboardBtn) dashboardBtn.addEventListener("click", openDashboard);
if (scanBtn) scanBtn.addEventListener("click", scan);

window.addEventListener("DOMContentLoaded", () => {
  checkAuth();

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0] && tabs[0].url) {
      const urlInput = document.getElementById("urlText");
      if (urlInput) urlInput.value = tabs[0].url;
    }
  });
});
