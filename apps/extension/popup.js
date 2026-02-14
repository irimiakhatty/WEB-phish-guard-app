// --- POPUP LOGIC ---

// DOM Elements
const loginSection = document.getElementById('login-section');
const scanSection = document.getElementById('scan-section');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const dashboardBtn = document.getElementById('dashboardBtn');
const loginError = document.getElementById('loginError');
const subscriptionInfo = document.getElementById('subscriptionInfo');
const scanBtn = document.getElementById('scanBtn');
const resultDiv = document.getElementById('result');
const loader = document.getElementById('loader');

// Manual Auth Elements
const toggleManualAuth = document.getElementById('toggleManualAuth');
const manualAuthBox = document.getElementById('manualAuthBox');
const manualTokenInput = document.getElementById('manualTokenInput');
const saveTokenBtn = document.getElementById('saveTokenBtn');

// --- AUTHENTICATION ---

async function checkAuth() {
  // Try sync first, then local
  let data = await chrome.storage.sync.get(['authToken', 'apiToken', 'userPlan', 'userRole', 'scansRemaining']);
  
  if (!data || (!data.authToken && !data.apiToken)) {
     // Fallback to local
     data = await chrome.storage.local.get(['authToken', 'apiToken', 'userPlan', 'userRole', 'scansRemaining']);
  }

  const { authToken, apiToken, userPlan, userRole, scansRemaining } = data || {};
  const token = apiToken || authToken;

  if (token) {
    showScanUI(userPlan, scansRemaining, userRole);
  } else {
    showLoginUI();
  }
}

function showLoginUI() {
  loginSection.classList.remove('hidden');
  scanSection.classList.add('hidden');
  
  // Hide header actions when not logged in
  if (logoutBtn) logoutBtn.classList.add('hidden');
  if (dashboardBtn) dashboardBtn.classList.add('hidden');
}

// Manual Auth Logic
toggleManualAuth.addEventListener('click', () => {
    manualAuthBox.classList.toggle('hidden');
});

saveTokenBtn.addEventListener('click', () => {
    const token = manualTokenInput.value.trim();
    if (!token) return;

    // Default to free plan if we don't know
    const data = {
        authToken: token,
        apiToken: token, 
        userPlan: 'free', 
        scansRemaining: 10
    };
    
    // Save locally
    chrome.storage.sync.set(data);
    chrome.storage.local.set(data, () => {
         checkAuth(); // Refresh UI
    });
});

// Event Listeners for Buttons
if (loginBtn) loginBtn.addEventListener('click', login);
if (logoutBtn) logoutBtn.addEventListener('click', logout);
if (dashboardBtn) dashboardBtn.addEventListener('click', openDashboard);
if (scanBtn) scanBtn.addEventListener('click', scan);

function showScanUI(plan, scans, role) {
  loginSection.classList.add('hidden');
  scanSection.classList.remove('hidden');
  
  // Show header actions
  if (logoutBtn) logoutBtn.classList.remove('hidden');
  if (dashboardBtn) dashboardBtn.classList.remove('hidden');

  // Update Info Bar
  if (role === 'admin' || role === 'super_admin') {
    subscriptionInfo.innerText = role === 'super_admin' ? `Super Admin Access • Unlimited` : `Admin Access • Unlimited`;
    subscriptionInfo.style.color = "var(--safe-text)"; 
  } else if (!plan || plan === 'free') {
    subscriptionInfo.innerText = `Free Plan • ${scans !== undefined ? scans : 0} scans left`;
    subscriptionInfo.style.color = "var(--muted-foreground)";
  } else {
    // Any other plan (personal_pro, team, etc) is Premium
    subscriptionInfo.innerText = `Premium Plan • Protection Active`;
    subscriptionInfo.style.color = "var(--safe-text)";
  }
}

async function login() {
  // Use localhost or deployed URL from config if available (defaulting to localhost for dev)
  const items = await chrome.storage.sync.get({ apiUrl: 'http://localhost:3001' }); 
  // Assuming ext-auth page exists on the web app to handle token generation/handshake
  chrome.tabs.create({ url: `${items.apiUrl}/ext-auth` });
}

