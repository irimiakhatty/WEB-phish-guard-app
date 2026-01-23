# Integration Testing Checklist

Use this checklist to verify that the Chrome extension integration is working correctly.

## 🚀 Pre-Testing Setup

- [ ] Docker Desktop is installed and running
- [ ] Node.js 18+ and npm are installed
- [ ] Chrome browser is installed
- [ ] Python 3.8+ is installed (for ML service)

## 📋 Setup Phase

### Database Setup
- [ ] Start database: `docker-compose up -d`
- [ ] Verify database is running: `docker-compose ps`
- [ ] Run migration: `cd packages/db && npx prisma migrate dev --name add_api_tokens`
- [ ] Generate Prisma client: `npx prisma generate`
- [ ] Verify ApiToken table exists: `npx prisma studio` → Check tables

### ML Service Setup
- [ ] Navigate to ml-service: `cd ml-service`
- [ ] Install dependencies: `pip install -r requirements.txt`
- [ ] Start service: `python app.py`
- [ ] Verify health: Visit `http://localhost:5000/health` (should return {"status": "healthy"})

### Web App Setup
- [ ] Install dependencies: `npm install`
- [ ] Copy `.env.example` to `.env`: `cp apps/web/.env.example apps/web/.env`
- [ ] Fill in required environment variables in `.env`
- [ ] Start dev server: `npm run dev`
- [ ] Verify app loads: Visit `http://localhost:3001`

### Extension Setup
- [ ] Open Chrome and go to `chrome://extensions/`
- [ ] Enable "Developer mode" toggle
- [ ] Click "Load unpacked"
- [ ] Select `apps/extension` folder
- [ ] Extension appears in extensions list
- [ ] Copy Extension ID (looks like: `abcdefghijklmnopqrstuvwxyz123456`)
- [ ] Pin extension to toolbar for easy access

## 🧪 Testing Phase

### User Account Creation
- [ ] Navigate to `http://localhost:3001`
- [ ] Click "Sign Up"
- [ ] Create account with email and password
- [ ] Successfully log in
- [ ] Dashboard loads correctly

### Extension Authentication - Method 1 (Automatic)
- [ ] Click PhishGuard extension icon
- [ ] See "Login" button in popup
- [ ] Click "Login" button
- [ ] Redirected to `http://localhost:3001/ext-auth`
- [ ] See "Generate API Token" button
- [ ] Click "Generate API Token"
- [ ] Token displays with copy button
- [ ] Success message appears
- [ ] Return to extension popup
- [ ] Extension now shows "Plan: Free Trial • 10 scans left"

### Extension Authentication - Method 2 (Manual)
- [ ] Logout from extension if logged in
- [ ] Visit `http://localhost:3001/ext-auth` directly
- [ ] Click "Generate API Token"
- [ ] Copy token with copy button
- [ ] Open extension popup
- [ ] Click settings/options icon
- [ ] Paste token in settings
- [ ] Save settings
- [ ] Return to popup
- [ ] Extension shows authenticated state

### Manual Scan Testing
- [ ] Open extension popup
- [ ] Enter safe URL: `https://google.com`
- [ ] Click "Scan Now"
- [ ] See "✅ LOOKS SAFE" result
- [ ] Enter suspicious URL: `http://192.168.1.1/verify-account`
- [ ] Click "Scan Now"
- [ ] See "⚠️ PHISHING DETECTED" result
- [ ] Test with text content (copy email text)
- [ ] Paste in text field
- [ ] Click "Scan Now"
- [ ] Get appropriate result

### Auto-Scan Testing (Gmail)
- [ ] Open Gmail: `https://mail.google.com`
- [ ] Open any email
- [ ] Wait 2-3 seconds for scan to complete
- [ ] Check extension icon badge
  - [ ] Shows "SAFE" (green) or "WARN" (red)
- [ ] If phishing detected:
  - [ ] Chrome notification appears
  - [ ] Notification shows threat details

### Auto-Scan Testing (Outlook)
- [ ] Open Outlook: `https://outlook.live.com`
- [ ] Open any email
- [ ] Wait 2-3 seconds for scan
- [ ] Check extension icon badge
- [ ] Verify scan works

### API Endpoint Testing

#### Test /api/v1/analyze (Authenticated)
```bash
# Get your token from extension storage or /ext-auth page
curl -X POST http://localhost:3001/api/v1/analyze \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://google.com"}'
```
- [ ] Returns 200 status
- [ ] Response has `success: true`
- [ ] Contains `data` object with scores
- [ ] Header `X-RateLimit-Remaining` present

#### Test /api/v1/quick-check (Anonymous)
```bash
curl -X POST http://localhost:3001/api/v1/quick-check \
  -H "Content-Type: application/json" \
  -d '{"url": "https://google.com"}'
```
- [ ] Returns 200 status
- [ ] Response has `success: true`
- [ ] Contains risk assessment
- [ ] No authentication required

#### Test /api/v1/scans (Authenticated)
```bash
curl http://localhost:3001/api/v1/scans \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```
- [ ] Returns 200 status
- [ ] Response contains array of scans
- [ ] Scans match those in dashboard

#### Test /api/v1/incidents (Authenticated)
```bash
curl -X POST http://localhost:3001/api/v1/incidents \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://phishing-test.com",
    "textScore": 0.85,
    "urlScore": 0.92,
    "source": "test"
  }'
```
- [ ] Returns 201 status
- [ ] Incident saved to database
- [ ] Appears in dashboard scan history

### Dashboard Integration Testing
- [ ] Click "View Dashboard" in extension popup
- [ ] Opens `http://localhost:3001/dashboard`
- [ ] Dashboard shows scan count
- [ ] Recent scans list populated
- [ ] Scans from extension appear in list
- [ ] Scan details include source info
- [ ] Can click on scan for details

