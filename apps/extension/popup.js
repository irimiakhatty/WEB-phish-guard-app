// --- POPUP LOGIC ---

// DOM Elements
const loginSection = document.getElementById('login-section');
const scanSection = document.getElementById('scan-section');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loginError = document.getElementById('loginError');
const subscriptionInfo = document.getElementById('subscriptionInfo');

// --- AUTHENTICATION ---

async function checkAuth() {
  const { authToken, apiToken, userPlan, scansRemaining } = await chrome.storage.sync.get(['authToken', 'apiToken', 'userPlan', 'scansRemaining']);
  const token = apiToken || authToken;

  if (token) {
    showScanUI(userPlan, scansRemaining);
  } else {
    showLoginUI();
  }
}

function showLoginUI() {
  loginSection.classList.remove('hidden');
  scanSection.classList.add('hidden');
}

function showScanUI(plan, scans) {
  loginSection.classList.add('hidden');
  scanSection.classList.remove('hidden');

  // Update Info Box
  if (plan === 'free') {
    subscriptionInfo.innerText = `Plan: Free Trial • ${scans !== undefined ? scans : 10} scans left`;
  } else if (plan === 'paid') {
    subscriptionInfo.innerText = `Plan: Premium • Unlimited Scans`;
  } else {
    subscriptionInfo.innerText = `Plan: Unknown`;
  }
}

async function login() {
  // Open the Web App Auth Page
  chrome.storage.sync.get({ apiUrl: 'http://localhost:3001' }, (items) => {
    chrome.tabs.create({ url: `${items.apiUrl}/ext-auth` });
  });
}

async function logout() {
  await chrome.storage.sync.remove(['authToken', 'apiToken', 'userPlan', 'scansRemaining']);
  checkAuth();
}

// Listen for storage changes to auto-login in popup
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && (changes.authToken || changes.apiToken)) {
    checkAuth();
  }
});

// --- SCANNING ---

async function scan() {
  const textInput = document.getElementById('emailText').value;
  const urlInput = document.getElementById('urlText').value;
  const resultDiv = document.getElementById('result');
  const loader = document.getElementById('loader');

  if (!textInput && !urlInput) {
    resultDiv.innerHTML = "<span style='color:var(--muted-foreground)'>Please enter text or a URL to scan.</span>";
    return;
  }

  loader.style.display = "block";
  resultDiv.innerHTML = "";
  resultDiv.className = ""; // Reset classes

  // Send message to background script for analysis
  chrome.runtime.sendMessage({
    action: "scan_page",
    text: textInput,
    url: urlInput
  }, (response) => {
    loader.style.display = "none";

    if (chrome.runtime.lastError) {
      resultDiv.innerText = "Error connecting to background service.";
      console.error(chrome.runtime.lastError);
      return;
    }

    // Handle Subscription Errors
    if (response.error === "LIMIT_REACHED") {
      resultDiv.innerHTML = `
        <div style="color: #dc2626; font-weight: bold;">⚠️ Limit Reached</div>
        <div style="font-size: 0.8rem; margin-top: 0.5rem;">You have used all your free scans.</div>
      `;
      // Update UI count to 0 just in case
      subscriptionInfo.innerText = `Plan: Free Trial • 0 scans left`;
      return;
    }

    // Handle Auth Errors
    if (response.error === "UNAUTHORIZED") {
      logout(); // Force logout
      return;
    }

    // Update UI with new remaining count if provided
    if (response.scansRemaining !== undefined) {
      chrome.storage.sync.get(['userPlan'], (items) => {
        if (items.userPlan === 'free') {
          subscriptionInfo.innerText = `Plan: Free Trial • ${response.scansRemaining} scans left`;
        }
      });
    }

    const { textScore, urlScore } = response;
    console.log(`Text Score: ${textScore}, URL Score: ${urlScore}`);

    if (textScore > 0.5 || urlScore > 0.5) {
      resultDiv.className = "result-phish";
      let content = "<div>⚠️ <strong>PHISHING DETECTED</strong></div>";
      if (textScore > 0.5) content += "<div style='font-size:0.8rem; margin-top:0.5rem'>Suspicious Text Content</div>";
      if (urlScore > 0.5) content += "<div style='font-size:0.8rem; margin-top:0.5rem'>Malicious URL Link</div>";
      resultDiv.innerHTML = content;
    } else {
      resultDiv.className = "result-safe";
      resultDiv.innerHTML = "<div>✅ <strong>LOOKS SAFE</strong></div><div style='font-size:0.8rem; margin-top:0.5rem'>No threats detected.</div>";
    }
  });
}

// --- EVENT LISTENERS ---

loginBtn.addEventListener('click', login);
logoutBtn.addEventListener('click', logout);
document.getElementById('scanBtn').addEventListener('click', scan);

document.getElementById('dashboardBtn').addEventListener('click', () => {
  chrome.storage.sync.get({ apiUrl: 'http://localhost:3001' }, (items) => {
    chrome.tabs.create({ url: items.apiUrl });
  });
});

// Auto-fill URL
window.addEventListener('DOMContentLoaded', () => {
  checkAuth(); // Initial Auth Check

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0] && tabs[0].url) {
      document.getElementById('urlText').value = tabs[0].url;
    }
  });
});