async function logout() {
  // Clear both sync and local storage
  await chrome.storage.sync.remove(['authToken', 'apiToken', 'userPlan', 'scansRemaining']);
  await chrome.storage.local.remove(['authToken', 'apiToken', 'userPlan', 'scansRemaining']);
  
  // Reset UI
  checkAuth();
}

function openDashboard() {
  chrome.storage.sync.get({ apiUrl: 'http://localhost:3001' }, (items) => {
    chrome.tabs.create({ url: `${items.apiUrl}/dashboard` });
  });
}


// --- SCANNING ---

async function scan() {
  const textInput = document.getElementById('emailText').value;
  const urlInput = document.getElementById('urlText').value;

  if (!textInput && !urlInput) {
    resultDiv.className = "result-card";
    resultDiv.style.border = "1px solid var(--border)";
    resultDiv.innerHTML = "<span style='color:var(--muted-foreground)'>Please enter text or a URL to scan.</span>";
    return;
  }

  // UI State: Loading
  if (loader) loader.classList.remove('hidden');
  if (scanBtn) scanBtn.disabled = true;
  resultDiv.innerHTML = "";
  resultDiv.className = ""; 

  try {
    // Send message to background script for analysis
    chrome.runtime.sendMessage({
      action: "scan_page",
      text: textInput,
      url: urlInput
    }, (response) => {
      
      // UI State: Done
      if (loader) loader.classList.add('hidden');
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

      // Handle Subscription Errors
      if (response.error === "LIMIT_REACHED") {
        resultDiv.className = "result-card result-phish";
        resultDiv.innerHTML = `
          <div style="font-weight: bold; color: white;">Daily Limit Reached</div>
          <div style="font-size: 0.8rem; margin-top: 0.5rem; color: var(--danger-text);">Upgrade to Premium for unlimited scans.</div>
        `;
        subscriptionInfo.innerText = `Free Plan • 0 scans left`;
        return;
      }

      // Handle Auth Errors
      if (response.error === "UNAUTHORIZED") {
        logout(); 
        return;
      }

      // Update UI with new count
      if (response.scansRemaining !== undefined) {
        chrome.storage.sync.get(['userPlan'], (items) => {
          if (items.userPlan === 'free') {
            subscriptionInfo.innerText = `Free Plan • ${response.scansRemaining} scans left`;
          }
        });
      }

      const { textScore, urlScore, heuristicScore } = response;
      
      // Calculate max score
      const finalScore = Math.max(textScore || 0, urlScore || 0, heuristicScore || 0);
      const isPhishing = finalScore > 0.5;

      if (isPhishing) {
        resultDiv.className = "result-card result-phish";
        let content = "<div><strong>⚠️ PHISHING DETECTED</strong></div>";
        
        if ((textScore || 0) > 0.5) content += `<div style='font-size:0.8rem; margin-top:0.5rem'>Suspicious Text Pattern (${Math.round(textScore * 100)}%)</div>`;
        if ((urlScore || 0) > 0.5) content += `<div style='font-size:0.8rem; margin-top:0.5rem'>Malicious URL (${Math.round(urlScore * 100)}%)</div>`;
        if ((heuristicScore || 0) > 0.5) content += `<div style='font-size:0.8rem; margin-top:0.5rem'>Suspicious Keywords Detected</div>`;
        
        resultDiv.innerHTML = content;
      } else {
        resultDiv.className = "result-card result-safe";
        resultDiv.innerHTML = "<div><strong>✅ SAFE</strong></div><div style='font-size:0.8rem; margin-top:0.5rem'>No threats detected.</div>";
      }
    });
  } catch (err) {
      if (loader) loader.classList.add('hidden');
      if (scanBtn) scanBtn.disabled = false;
      resultDiv.innerText = "An unexpected error occurred.";
  }
}

// --- EVENT LISTENERS ---

if (loginBtn) loginBtn.addEventListener('click', login);
if (logoutBtn) logoutBtn.addEventListener('click', logout);
if (dashboardBtn) dashboardBtn.addEventListener('click', openDashboard);
if (scanBtn) scanBtn.addEventListener('click', scan);

// Auto-fill active tab URL
window.addEventListener('DOMContentLoaded', () => {
  checkAuth(); 

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0] && tabs[0].url) {
      if (document.getElementById('urlText')) {
          document.getElementById('urlText').value = tabs[0].url;
      }
    }
  });
});
