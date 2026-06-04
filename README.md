# PhishGuard - AI-Powered Phishing Detection Platform

A comprehensive phishing detection system with a Next.js web application, Python ML service, and Chrome extension for real-time email protection.

## 🚀 Features

### Web Application
- **TypeScript** - Type safety and improved developer experience
- **Next.js 16** - Full-stack React framework with App Router
- **TailwindCSS + shadcn/ui** - Modern, accessible UI components
- **Prisma + PostgreSQL** - Type-safe database with migrations
- **Better-Auth** - Secure session-based authentication
- **Cloudinary** - Cloud-based image storage and processing

### Phishing Detection
- **Multi-Layer Analysis**: Google Safe Browsing, ML models, and heuristic detection
- **Text Analysis**: LSTM neural networks for email content classification
- **URL Analysis**: CNN models for malicious URL detection
- **Image OCR**: Tesseract.js for extracting text from phishing images
- **Comprehensive Heuristics**: Brand impersonation, urgency tactics, and more

### Chrome Extension (NEW!)
- **Real-time Email Scanning**: Auto-scans Gmail and Outlook emails
- **Local ML Analysis**: TensorFlow.js models run in the browser
- **API Integration**: Syncs with web app for scan history and analytics
- **Token Authentication**: Secure API access with rate limiting (100 req/hour)
- **Manual Scanning**: Scan any URL or text via popup interface

## Disk usage (monorepo)

Large project folders are usually **`node_modules`**, **`apps/web/.next`**, or a duplicate **`phish-guard-app.rar`** next to the repo. Do not commit these.

- **Cleanup:** `.\cleanup.ps1` (dry-run) or `.\cleanup.ps1 -Run` on Windows; `./cleanup.sh` on macOS/Linux.
- **Reinstall after cleanup:** `bun install` from the repo root.
- **Avoid auth ↔ db cycles:** `@phish-guard-app/auth` must not be a runtime dependency of `@phish-guard-app/db` (seed-only → `devDependencies`). Root `bunfig.toml` uses a hoisted linker.

## Getting Started

First, install the dependencies:

```bash
bun install
```

## Database Setup

This project uses PostgreSQL with Prisma.

1. Make sure you have a PostgreSQL database set up.
2. Update your `apps/web/.env` file with your PostgreSQL connection details.

3. Apply the schema to your database:

```bash
bun run db:push
```

## Cloudinary Setup (for file uploads)

This project uses Cloudinary for storing user avatars and scan images.

1. Sign up for a free account at [https://cloudinary.com/](https://cloudinary.com/)
2. Go to your Cloudinary Dashboard at [https://console.cloudinary.com/](https://console.cloudinary.com/)
3. Copy your Cloud Name, API Key, and API Secret
4. Create a `.env.local` file in `apps/web/` (or copy from `.env.local.example`)
5. Add your Cloudinary credentials:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name_here
CLOUDINARY_API_KEY=your_api_key_here
CLOUDINARY_API_SECRET=your_api_secret_here
```

The free tier includes:
- 25 GB storage
- 25 GB monthly bandwidth
- Perfect for development and small production apps

Then, run the development server:

```bash
bun run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the fullstack application.

## 📁 Project Structure

```
phish-guard-app/
├── apps/
│   ├── web/                      # Next.js web application (Port 3001)
│   │   ├── src/app/              # App router pages
│   │   │   ├── api/v1/          # REST API endpoints (NEW!)
│   │   │   │   ├── analyze/     # POST - Phishing analysis
│   │   │   │   ├── quick-check/ # POST - Anonymous URL check
│   │   │   │   ├── scans/       # GET - Scan history
│   │   │   │   ├── incidents/   # POST - Log incidents
│  🔧 Available Scripts

- `npm run dev`: Start web application in development mode
- `npm run build`: Build all applications
- `npm run db:push`: Push Prisma schema changes to database
- `npm run db:migrate`: Create and run database migrations
- `npm run db:studio`: Open Prisma Studio (database GUI)

## 🌐 Chrome Extension Integration

### Quick Start

1. **Start the database and web app:**
   ```bash
   docker-compose up -d
   npm run dev
   ```

2. **Load the extension:**
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `apps/extension` folder

3. **Authenticate:**
   - Click extension icon → "Login"
   - Generate API token at `http://localhost:3001/ext-auth`
   - Token auto-saves to extension

4. **Test:**
   - Open Gmail
   - Extension auto-scans emails
   - Check dashboard for scan history

For detailed setup instructions, see [EXTENSION_SETUP.md](EXTENSION_SETUP.md)

### API Endpoints

The extension uses these new REST API endpoints:

- `POST /api/v1/analyze` - Full phishing analysis (auth required)
- `POST /api/v1/quick-check` - Anonymous URL check (50/hour per IP)
- `POST /api/v1/incidents` - Log detected incidents (auth required)
- `GET /api/v1/scans` - Get scan history (auth required)
- `POST /api/v1/auth/token` - Generate API tokens

**Authentication:** Bearer token with 100 requests/hour rate limit

**Documentation:** See [apps/extension/README.md](apps/extension/README.md)

## 📚 Documentation

- [Extension Setup Guide](EXTENSION_SETUP.md) - Step-by-step integration guide
- [Extension README](apps/extension/README.md) - Architecture and API docs
- [Cloudinary Setup](CLOUDINARY_SETUP.md) - Image storage configuration
- [ML Service Setup](ML_SERVICE_SETUP.md) - Python service configurationion authentication (NEW!)
│   │   │   └── ...
│   │   └── src/lib/             # Utilities
│   │       ├── api-auth.ts      # API token auth (NEW!)
│   │       ├── ml-service.ts    # ML API client
│   │       ├── safe-browsing.ts # Google API client
│   │       └── ...
│   └── extension/               # Chrome extension (NEW!)
│       ├── manifest.json        # Extension configuration
│       ├── background.js        # Service worker (ML analysis)
│       ├── content.js           # Email content extraction
│       ├── popup.html/js/css    # Extension popup UI
│       ├── options.html/js      # Settings page
│       └── assets/              # ML models + icons
├── packages/
│   ├── auth/                    # Better-Auth configuration
│   ├── db/                      # Prisma schema & client
│   │   └── prisma/schema/
│   │       └── auth.prisma      # Added ApiToken model (NEW!)
│   ├── config/                  # Shared configs
│   └── env/                     # Environment variables
└── ml-service/                  # Python FastAPI service (Port 5000)
    ├── app.py                   # ML prediction API
    ├── models/                  # Pre-trained models
    └── requirements.txt
```

## Available Scripts

- `bun run dev`: Start all applications in development mode
- `bun run build`: Build all applications
- `bun run check-types`: Check TypeScript types across all apps
- `bun run db:push`: Push schema changes to database
- `bun run db:studio`: Open database studio UI
