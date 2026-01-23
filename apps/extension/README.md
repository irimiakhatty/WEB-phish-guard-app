# PhishGuard Chrome Extension Integration

## Overview

The PhishGuard Chrome extension is now integrated into the main application. It provides real-time phishing detection for emails in Gmail, Outlook, and other email clients.

## Features

- **Real-time Email Scanning**: Automatically scans emails in Gmail and Outlook
- **Local ML Analysis**: Performs local machine learning analysis using TensorFlow.js
- **API Integration**: Logs incidents and syncs with the web application
- **Token-based Authentication**: Secure API access with rate limiting (100 requests/hour)
- **Manual Scanning**: Scan any URL or text content via the extension popup
- **Risk Notifications**: Get instant alerts for detected phishing attempts

## Architecture

```
┌─────────────────────────────────────────┐
│        Chrome Extension                 │
│  ┌─────────────────────────────────┐   │
│  │ Content Scripts (Gmail/Outlook) │   │
│  └──────────────┬──────────────────┘   │
│                 │                       │
│  ┌──────────────▼──────────────────┐   │
│  │ Background Worker (ML Analysis) │   │
│  └──────────────┬──────────────────┘   │
│                 │                       │
│  ┌──────────────▼──────────────────┐   │
│  │    Popup UI (User Interface)    │   │
│  └──────────────┬──────────────────┘   │
└─────────────────┼───────────────────────┘
                  │
                  │ API Token Auth
                  ▼
┌─────────────────────────────────────────┐
│     PhishGuard Web App (Port 3001)      │
│  ┌──────────────────────────────────┐  │
│  │  REST API Endpoints              │  │
│  │  - POST /api/v1/analyze          │  │
│  │  - POST /api/v1/quick-check      │  │
│  │  - POST /api/v1/incidents        │  │
│  │  - GET  /api/v1/scans            │  │
│  │  - POST /api/v1/auth/token       │  │
│  └──────────────┬───────────────────┘  │
│                 │                       │
│  ┌──────────────▼───────────────────┐  │
│  │   Database (PostgreSQL)          │  │
│  │   - Users & API Tokens           │  │
│  │   - Scan History                 │  │
│  │   - Rate Limiting                │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## Setup Instructions

### 1. Database Migration

Run the Prisma migration to add API token support:

```bash
# Start the database
docker-compose up -d

# Run migration
cd packages/db
npx prisma migrate dev --name add_api_tokens

# Generate Prisma client
npx prisma generate
```

### 2. Start the Web Application

```bash
# Install dependencies (if not already done)
npm install

# Start development server
npm run dev
```

The app will run on `http://localhost:3001`

### 3. Load the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `apps/extension` folder
5. Note the Extension ID (you'll need this for authentication)

### 4. Authenticate the Extension

1. Click on the PhishGuard extension icon in Chrome
2. Click "Login" button in the popup
3. You'll be redirected to `http://localhost:3001/ext-auth`
4. If not logged in, sign in to your PhishGuard account
5. Click "Generate API Token"
6. The token will be automatically sent to the extension
7. Alternatively, copy the token and paste it in extension settings

### 5. Test the Extension

1. Open Gmail or Outlook
2. The extension will automatically scan emails
3. Click the extension icon to manually scan URLs or text
4. Check the dashboard for scan history

## API Endpoints

### Authentication Required

#### `POST /api/v1/analyze`
Analyze content for phishing threats.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "url": "https://example.com",
  "textContent": "Email text content",
  "imageUrl": "https://cloudinary.com/image.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "textScore": 0.85,
    "urlScore": 0.92,
    "overallScore": 0.92,
    "riskLevel": "critical",
    "isPhishing": true,
    "confidence": 0.92,
    "detectedThreats": ["Suspicious URL", "Urgent language"],
    "analysis": "High phishing risk detected..."
  }
}
```

#### `POST /api/v1/incidents`
Log a phishing incident.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "url": "https://phishing-site.com",
  "textScore": 0.85,
  "urlScore": 0.92,
  "timestamp": "2026-01-23T15:00:00Z",
  "source": "extension"
}
```

#### `GET /api/v1/scans?limit=50`
Get user's scan history.

**Headers:**
```
Authorization: Bearer <token>
```

### No Authentication

#### `POST /api/v1/quick-check`
Quick URL check (50 requests/hour per IP).

**Body:**
```json
{
  "url": "https://example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overallScore": 0.85,
    "riskLevel": "high",
    "isPhishing": true,
    "detectedThreats": ["Suspicious TLD", "IP address in URL"]
  }
}
```

## Rate Limiting

- **Authenticated requests**: 100 requests per hour per token
- **Anonymous quick-checks**: 50 requests per hour per IP address
- Rate limit headers included in responses: `X-RateLimit-Remaining`

