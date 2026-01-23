# Subscription System Implementation

## Overview

PhishGuard now supports a **hybrid B2C + B2B subscription model** with dynamic rate limits, feature access controls, and organization support.

## Architecture

### Two Subscription Models

1. **Personal Subscriptions (B2C)** - For individual users
2. **Team Subscriptions (B2B)** - For organizations

### Database Schema

```prisma
// Personal Subscription (B2C)
model PersonalSubscription {
  id                String   @id @default(cuid())
  userId            String   @unique
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  planId            String   @default("free")
  status            String   @default("active") // active, cancelled, past_due
  stripeCustomerId  String?  @unique
  stripeSubscriptionId String? @unique
  currentPeriodEnd  DateTime?
  cancelAt          DateTime?
  scansPerMonth     Int      @default(100)
  scansPerHour      Int      @default(25)
  maxApiTokens      Int      @default(1)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

// Organization (B2B)
model Organization {
  id           String   @id @default(cuid())
  name         String
  slug         String   @unique
  members      OrganizationMember[]
  subscription Subscription?
  scans        Scan[]
  invites      OrganizationInvite[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

// Team Subscription (B2B)
model Subscription {
  id                   String       @id @default(cuid())
  organizationId       String       @unique
  organization         Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  planId               String       @default("team_free")
  status               String       @default("active")
  stripeCustomerId     String?      @unique
  stripeSubscriptionId String?      @unique
  currentPeriodEnd     DateTime?
  cancelAt             DateTime?
  maxMembers           Int          @default(3)
  scansPerMonth        Int          @default(500)
  scansPerHourPerUser  Int          @default(25)
  maxApiTokens         Int          @default(1)
  createdAt            DateTime     @default(now())
  updatedAt            DateTime     @updatedAt
}
```

## Subscription Plans

### Personal Plans (B2C)

| Plan | Price | Scans/Month | Scans/Hour | Devices | Features |
|------|-------|-------------|------------|---------|----------|
| **Free** | $0 | 100 | 25 | 1 | Basic ML detection, Email scanning |
| **Personal Plus** | $9/mo | 2,000 | 100 | 3 | Advanced ML, Priority scanning, Analytics |
| **Personal Pro** | $19/mo | 10,000 | 500 | 10 | Custom models, Real-time intelligence, API access |

### Team Plans (B2B)

| Plan | Price | Members | Scans/Month | Scans/Hour/User | Features |
|------|-------|---------|-------------|-----------------|----------|
| **Team Free** | $0 | 3 | 500 | 25 | Basic ML, Team dashboard |
| **Startup** | $49/mo | 10 | 5,000 | 100 | Advanced ML, Team analytics, Priority support |
| **Business** | $149/mo | 50 | 25,000 | 500 | Custom integrations, Audit logs, RBAC |
| **Enterprise** | $499/mo | Unlimited | Unlimited | Unlimited | SSO, Custom branding, SLA, Dedicated support |

## Implementation Details

### 1. Subscription Helpers (`subscription-helpers.ts`)

Main functions for managing subscriptions:

```typescript
// Get comprehensive subscription info for a user
getUserSubscriptionInfo(userId: string): Promise<UserSubscriptionInfo>

// Check if user has exceeded monthly/hourly limits
checkMonthlyLimit(userId: string)
checkHourlyLimit(userId: string)
checkScanLimits(userId: string)

// Check if user can create more API tokens
canCreateApiToken(userId: string)

// Feature access checks
hasFeatureAccess(userId: string, feature: string)
isOrganizationMember(userId: string)
isOrganizationAdmin(userId: string)
```

### 2. Rate Limiting Logic

The system automatically chooses the **best available subscription** for rate limits:

1. **Priority Order**: Organization subscription > Personal subscription > Free tier
2. **Dynamic Limits**: Rate limits adjust based on active subscription
3. **Per-User Limits**: Team plans have per-user rate limits

```typescript
// Example: User with Personal Plus + Organization Startup membership
// → Uses Organization Startup limits (100 scans/hour) because it's higher
```

### 3. API Token Limits

API tokens are limited based on subscription:

- **Free**: 1 token
- **Personal Plus**: 3 tokens
- **Personal Pro**: 10 tokens
- **Team Plans**: 1-100 tokens depending on tier

### 4. Scan Tracking

All scans are tracked with:

```typescript
{
  userId: string;           // Who performed the scan
  organizationId?: string;  // Which org (if applicable)
  source: "web" | "extension" | "api";
  // ... scan results
}
```

## Usage Examples

### Check Limits Before Scan

```typescript
import { checkScanLimits } from "@/lib/subscription-helpers";

const limitsCheck = await checkScanLimits(userId);
if (!limitsCheck.allowed) {
  throw new Error(limitsCheck.reason);
}

// Proceed with scan...
```

### Get User's Subscription Info