### Rate Limiting Testing

#### Token Rate Limit (100/hour)
- [ ] Make 10 API requests rapidly (use curl or script)
- [ ] All succeed with decreasing `X-RateLimit-Remaining`
- [ ] After 100 requests, get 401 error
- [ ] Error message: "Rate limit exceeded"
- [ ] Wait for reset time or create new token
- [ ] Verify requests work again

#### Anonymous Rate Limit (50/hour)
- [ ] Make 10 `/api/v1/quick-check` requests without auth
- [ ] All succeed
- [ ] After 50 requests, get 429 error
- [ ] Error message: "Rate limit exceeded. Try again in an hour."

### CORS Testing
- [ ] Open browser DevTools console
- [ ] Check Network tab during API requests
- [ ] No CORS errors appear
- [ ] Requests from extension succeed
- [ ] Requests from web app succeed

### Extension Storage Testing
Open extension service worker console (`chrome://extensions/` → "service worker"):
```javascript
chrome.storage.sync.get(null, data => console.log(data));
```
- [ ] Shows `authToken` (64-char hex string)
- [ ] Shows `userPlan` ("free" or "paid")
- [ ] Shows `scansRemaining` (number)
- [ ] Shows `apiUrl` ("http://localhost:3001")

### Error Handling Testing

#### Invalid Token
- [ ] Modify token in extension storage
- [ ] Try to scan
- [ ] Get "UNAUTHORIZED" error
- [ ] Extension prompts re-login

#### Expired Token
- [ ] Set token `expiresAt` to past date in database
- [ ] Try to scan
- [ ] Get "API token has expired" error
- [ ] Can generate new token

#### ML Service Down
- [ ] Stop ML service: Kill Python process
- [ ] Try to scan from extension
- [ ] Get partial results (heuristics only)
- [ ] No crash, graceful degradation
- [ ] Restart ML service
- [ ] Scans work fully again

#### Database Down
- [ ] Stop database: `docker-compose down`
- [ ] Try to scan
- [ ] Get error response
- [ ] Web app shows error page
- [ ] Restart database: `docker-compose up -d`
- [ ] Everything works again

### Browser Console Testing

#### Extension Background Console
(`chrome://extensions/` → "service worker")
- [ ] No JavaScript errors
- [ ] Logs: "Background: All resources loaded!"
- [ ] Logs: "PhishGuard: Auto-scanning new content..."
- [ ] Logs: "Incident logged: {success: true}"

#### Extension Popup Console
(Right-click extension icon → "Inspect popup")
- [ ] No JavaScript errors
- [ ] Auth state correctly displayed
- [ ] Scan results render properly

#### Web App Console
(F12 in browser on `localhost:3001`)
- [ ] No JavaScript errors
- [ ] API requests succeed
- [ ] No CORS warnings

#### Web App Terminal
(Where `npm run dev` is running)
- [ ] Logs: `POST /api/v1/analyze 200 in XXms`
- [ ] Logs: `POST /api/v1/incidents 201 in XXms`
- [ ] No error stack traces

### Security Testing

#### Token Security
- [ ] Tokens are 64 characters long
- [ ] Tokens are hex strings (0-9, a-f)
- [ ] Tokens not visible in browser console
- [ ] Tokens not in URL parameters
- [ ] Tokens stored in Chrome sync storage

#### API Security
- [ ] Authenticated endpoints require `Authorization` header
- [ ] Invalid tokens are rejected
- [ ] Rate limits are enforced
- [ ] CORS is properly configured
- [ ] No sensitive data in error messages

### Performance Testing
- [ ] Extension popup opens quickly (<500ms)
- [ ] Manual scans complete in <3 seconds
- [ ] Auto-scans don't slow down email loading
- [ ] Dashboard loads scan history quickly
- [ ] API responses are fast (<1 second)

## 🎯 Final Verification

### Functionality Checklist
- [ ] ✅ Extension installs without errors
- [ ] ✅ Authentication flow works smoothly
- [ ] ✅ Manual scanning returns accurate results
- [ ] ✅ Auto-scanning works in Gmail
- [ ] ✅ Auto-scanning works in Outlook
- [ ] ✅ Scan history syncs to dashboard
- [ ] ✅ Rate limiting functions correctly
- [ ] ✅ All API endpoints respond properly
- [ ] ✅ Error handling is graceful
- [ ] ✅ No console errors or warnings

### User Experience Checklist
- [ ] ✅ UI is intuitive and easy to use
- [ ] ✅ Loading states are clear
- [ ] ✅ Error messages are helpful
- [ ] ✅ Scan results are understandable
- [ ] ✅ Notifications are timely
- [ ] ✅ Settings are accessible

### Technical Checklist
- [ ] ✅ No memory leaks in extension
- [ ] ✅ No database connection issues
- [ ] ✅ CORS configured correctly
- [ ] ✅ Rate limits working as expected
- [ ] ✅ Token authentication secure
- [ ] ✅ All services communicate properly

## 📝 Test Results Log

Date: _______________
Tester: _______________

### Issues Found
1. _______________________________________
2. _______________________________________
3. _______________________________________

### Notes
_____________________________________________
_____________________________________________
_____________________________________________

### Overall Status
- [ ] ✅ All tests passed - Ready for production
- [ ] ⚠️  Minor issues found - Needs fixes
- [ ] ❌ Major issues found - Significant work needed

---

**Next Steps After All Tests Pass:**
1. Fix any issues found during testing
2. Update production environment variables
3. Deploy web app to production
4. Update extension manifest for production URLs
5. Package extension for Chrome Web Store
6. Submit extension for review (optional)
7. Monitor production logs for issues

**Testing Complete!** 🎉
