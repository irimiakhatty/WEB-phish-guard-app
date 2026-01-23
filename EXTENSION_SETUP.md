# Chrome Extension Setup Guide

This guide will help you integrate and test the PhishGuard Chrome extension with your local development environment.

## Prerequisites

- Docker Desktop (for PostgreSQL database)
- Node.js 18+ and npm
- Chrome browser
- ML Service running (Python FastAPI on port 5000)

## Step-by-Step Setup

### 1. Start the Database

```bash
# From project root
docker-compose up -d
```

Verify the database is running:
```bash
docker-compose ps
```

### 2. Run Database Migration

```bash
cd packages/db
npx prisma migrate dev --name add_api_tokens
npx prisma generate
cd ../..
```

This adds the `api_token` table to your database.

### 3. Start the ML Service

```bash
cd ml-service
pip install -r requirements.txt
python app.py
```

The ML service should be running on `http://localhost:5000`.

### 4. Start the Web Application

```bash
# From project root
npm install
npm run dev
```

The app will be available at `http://localhost:3001`.

### 5. Create a User Account

1. Open `http://localhost:3001` in your browser
2. Click "Sign Up" and create an account
3. Verify you can log in

### 6. Load the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Navigate to and select: `e:\phish-guard-app\apps\extension`
5. The PhishGuard extension should now appear in your extensions list
6. **Important**: Copy the Extension ID (it looks like `abcdefghijklmnopqrstuvwxyz123456`)

### 7. Authenticate the Extension

#### Method 1: Automatic (Recommended)

1. Click the PhishGuard extension icon in your Chrome toolbar
2. Click the **Login** button in the popup
3. You'll be redirected to `http://localhost:3001/ext-auth`
4. Click **Generate API Token**
5. The token will be automatically sent to your extension
6. You should see "Plan: Free Trial • 10 scans left" in the extension popup

#### Method 2: Manual

1. Open `http://localhost:3001/ext-auth` in your browser
2. Log in if prompted
3. Click **Generate API Token**
4. Copy the generated token
5. Open the extension popup and go to Options (gear icon)
6. Paste the token in the "API Token" field
7. Click Save

### 8. Test the Extension

#### Test 1: Manual Scan

1. Click the PhishGuard extension icon
2. Enter a URL in the "URL to Scan" field (e.g., `http://example.com`)
3. Click **Scan Now**
4. You should see a result: either "✅ LOOKS SAFE" or "⚠️ PHISHING DETECTED"

#### Test 2: Auto-Scan in Gmail

1. Open Gmail in a new tab: `https://mail.google.com`
2. Open any email
3. The extension will automatically scan the email content
4. Check the extension icon badge for results:
   - **SAFE** (green badge) = No threats detected
   - **WARN** (red badge) = Phishing detected
5. If phishing is detected, you'll also see a Chrome notification

#### Test 3: View Scan History

1. Click the extension icon
2. Click **View Dashboard**
3. You'll be redirected to `http://localhost:3001/dashboard`
4. Your scan history should be visible in the "Recent Scans" section

### 9. Verify API Integration

Open the browser console (F12) and check:

**Extension Background Worker:**
```javascript
// Go to chrome://extensions/
// Click "service worker" under PhishGuard
// You should see:
Background: All resources loaded!
PhishGuard: Auto-scanning new content...
Incident logged: {success: true, ...}
```

**Web App API:**
Check your terminal where `npm run dev` is running. You should see:
```
POST /api/v1/incidents 201 in XXms
POST /api/v1/analyze 200 in XXms
```

## Troubleshooting

### Extension shows "Limit Reached"

This means you've used all 10 free scans. To reset:

```bash
cd packages/db
npx prisma studio
# Navigate to User table, find your user, open DashboardStats
# Set scansPerformed back to 0
```

Or regenerate your API token (this creates a new session).

### Extension shows "UNAUTHORIZED"

1. Check that your API token is saved:
   ```javascript
   // In extension service worker console:
   chrome.storage.sync.get(null, data => console.log(data));
   // Should show: { authToken: "...", userPlan: "free", scansRemaining: 10 }
   ```