```typescript
import { getUserSubscriptionInfo } from "@/lib/subscription-helpers";

const subInfo = await getUserSubscriptionInfo(userId);

console.log(`Plan: ${subInfo.planId}`);
console.log(`Type: ${subInfo.subscriptionType}`); // "personal" | "team" | "none"
console.log(`Limits: ${subInfo.limits.scansPerHour} scans/hour`);

if (subInfo.organizationId) {
  console.log(`Organization: ${subInfo.organizationName}`);
}
```

### Check Token Creation

```typescript
import { canCreateApiToken } from "@/lib/subscription-helpers";

const tokenCheck = await canCreateApiToken(userId);
if (!tokenCheck.allowed) {
  return `Token limit reached (${tokenCheck.tokensUsed}/${tokenCheck.tokensLimit})`;
}

// Create token...
```

## Integration Points

### 1. Analyze Action (`analyze.ts`)

```typescript
// Check limits BEFORE analysis
const limitsCheck = await checkScanLimits(session.user.id);
if (!limitsCheck.allowed) {
  throw new Error(limitsCheck.reason);
}

// Save scan with organization context
const subInfo = await getUserSubscriptionInfo(session.user.id);
await prisma.scan.create({
  data: {
    userId: session.user.id,
    organizationId: subInfo.organizationId || null,
    // ... other data
  },
});
```

### 2. API Authentication (`api-auth.ts`)

```typescript
// Dynamic rate limits based on subscription
const subInfo = await getUserSubscriptionInfo(apiToken.userId);
const hourlyLimit = subInfo.limits.scansPerHour;

// Check against subscription limit
if (apiToken.requestCount >= hourlyLimit) {
  return { authorized: false, error: "Rate limit exceeded" };
}
```

### 3. Token Creation (`/api/v1/auth/token`)

```typescript
// Check token limits before creation
const tokenCheck = await canCreateApiToken(user.id);
if (!tokenCheck.allowed) {
  return NextResponse.json(
    {
      error: `Token limit reached (${tokenCheck.tokensUsed}/${tokenCheck.tokensLimit})`,
    },
    { status: 403 }
  );
}
```

## Response Format

### Limit Check Response

```json
{
  "allowed": false,
  "reason": "Hourly scan limit reached (100/100)",
  "limits": {
    "monthly": { "used": 1543, "limit": 5000 },
    "hourly": { "used": 100, "limit": 100 }
  }
}
```

### Token Creation Response

```json
{
  "success": true,
  "data": {
    "token": "abc123...",
    "expiresAt": "2026-02-23T12:00:00Z",
    "tokensUsed": 2,
    "tokensLimit": 3
  }
}
```

## Next Steps

### 1. Stripe Integration

```bash
# Setup Stripe products and prices
# Add webhook handling for subscription events
# Implement checkout flows for both B2C and B2B
```

### 2. Organization Management UI

- [ ] Create organization page
- [ ] Invite members
- [ ] Role management (admin/member)
- [ ] Team subscription upgrade/downgrade

### 3. Pricing Page

```typescript
// /app/pricing/page.tsx
- Toggle between Personal and Team plans
- Feature comparison table
- Upgrade/downgrade CTAs
- FAQ section
```

### 4. Dashboard Updates

- [ ] Show current plan and limits
- [ ] Usage graphs (monthly/hourly)
- [ ] Upgrade prompts when approaching limits
- [ ] Organization switcher (if member of multiple orgs)

### 5. Billing Portal

- [ ] Manage subscription
- [ ] Update payment method
- [ ] View invoices
- [ ] Cancel subscription

## Testing

### Test Free Tier Limits

```bash
# Make 101 scans in a month
# Should see: "Monthly scan limit reached (100/100)"
```

### Test Token Limits

```bash
# Free plan: Try to create 2nd token
# Should see: "Token limit reached (1/1)"
```

### Test Organization Priority

```bash
# User with:
# - Personal Plus (100 scans/hour)
# - Organization Startup (100 scans/hour)
# Should use Organization limits
```

## Migration Applied

```bash
✅ Migration: 20260123171356_add_personal_subscriptions
```

Database is ready with:
- `PersonalSubscription` table
- `Organization` table
- `Subscription` table
- Updated `User` relations

## Environment Variables

```env
# Stripe Keys (Test Mode)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs
STRIPE_PRICE_PERSONAL_PLUS_MONTHLY=price_...
STRIPE_PRICE_PERSONAL_PRO_MONTHLY=price_...
STRIPE_PRICE_TEAM_STARTUP_MONTHLY=price_...
STRIPE_PRICE_TEAM_BUSINESS_MONTHLY=price_...
STRIPE_PRICE_TEAM_ENTERPRISE_MONTHLY=price_...
```

---

**Status**: ✅ Core implementation complete  
**Next**: Stripe integration + Organization UI + Pricing page