## Configuration

### Extension Settings (Optional)

Create `apps/extension/config.js` to customize:

```javascript
const CONFIG = {
  API_URL: 'http://localhost:3001',
  PHISHING_THRESHOLD: 0.5,
  AUTO_SCAN_ENABLED: true,
  SCAN_DELAY: 2000, // ms
};
```

### Environment Variables

Add to `apps/web/.env`:

```env
# Extension ID (optional, for externally_connectable)
NEXT_PUBLIC_EXTENSION_ID=your-extension-id

# CORS Origins (already configured)
CORS_ORIGIN=http://localhost:3001

# API Rate Limits (default: 100/hour)
API_RATE_LIMIT_HOURLY=100
API_RATE_LIMIT_ANONYMOUS=50
```

## Development

### Extension Structure

```
apps/extension/
├── manifest.json           # Extension configuration
├── background.js           # Background worker (ML analysis)
├── content.js              # Content scripts (email extraction)
├── popup.html              # Extension popup UI
├── popup.js                # Popup logic
├── popup.css               # Popup styles
├── options.html            # Settings page
├── options.js              # Settings logic
├── tf.min.js              # TensorFlow.js library
└── assets/
    ├── logo.png           # Extension icon
    ├── text_model/        # Text classification model
    ├── url_model/         # URL classification model
    ├── word_index.json    # Text tokenizer vocabulary
    └── url_char_index.json # URL tokenizer vocabulary
```

### Hot Reload

Changes to extension files require:
1. Save the file
2. Go to `chrome://extensions/`
3. Click the reload icon for PhishGuard

For API changes, the Next.js dev server hot-reloads automatically.

## Debugging

### Extension Debugging

1. Right-click extension icon → "Inspect popup" (for popup debugging)
2. Go to `chrome://extensions/` → Click "background.html" or "service worker" (for background debugging)
3. Check `chrome.storage.sync` for stored data:
   ```javascript
   chrome.storage.sync.get(null, (data) => console.log(data));
   ```

### API Debugging

Check API logs in terminal running `npm run dev`:
```bash
API analyze error: ...
API auth error: ...
```

Check database for tokens:
```bash
cd packages/db
npx prisma studio
```

## Security Considerations

1. **API Tokens**: Never commit tokens to version control
2. **CORS**: Only allow trusted origins
3. **Rate Limiting**: Prevents abuse (100 req/hour per user)
4. **Token Expiration**: Tokens expire after 1 year (configurable)
5. **HTTPS Only**: Use HTTPS in production
6. **Content Security Policy**: Manifest v3 restrictions enforced

## Production Deployment

### Web App

1. Update `CORS_ORIGIN` to include production domains
2. Update `BETTER_AUTH_URL` to production URL
3. Deploy to Vercel, Railway, or similar

### Extension

1. Update `manifest.json`:
   ```json
   {
     "host_permissions": [
       "https://your-production-domain.com/*"
     ],
     "externally_connectable": {
       "matches": [
         "https://your-production-domain.com/*"
       ]
     }
   }
   ```

2. Update default API URL in `popup.js` and `background.js`:
   ```javascript
   const { apiUrl } = await chrome.storage.sync.get({ 
     apiUrl: 'https://your-production-domain.com' 
   });
   ```

3. Package extension:
   ```bash
   cd apps/extension
   zip -r phishguard-extension.zip . -x "*.git*" "node_modules/*"
   ```

4. Submit to Chrome Web Store

## Troubleshooting

### Extension not logging incidents

- Check that user is authenticated (has API token)
- Verify API URL is correct in extension settings
- Check browser console for errors
- Ensure database is running

### Rate limit exceeded

- Wait for the reset time (displayed in error message)
- Increase `hourlyLimit` in database for specific token
- Use authenticated requests instead of anonymous

### CORS errors

- Verify `CORS_ORIGIN` includes extension origin
- Check that `host_permissions` in manifest.json match
- Clear browser cache and reload extension

### Token not working

- Regenerate token at `/ext-auth`
- Check token in database: `npx prisma studio`
- Verify token is saved in extension: Check `chrome.storage.sync`

## Future Enhancements

- [ ] Token refresh mechanism
- [ ] Multiple token support (mobile app, desktop app)
- [ ] Advanced analytics dashboard
- [ ] Whitelist/blacklist management in extension
- [ ] Configurable rate limits per user
- [ ] WebSocket for real-time notifications
- [ ] Firefox and Edge extension support

## Support

For issues, please check:
1. Extension console logs
2. Web app terminal logs  
3. Database state in Prisma Studio
4. GitHub Issues (if applicable)
