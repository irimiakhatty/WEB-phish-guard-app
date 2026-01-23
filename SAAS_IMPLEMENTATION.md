# 🎯 PhishGuard SaaS Implementation - Complete

## ✅ Ce am implementat

### 1. Multi-Tenancy Architecture ✅
```
Database Schema Updated:
- Organization (main tenant entity)
- OrganizationMember (user-organization relationship)  
- OrganizationInvite (invite system)
- Subscription (per organization)
- ApiToken (per organization, not per user)
- Scan (belongs to organization)
```

### 2. Rol Hierarchy ✅
```
SUPER_ADMIN (tu)
   ↓ manages
ORGANIZATION
   ↓ has
ORG_ADMIN (organization owner)
   ↓ invites & manages
MEMBERS (employees)
   ↓ can be
VIEWERS (read-only)
```

### 3. Subscription Plans ✅
```typescript
FREE
- 3 members
- 500 scans/month
- 25 scans/hour per user
- 1 API token
- $0/month

STARTUP  
- 10 members
- 5,000 scans/month
- 100 scans/hour per user
- 5 API tokens
- $29/month

BUSINESS
- 50 members
- 25,000 scans/month
- 500 scans/hour per user
- 20 API tokens
- $99/month

ENTERPRISE
- Unlimited members
- Unlimited scans
- Unlimited rate
- 100 API tokens
- $499/month
```

## 📊 Database Schema

### Organization Table
```sql
CREATE TABLE organization (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  domain TEXT UNIQUE,  -- For auto-join (e.g., company.com)
  logo TEXT,
  settings JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP,
  created_by_id TEXT REFERENCES user(id)
);
```

### Organization Member (Roles)
```sql
CREATE TABLE organization_member (
  id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organization(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES user(id) ON DELETE CASCADE,
  role TEXT NOT NULL,  -- 'admin', 'member', 'viewer'
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);
```

### Subscription (Per Org)
```sql
CREATE TABLE subscription (
  id TEXT PRIMARY KEY,
  organization_id TEXT UNIQUE REFERENCES organization(id),
  plan TEXT DEFAULT 'free',
  status TEXT DEFAULT 'active',
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  current_period_end TIMESTAMP,
  max_members INT DEFAULT 5,
  scans_per_month INT DEFAULT 1000,
  scans_per_hour_per_user INT DEFAULT 50,
  max_api_tokens INT DEFAULT 3
);
```

## 🚀 Next Steps - Implementation Priority

### PRIORITATE 1: Core Organization Features (2-3 zile)

#### 1.1 Organization Creation Flow
```typescript
// POST /api/organizations
// When user signs up, create personal organization
// Or allow creating new organization from dashboard
```

#### 1.2 Invite System
```typescript
// POST /api/organizations/[id]/invites
// Send email invite with unique token
// Accept invite at /invite/[token]
```

#### 1.3 Organization Dashboard
```
- View members
- Manage roles  
- View subscription
- Organization settings
```

### PRIORITATE 2: Stripe Integration (2-3 zile)

#### 2.1 Stripe Setup
```bash
# Install Stripe
npm install stripe @stripe/stripe-js

# Create products in Stripe Dashboard:
- Product: "PhishGuard Startup" → Price: $29/month
- Product: "PhishGuard Business" → Price: $99/month  
- Product: "PhishGuard Enterprise" → Price: $499/month
```

#### 2.2 Checkout Flow
```typescript
// /billing → Pricing page
// Click "Upgrade" → Stripe Checkout
// Success → Webhook activates subscription
```

#### 2.3 Webhooks
```typescript
// POST /api/stripe/webhook
- subscription.created
- subscription.updated
- subscription.deleted
- invoice.payment_succeeded
- invoice.payment_failed
```

### PRIORITATE 3: Super Admin Dashboard (1-2 zile)

#### 3.1 Admin Panel
```
/admin (doar pentru super_admin)
- Lista organizații
- Analytics global
- Feature flags
- User management
```

#### 3.2 Organization Management
```
- View all orgs
- Suspend/activate organizations
- Override subscription limits
- View usage statistics
```

### PRIORITATE 4: RBAC & Permissions (1 zi)

#### 4.1 Permission System
```typescript
// Middleware checks
requireOrganization() // User must be in org
requireOrgAdmin()     // User must be org admin
requireSuperAdmin()   // User must be platform admin

// Permission checks
canInviteMembers()
canManageBilling()
canDeleteScans()
```

## 📋 Implementation Checklist

### Organization Features
- [ ] Create organization on signup (auto)
- [ ] Create organization manually (from dashboard)
- [ ] Organization settings page
- [ ] Member management UI
- [ ] Invite members (email)
- [ ] Accept invite flow
- [ ] Remove members
- [ ] Change member roles
- [ ] Leave organization
- [ ] Delete organization

