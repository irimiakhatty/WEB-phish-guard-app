const DEFAULT_API_URL = "https://phish-guard-rho.vercel.app";
const LOCAL_DEV_API_URL = "http://localhost:3001";

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

async function fetchExtensionContext(apiUrl, token) {
  const response = await fetch(`${apiUrl}/api/v1/extension/context`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.success || !payload?.data) {
    throw new Error(payload?.error || "Invalid token or connection failed");
  }

  return payload.data;
}

async function save_options() {
  const autoScan = document.getElementById("autoScan").checked;
  let apiUrl = document.getElementById("apiUrl").value.trim() || DEFAULT_API_URL;
  const apiToken = document.getElementById("apiToken").value.trim();
  const status = document.getElementById("status");
  const saveBtn = document.getElementById("save");

  if (!apiToken) {
    await chrome.storage.sync.set({ autoScan, apiUrl });
    try {
      await sendRuntimeMessage({ action: "LOGOUT" });
    } catch (_error) {
      // Ignore runtime cleanup failures and keep the new URL saved.
    }
    status.textContent = "Settings saved. Use Sign In / Sign Up in the main extension popup to connect your account.";
    status.className = "success";
    status.style.display = "block";
    setTimeout(() => {
      status.style.display = "none";
    }, 4000);
    return;
  }

  if (apiUrl.endsWith("/")) {
    apiUrl = apiUrl.slice(0, -1);
  }

  saveBtn.disabled = true;
  saveBtn.innerText = "Verifying...";

  try {
    const context = await fetchExtensionContext(apiUrl, apiToken);
    await chrome.storage.sync.set({ autoScan, apiUrl });
    await sendRuntimeMessage({ action: "AUTH_HANDOFF", token: apiToken, context });
    status.textContent = `Settings saved for ${context.user.email} on ${context.subscription.planName}.`;
    status.className = "success";
    status.style.display = "block";
    setTimeout(() => {
      status.style.display = "none";
    }, 3000);
  } catch (error) {
    status.textContent = `Error: ${error instanceof Error ? error.message : "Could not save settings"}`;
    status.className = "error";
    status.style.display = "block";
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerText = "Save Settings";
  }
}

function restore_options() {
  chrome.storage.sync.get(
    {
      autoScan: true,
      apiUrl: DEFAULT_API_URL,
      apiToken: "",
    },
    function (items) {
      document.getElementById("autoScan").checked = items.autoScan;
      document.getElementById("apiUrl").value = items.apiUrl;
      document.getElementById("apiToken").value = items.apiToken || "";
    }
  );
}

document.addEventListener("DOMContentLoaded", restore_options);
document.getElementById("useLiveApp").addEventListener("click", () => {
  document.getElementById("apiUrl").value = DEFAULT_API_URL;
});
document.getElementById("useLocalDev").addEventListener("click", () => {
  document.getElementById("apiUrl").value = LOCAL_DEV_API_URL;
});
document.getElementById("save").addEventListener("click", () => {
  void save_options();
});
