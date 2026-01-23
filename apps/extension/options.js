// Save options to chrome.storage
function save_options() {
    var autoScan = document.getElementById('autoScan').checked;
    var apiUrl = document.getElementById('apiUrl').value;
    var apiToken = document.getElementById('apiToken').value;

    const status = document.getElementById('status');
    const saveBtn = document.getElementById('save');

    // Remove trailing slash if present
    if (apiUrl.endsWith('/')) {
        apiUrl = apiUrl.slice(0, -1);
    }

    saveBtn.disabled = true;
    saveBtn.innerText = 'Verifying...';

    // Verify token with backend
    fetch(`${apiUrl}/api/v1/auth/verify`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${apiToken}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Invalid Token or Connection Failed');
        }
        return response.json();
    })
    .then(data => {
        // Save to storage if valid
        chrome.storage.sync.set({
            autoScan: autoScan,
            apiUrl: apiUrl,
            apiToken: apiToken,
            authToken: apiToken, // Keep for compatibility
            userPlan: data.data.plan,
            scansRemaining: data.data.scansRemaining
        }, function () {
            status.textContent = 'Settings saved! Plan: ' + data.data.plan;
            status.className = 'success';
            status.style.display = 'block';
            setTimeout(function () {
                status.style.display = 'none';
            }, 3000);
        });
    })
    .catch(error => {
        status.textContent = 'Error: ' + error.message;
        status.className = 'error';
        status.style.display = 'block';
    })
    .finally(() => {
        saveBtn.disabled = false;
        saveBtn.innerText = 'Save Settings';
    });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {
    chrome.storage.sync.get({
        autoScan: true,
        apiUrl: 'http://localhost:3000',
        apiToken: ''
    }, function (items) {
        document.getElementById('autoScan').checked = items.autoScan;
        document.getElementById('apiUrl').value = items.apiUrl;
        document.getElementById('apiToken').value = items.apiToken || '';
    });
}

document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);
