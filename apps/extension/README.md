# PhishGuard Chrome Extension

## Overview

The extension scans Gmail/Outlook content and sends analysis requests to the PhishGuard backend.
Local TensorFlow.js inference has been removed.

## Key Changes (Current)

- No local `tf.min.js` runtime.
- No local model files inside the extension package.
- Detection now uses `POST /api/v1/analyze`.
- Local fallback heuristics run only if the API is unavailable.
- Backend returns `scanId`, `scoringVersion`, and score breakdown metadata for evaluation.

## Policy Gates

Extension runtime gates (stored in `chrome.storage.sync`):
- `allowLocalFallback` (default `false`)
- `strictServerOnly` (default `true`)
- `disableHardBlock` (default `false`)

Backend retention/enforcement gates (env):
- `STORE_SAFE_CONTENT=false`
- `FORENSICS_MODE=false`
- `PG_STORE_SAFE_CONTENT=false`
- `PG_STORE_PHISHING_CONTENT=false`
- `PG_STORE_SAFE_URL=false`
- `PG_STORE_PHISHING_URL=true`
- `PG_STORE_FULL_URL=false`
- `PG_HARD_BLOCK_RISK=critical`
- `PG_HARD_BLOCK_MIN_CONFIDENCE=0.9`

Notes:
- `STORE_SAFE_CONTENT` and `FORENSICS_MODE` are the preferred policy flags.
- `PG_*` retention flags are still supported for backward compatibility.

GDPR strict bootstrap (`chrome.storage.sync`):

```js
chrome.storage.sync.set({
  allowLocalFallback: false,
  strictServerOnly: true,
  disableHardBlock: false,
});
```

## High-level Flow

1. `content.js` extracts the visible email text and URL context.
2. `background.js` receives `scan_page` and checks auth/quota.
3. `background.js` calls backend `POST /api/v1/analyze`.
4. Backend runs weighted scoring (`weighted_v1`) using:
   - Safe Browsing
   - ML microservice
   - Heuristics
5. Extension updates badge and in-page risk flags.
6. If backend is unavailable, fallback heuristics are used (`extension_fallback_weighted_v1`).

## API Contract (Analyze)

### Request

`POST /api/v1/analyze`

Headers:

```http
Authorization: Bearer <api_token>
Content-Type: application/json
```

Body:

```json
{
  "url": "https://example.com",
  "textHash": "sha256_hex_of_plaintext",
  "payloadEncoding": "rsa_oaep_aes_gcm_v1",
  "encryptedPayload": {
    "iv": "base64...",
    "ciphertext": "base64...",
    "wrappedKey": "base64...",
    "alg": "AES-GCM",
    "keyAlg": "RSA-OAEP-256"
  },
  "source": "extension"
}
```

Fallback (legacy/plaintext) is still supported for compatibility:

```json
{
  "url": "https://example.com",
  "textContent": "Email text content",
  "source": "extension"
}
```

### Response (relevant fields)

```json
{
  "success": true,
  "data": {
    "textScore": 0.41,
    "urlScore": 0.84,
    "overallScore": 0.73,
    "riskLevel": "high",
    "isPhishing": true,
    "confidence": 0.88,
    "scanId": "cm123abcxyz",
    "scoringVersion": "weighted_v1",
    "scoreBreakdown": {
      "urlMlScore": 0.86,
      "urlHeuristicScore": 0.75,
      "textMlScore": 0.32,
      "textHeuristicScore": 0.28,
      "safeBrowsingScore": 0,
      "weightedScore": 0.73
    },
    "modelVersions": {
      "urlModel": "url-model-v3",
      "textModel": "text-model-v5",
      "safeBrowsingHit": false
    },
    "policyDecision": {
      "action": "warn",
      "reason": "high_risk_requires_user_confirmation",
      "hardBlock": false
    },
    "retentionPolicy": {
      "storedText": false,
      "storedUrl": true,
      "usedUrlHostOnly": true,
      "forensicsMode": false
    }
  }
}
```

## Evaluation Ground Truth Endpoint

`POST /api/v1/scans/:scanId/feedback`

Body:

```json
{
  "label": "phishing",
  "note": "User confirmed credential harvesting",
  "trustLevel": "user"
}
```

Allowed labels: `safe`, `phishing`, `unsure`.
Allowed trust levels: `user`, `analyst` (non-analyst users cannot escalate to `analyst`).

`GET /api/v1/evaluations/summary` returns periodic evaluation metrics (`precision`, `recall`, `f1`, `accuracy`) grouped by `scoringVersion` and `modelVersion`.
Query parameter `trust` supports `analyst` (default), `user`, or `all`.

Key generation helper:

```bash
bun run --filter web keys:analyze -- --out apps/web/.env.analyze.keys
```

Notion context sync helper:

```bash
bun run --filter web sync:notion -- --out apps/web/notion-sync
```

## Local Development

1. Run the web app API on `http://localhost:3001`.
2. Load `apps/extension` in `chrome://extensions` as unpacked extension.
3. Sign in through extension auth handoff (`/ext-auth`) or use an API token.

## Extension Structure

```text
apps/extension/
  manifest.json
  background.js
  content.js
  popup.html
  popup.js
  popup.css
  options.html
  options.js
  assets/
    logo.png
    logo-16.png
    logo-48.png
    logo-128.png
```