2. Regenerate token at `http://localhost:3001/ext-auth`

3. Verify token exists in database:
   ```bash
   cd packages/db
   npx prisma studio
   # Check ApiToken table
   ```

### "Can't reach database server"

```bash
# Check if Docker is running
docker-compose ps

# Restart database
docker-compose down
docker-compose up -d

# Wait 10 seconds for PostgreSQL to start
```

### ML Service not responding

```bash
# Check if ML service is running
curl http://localhost:5000/health

# If not, start it:
cd ml-service
python app.py
```

### CORS errors in browser console

1. Check `apps/web/src/middleware.ts` is created
2. Verify `CORS_ORIGIN=http://localhost:3001` in `.env`
3. Restart the Next.js dev server:
   ```bash
   # Press Ctrl+C, then:
   npm run dev
   ```

### Extension not auto-scanning emails

1. Verify you're on a supported email provider:
   - `mail.google.com` (Gmail)
   - `outlook.live.com` (Outlook)
   - `outlook.office.com` (Office 365)
   - `outlook.office365.com`

2. Check content script is injected:
   ```javascript
   // In Gmail tab, open console (F12):
   console.log("PhishGuard content script loaded");
   // You should see this message
   ```

3. Reload the extension:
   - Go to `chrome://extensions/`
   - Click the reload icon on PhishGuard
   - Refresh your Gmail tab

### Rate limit exceeded

You've exceeded 100 API requests in the last hour. Wait for the reset or increase the limit:

```bash
cd packages/db
npx prisma studio
# Navigate to ApiToken table
# Find your token and increase hourlyLimit to 500 or 1000
```

## Configuration Options

### Change API URL (for production)

Edit `apps/extension/popup.js` and `apps/extension/background.js`:

```javascript
// Change default from:
const { apiUrl } = await chrome.storage.sync.get({ 
  apiUrl: 'http://localhost:3001' 
});

// To:
const { apiUrl } = await chrome.storage.sync.get({ 
  apiUrl: 'https://your-production-domain.com' 
});
```

Also update `manifest.json`:
```json
{
  "host_permissions": [
    "https://your-production-domain.com/*"
  ]
}
```

### Adjust Phishing Threshold

Edit `apps/extension/background.js`:

```javascript
// Line 8
const PHISHING_THRESHOLD = 0.5; // Change to 0.3 (more sensitive) or 0.7 (less sensitive)
```

### Disable Auto-Scanning

Remove or comment out content scripts in `manifest.json`:

```json
{
  "content_scripts": []  // Empty array = no auto-scanning
}
```

## Next Steps

After successful integration:

1. ✅ Test all features thoroughly
2. ✅ Check scan history in dashboard
3. ✅ Verify rate limiting works (make 101 requests rapidly)
4. ✅ Test with real phishing examples (use caution!)
5. ✅ Review extension console logs for errors
6. 📦 Package for production deployment
7. 🚀 Submit to Chrome Web Store (optional)

## Production Deployment

See [Extension README](README.md#production-deployment) for production deployment instructions.

## Support

If you encounter issues not covered here:

1. Check extension service worker logs: `chrome://extensions/` → "service worker"
2. Check web app terminal output
3. Check database state: `npx prisma studio`
4. Review [Extension README](README.md#troubleshooting)

## Quick Reference

**Useful Commands:**
```bash
# Start everything
docker-compose up -d && npm run dev

# Check database
cd packages/db && npx prisma studio

# Reset database
cd packages/db && npx prisma migrate reset

# View logs
docker-compose logs -f

# Stop everything
docker-compose down
```

**Useful URLs:**
- Web App: http://localhost:3001
- Extension Auth: http://localhost:3001/ext-auth
- Dashboard: http://localhost:3001/dashboard
- ML Service: http://localhost:5000
- Extensions Page: chrome://extensions/

**Extension Storage:**
```javascript
// View stored data
chrome.storage.sync.get(null, data => console.log(data));

// Clear storage (logout)
chrome.storage.sync.clear();
```
