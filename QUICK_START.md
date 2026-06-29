# 🚀 Quick Start - Chrome Extension Integration

## TL;DR - Get Running in 5 Minutes

### Step 1: Start Services (2 minutes)

**Database (recommended: shared cloud — no Docker, no re-seed on each device):**

| Option | Setup |
|--------|--------|
| **Neon** (recommended) | [neon.tech](https://neon.tech) → free Postgres → paste `DATABASE_URL` in `apps/web/.env` on all devices → `bun run db:bootstrap` once |
| **Supabase** | Free Postgres → `DATABASE_URL` in `apps/web/.env` |
| **Docker** (legacy, single machine) | `docker compose up -d` → local `DATABASE_URL` |

See **[docs/DEV_DATABASE.md](docs/DEV_DATABASE.md)** for multi-device setup.

```bash
# From repo root
bun install
bun run db:bootstrap   # first time only (or empty DB)
bun run dev:web
# or: .\dev-web.ps1
```

Set `apps/web/.env` with `DATABASE_URL`, `BETTER_AUTH_SECRET`. On a **new device**, reuse the same `DATABASE_URL` — run `bun run db:push` only if schema changed; **do not re-seed**.

**Extension + local app:** In extension options, set API URL to `http://localhost:3001` and sign in via the popup.

```bash
# Legacy npm variant
npm install
npm run dev

# Terminal 3 - ML Service (optional for full features)
cd ml-service
pip install -r requirements.txt
python app.py
```

### Step 2: Database Migration (30 seconds)
```bash
# New terminal
cd packages/db
npx prisma migrate dev --name add_api_tokens
npx prisma generate
```

### Step 3: Load Extension (1 minute)
1. Chrome → `chrome://extensions/`
2. Enable "Developer mode"
3. "Load unpacked" → Select `apps/extension` folder
4. Done!

### Step 4: Authenticate (1 minute)
1. Click extension icon
2. Click "Login"
3. Sign up at `http://localhost:3001` if needed
4. Click "Generate API Token"
5. Extension auto-authenticates
6. Start scanning! 🎉

## What You Get

✅ **Web App** - Full phishing detection dashboard at `http://localhost:3001`
✅ **Chrome Extension** - Real-time email scanning in Gmail/Outlook
✅ **REST API** - 6 new endpoints for programmatic access
✅ **Token Auth** - Secure API access with 100 req/hour
✅ **Rate Limiting** - Built-in abuse prevention
✅ **Scan History** - All scans synced to dashboard

## Test It!

### Quick Test #1 - Manual Scan
1. Click extension icon
2. Enter URL: `https://google.com`
3. Click "Scan Now"
4. See: ✅ LOOKS SAFE

### Quick Test #2 - Auto-Scan
1. Open Gmail: `https://mail.google.com`
2. Open any email
3. Wait 2 seconds
4. Check extension badge: "SAFE" or "WARN"

### Quick Test #3 - Dashboard
1. Click "View Dashboard" in extension
2. See your scan history
3. All extension scans appear here

## Troubleshooting

**Extension shows "Login"?**
→ Click it and generate a token

**"Can't reach database"?**
→ Use a shared cloud `DATABASE_URL` (Neon) in `apps/web/.env` — see [docs/DEV_DATABASE.md](docs/DEV_DATABASE.md). Or Docker locally, then `bun run db:bootstrap`.

**No inbox card or badge?**
→ Reload extension at `chrome://extensions/`, sign in, enable **Auto-scan** in settings, confirm API URL matches your app (`http://localhost:3001` for local dev)

**No badge on extension icon?**
→ Reload extension (needs `tabs` permission after update)

**"Rate limit exceeded"?**
→ Wait 1 hour or generate new token

## Documentation

📖 Full setup guide: [EXTENSION_SETUP.md](EXTENSION_SETUP.md)
📖 Technical docs: [apps/extension/README.md](apps/extension/README.md)
📖 API reference: [INTEGRATION_SUMMARY.md](INTEGRATION_SUMMARY.md)
✅ Testing guide: [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md)

## Need Help?

1. Check extension console: `chrome://extensions/` → "service worker"
2. Check web app terminal: Where `npm run dev` is running
3. Check database: `cd packages/db && npx prisma studio`

## Next Steps

After everything works:
1. ✅ Complete [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md)
2. 📝 Configure production environment
3. 🚀 Deploy web app
4. 📦 Package extension for Chrome Web Store

---

**Time to First Scan:** ~5 minutes
**Integration Status:** ✅ Complete
**Documentation:** ✅ Comprehensive

Happy phishing hunting! 🎣🛡️