### Subscription & Billing
- [ ] Stripe account setup (Test Mode)
- [ ] Create products & prices in Stripe
- [ ] Pricing page UI
- [ ] Checkout session creation
- [ ] Webhook endpoint
- [ ] Handle subscription events
- [ ] Billing portal (Stripe Customer Portal)
- [ ] Upgrade/downgrade logic
- [ ] Cancel subscription
- [ ] Reactivate subscription
- [ ] Invoice history

### Admin Features
- [ ] Super admin dashboard
- [ ] Organization list view
- [ ] Organization details view
- [ ] Global analytics
- [ ] Feature flags system
- [ ] Suspend/activate orgs
- [ ] Override limits
- [ ] Audit logs

### API & Extension Updates
- [ ] Update API auth to use org context
- [ ] Extension org switching (if user in multiple)
- [ ] Org-wide analytics
- [ ] Quota tracking per organization
- [ ] API token management per org

## 🎨 UI Components Needed

### 1. Organization Switcher
```tsx
<OrganizationSwitcher
  currentOrg={currentOrg}
  organizations={userOrgs}
  onSwitch={(orgId) => switchOrg(orgId)}
/>
```

### 2. Member List
```tsx
<MemberList
  members={orgMembers}
  onRemove={(userId) => removeMember(userId)}
  onChangeRole={(userId, role) => updateRole(userId, role)}
/>
```

### 3. Invite Modal
```tsx
<InviteMemberModal
  onInvite={(email, role) => sendInvite(email, role)}
  availableSeats={subscription.maxMembers - members.length}
/>
```

### 4. Pricing Cards
```tsx
<PricingCard
  plan="startup"
  price={29}
  features={PLANS.startup.features}
  onSelect={() => createCheckout('startup')}
  currentPlan={subscription.plan}
/>
```

### 5. Subscription Badge
```tsx
<SubscriptionBadge
  plan={subscription.plan}
  status={subscription.status}
  renewDate={subscription.currentPeriodEnd}
/>
```

## 🔐 Security Considerations

### 1. Organization Isolation
```typescript
// CRITICAL: Always filter by organizationId
const scans = await db.scan.findMany({
  where: {
    organizationId: user.currentOrgId, // NEVER skip this
    isDeleted: false
  }
});
```

### 2. Role Validation
```typescript
// Check permissions before actions
if (action === 'invite_member') {
  const member = await getOrganizationMember(user.id, orgId);
  if (member.role !== 'admin') {
    throw new Error('Unauthorized');
  }
}
```

### 3. Subscription Enforcement
```typescript
// Block actions if limits exceeded
if (organization.subscription.maxMembers <= currentMembers) {
  return { error: 'Member limit reached. Upgrade plan.' };
}
```

## 💰 Revenue Model

### Estimări pentru 100 clienți:

```
Scenariul Optimist:
- 10 Enterprise ($499) = $4,990
- 30 Business ($99) = $2,970
- 40 Startup ($29) = $1,160
- 20 Free ($0) = $0
TOTAL: $9,120/month

Costuri:
- Stripe fees (2.9%) = ~$264
- Server (AWS/Railway) = ~$200
- Database = ~$50
- ML hosting = ~$100
- Email service = ~$30
NET PROFIT: ~$8,476/month

Scenariul Realist:
- 2 Enterprise = $998
- 10 Business = $990
- 30 Startup = $870
- 58 Free = $0
TOTAL: $2,858/month
NET PROFIT: ~$2,200/month
```

## 📈 Next Action Items

**ACUM (astăzi/mâine):**
1. ✅ Database schema migrated
2. ⏳ Create organization on user signup (auto)
3. ⏳ Basic organization dashboard
4. ⏳ Stripe Test Mode setup

**SĂPTĂMÂNA 1:**
- Stripe integration complet
- Checkout flow
- Webhooks
- Basic billing UI

**SĂPTĂMÂNA 2:**
- Invite system
- Member management
- Organization settings
- Super admin dashboard

**SĂPTĂMÂNA 3-4:**
- Polish UI/UX
- Testing
- Documentation
- Deploy to production

## 🎯 Success Metrics

Track these KPIs:
- Organizations created
- Paid conversions (Free → Paid)
- MRR (Monthly Recurring Revenue)
- Churn rate
- Average scans per organization
- Active users per organization

---

**Status:** ✅ Foundation Complete - Ready to build features
**Migration:** ✅ Applied successfully
**Next Step:** Choose which priority to implement first!

Vrei să continuăm cu Stripe integration sau cu Organization creation flow?
