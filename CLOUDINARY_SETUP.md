# Cloudinary File Upload Implementation

## What Was Implemented

✅ **Avatar Upload System**
- User profile picture upload with face detection
- Auto-crop to 200x200px with face centering
- 5MB file size limit
- Updates user's image in database
- Integrated in Settings page

✅ **Scan Image Upload**
- Upload screenshots of suspicious emails/messages
- 10MB file size limit
- Auto-optimization (1200px width)
- Stores in Cloudinary for phishing analysis

✅ **Image Analysis Tab**
- Added third tab in Manual Analysis component
- Upload image → Preview → Analyze workflow
- Integrated with existing phishing detection

✅ **Settings Page**
- New `/settings` route for profile management
- Shows email, role, and avatar upload UI
- Link added to main navigation

## Setup Instructions

### 1. Get Cloudinary Credentials

1. Sign up for free at: https://cloudinary.com/
2. Go to Dashboard: https://console.cloudinary.com/
3. Copy these values:
   - **Cloud Name**
   - **API Key**
   - **API Secret**

### 2. Configure Environment Variables

Create `apps/web/.env.local` file (you can copy from `.env.local.example`):

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name_here
CLOUDINARY_API_KEY=your_api_key_here
CLOUDINARY_API_SECRET=your_api_secret_here
```

**Important:** Replace the placeholder values with your actual Cloudinary credentials!

### 3. Restart Dev Server

After adding environment variables:

```bash
cd apps/web
bun run dev
```

## Testing the Features

### Test Avatar Upload

1. Start dev server: `bun run dev`
2. Login to your account
3. Navigate to **Settings** page
4. Click **Choose Avatar** button
5. Select an image (max 5MB)
6. Image should upload and preview automatically
7. Check that the avatar appears in the header/user menu

### Test Scan Image Upload

1. Navigate to **Analyze** page
2. Click the **Image Analysis** tab
3. Click **Choose Image** button
4. Select a screenshot of an email/message
5. Preview should appear
6. Click **Analyze Image**
7. Phishing analysis results should appear

### Verify Database

After uploads:
- Check `User` table - `image` field should have Cloudinary URL
- Check `Scan` table - `imageUrl` field should have Cloudinary URL

## File Structure

```
apps/web/src/
├── app/
│   ├── actions/
│   │   ├── upload.ts              # Server actions for uploads
│   │   └── analyze.ts             # Updated to support imageUrl
│   └── settings/
│       └── page.tsx               # Settings page with avatar upload
├── components/
│   ├── avatar-upload.tsx          # Avatar upload component
│   ├── manual-analysis.tsx        # Updated with image tab
│   └── header.tsx                 # Added Settings link
└── lib/
    └── cloudinary.ts              # Cloudinary configuration

packages/db/prisma/schema/
├── auth.prisma                    # User model with image field
└── phishguard.prisma             # Scan model with imageUrl field
```

## Key Features

### Avatar Upload (`uploadAvatar`)
- Validates image type and size
- Uploads to `phishguard/avatars/` folder
- Face detection and centering
- Overwrites previous avatar
- Updates database
- Revalidates cache

### Scan Image Upload (`uploadScanImage`)
- Validates image type and size  
- Uploads to `phishguard/scans/` folder
- Auto-optimizes for web
- Returns secure URL
- Used in phishing analysis

## Cloudinary Free Tier

- ✅ 25 GB storage
- ✅ 25 GB monthly bandwidth
- ✅ Auto image optimization
- ✅ Face detection transformations
- ✅ Perfect for development and small production apps

## Next Steps

1. **Add Environment Variables** - Most critical step!
2. **Test Upload Flows** - Verify both avatar and scan uploads work
3. **Optional: Add Image OCR** - Extract text from images for better phishing detection
4. **Optional: Add Delete Avatar** - Allow users to remove their avatar
5. **Production Deploy** - Add env vars to Vercel project settings

## Troubleshooting

### "Missing Cloudinary credentials"
- Check `.env.local` file exists in `apps/web/`
- Verify all three env vars are set correctly
- Restart dev server after adding env vars

### Upload fails with 401 error
- Double-check API key and secret are correct
- Make sure cloud name matches exactly (no spaces)

### Image doesn't appear after upload
- Check browser console for errors
- Verify Cloudinary URL in database
- Check network tab for failed requests

## Production Deployment (Vercel)

1. Add environment variables in Vercel dashboard:
   - Go to Project Settings → Environment Variables
   - Add `CLOUDINARY_CLOUD_NAME`
   - Add `CLOUDINARY_API_KEY`
   - Add `CLOUDINARY_API_SECRET`
2. Redeploy the application
3. Test uploads in production

---

**Status:** ✅ Implementation Complete  
**Commit:** `11a686a` - "feat: add Cloudinary file upload for avatars and scan images"  
**Pushed to:** https://github.com/irimiakhatty/WEB-phish-guard-app
