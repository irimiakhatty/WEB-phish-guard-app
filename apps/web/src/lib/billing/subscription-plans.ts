// SaaS Subscription Plans Configuration

// ==========================================
// PERSONAL PLANS (B2C - Individual Users)
// ==========================================

export const PERSONAL_PLANS = {
  free: {
    id: "free",
    name: "Free",
    description: "Perfect for trying out PhishGuard",
    price: 0,
    interval: null,
    stripePriceId: null,
    category: "personal",
    features: {
      scansPerMonth: 100,
      scansPerHour: 30,
      maxApiTokens: 1,
      features: [
        "100 scans per month",
        "30 scans per hour",
        "1 API token",
        "Browser extension access",
        "URL, text, and image analysis",
        "Scan history dashboard",
      ],
    },
    limits: {
      advancedAnalytics: false,
      customBranding: false,
      prioritySupport: false,
      apiAccess: true,
      teamFeatures: false,
    },
  },

  personal_plus: {
    id: "personal_plus",
    name: "Personal Plus",
    description: "For power users who need more",
    price: 10,
    interval: "month",
    stripePriceId: process.env.STRIPE_PRICE_PERSONAL_PLUS_MONTHLY,
    category: "personal",
    popular: true,
    features: {
      scansPerMonth: 2000,
      scansPerHour: 100,
      maxApiTokens: 3,
      features: [
        "2,000 scans per month",
        "100 scans per hour",
        "3 API tokens",
        "Browser extension access",
        "URL, text, and image analysis",
        "Deep Scan access",
        "Scan history dashboard",
      ],
    },
    limits: {
      advancedAnalytics: true,
      customBranding: false,
      prioritySupport: false,
      apiAccess: true,
      teamFeatures: false,
    },
  },

  personal_pro: {
    id: "personal_pro",
    name: "Personal Pro",
    description: "Maximum protection for individuals",
    price: 20,
    interval: "month",
    stripePriceId: process.env.STRIPE_PRICE_PERSONAL_PRO_MONTHLY,
    category: "personal",
    features: {
      scansPerMonth: 10000,
      scansPerHour: 500,
      maxApiTokens: 10,
      features: [
        "10,000 scans per month",
        "500 scans per hour",
        "10 API tokens",
        "Browser extension access",
        "URL, text, and image analysis",
        "Deep Scan access",
        "Scan history dashboard",
      ],
    },
    limits: {
      advancedAnalytics: true,
      customBranding: false,
      prioritySupport: false,
      apiAccess: true,
      teamFeatures: false,
    },
  },
} as const;

// ==========================================
// TEAM PLANS (B2B - Organizations)
// ==========================================

export const TEAM_PLANS = {
  team_free: {
    id: "team_free",
    name: "Team Free",
    description: "For small teams getting started",
    price: 0,
    interval: null,
    stripePriceId: null,
    category: "team",
    features: {
      maxMembers: 3,
      scansPerMonth: 500,
      scansPerHourPerUser: 25,
      maxApiTokens: 1,
      features: [
        "Up to 3 team members",
        "500 total scans per month",
        "25 scans/hour per user",
        "1 API token",
        "Admin/member roles",
        "Members dashboard",
        "Invite members",
      ],
    },
    limits: {
      advancedAnalytics: false,
      customBranding: false,
      prioritySupport: false,
      apiAccess: true,
      teamFeatures: true,
      sso: false,
    },
  },

  team_startup: {
    id: "team_startup",
    name: "Startup",
    description: "Perfect for growing teams",
    price: 29,
    interval: "month",
    stripePriceId: process.env.STRIPE_PRICE_TEAM_STARTUP_MONTHLY,
    category: "team",
    popular: true,
    features: {
      maxMembers: 10,
      scansPerMonth: 5000,
      scansPerHourPerUser: 100,
      maxApiTokens: 5,
      features: [
        "Up to 10 team members",
        "5,000 scans per month",
        "100 scans/hour per user",
        "5 API tokens",
        "Admin/member roles",
        "Members dashboard",
        "Bulk invites",
        "Deep Scan access",
      ],
    },
    limits: {
      advancedAnalytics: true,
      customBranding: false,
      prioritySupport: false,
      apiAccess: true,
      teamFeatures: true,
      sso: false,
    },
  },

  team_business: {
    id: "team_business",
    name: "Business",
    description: "For established organizations",
    price: 59,
    interval: "month",
    stripePriceId: process.env.STRIPE_PRICE_TEAM_BUSINESS_MONTHLY,
    category: "team",
    features: {
      maxMembers: 50,
      scansPerMonth: 25000,
      scansPerHourPerUser: 500,
      maxApiTokens: 20,
      features: [
        "Up to 50 team members",
        "25,000 scans per month",
        "500 scans/hour per user",
        "20 API tokens",
        "Admin/member roles",
        "Members dashboard",
        "Bulk invites",
        "Deep Scan access",
      ],
    },
    limits: {
      advancedAnalytics: true,
      customBranding: false,
      prioritySupport: false,
      apiAccess: true,
      teamFeatures: true,
      sso: false,
    },
  },

  team_enterprise: {
    id: "team_enterprise",
    name: "Enterprise",
    description: "For large organizations",
    price: 100,
    interval: "month",
    stripePriceId: process.env.STRIPE_PRICE_TEAM_ENTERPRISE_MONTHLY,
    category: "team",
    features: {
      maxMembers: 999999, // Unlimited
      scansPerMonth: 999999, // Unlimited
      scansPerHourPerUser: 999999, // Unlimited
      maxApiTokens: 100,
      features: [
        "Unlimited team members",
        "Unlimited scans",
        "100 API tokens",
        "Admin/member roles",
        "Members dashboard",
        "Bulk invites",
        "Deep Scan access",
      ],
    },
    limits: {
      advancedAnalytics: true,
      customBranding: false,
      prioritySupport: false,
      apiAccess: true,
      teamFeatures: true,
      sso: false,
    },
  },
} as const;

// Combined plans export
export const SUBSCRIPTION_PLANS = {
  ...PERSONAL_PLANS,
  ...TEAM_PLANS,
} as const;

export type PersonalPlanId = keyof typeof PERSONAL_PLANS;
export type TeamPlanId = keyof typeof TEAM_PLANS;
export type PlanId = PersonalPlanId | TeamPlanId;

// Helper functions
export function getPlanById(planId: string) {
  return SUBSCRIPTION_PLANS[planId as PlanId] || SUBSCRIPTION_PLANS.free;
}

export function isPersonalPlan(planId: string): planId is PersonalPlanId {
  return planId in PERSONAL_PLANS;
}

export function isTeamPlan(planId: string): planId is TeamPlanId {
  return planId in TEAM_PLANS;
}

export function isValidPlan(planId: string): planId is PlanId {
  return planId in SUBSCRIPTION_PLANS;
}

export function getPlanPrice(planId: PlanId): number {
  return SUBSCRIPTION_PLANS[planId].price;
}

export function getPlanFeatures(planId: PlanId) {
  return SUBSCRIPTION_PLANS[planId].features;
}

export function getPlanCategory(planId: PlanId): "personal" | "team" {
  return SUBSCRIPTION_PLANS[planId].category;
}

export function canUpgrade(currentPlan: PlanId, targetPlan: PlanId): boolean {
  const personalPlans: PlanId[] = ["free", "personal_plus", "personal_pro"];
  const teamPlans: PlanId[] = ["team_free", "team_startup", "team_business", "team_enterprise"];

  // Can't cross between personal and team
  const currentCategory = getPlanCategory(currentPlan);
  const targetCategory = getPlanCategory(targetPlan);
  if (currentCategory !== targetCategory) return false;

  const plans = currentCategory === "personal" ? personalPlans : teamPlans;
  const currentIndex = plans.indexOf(currentPlan);
  const targetIndex = plans.indexOf(targetPlan);

  return targetIndex > currentIndex;
}

export function canDowngrade(currentPlan: PlanId, targetPlan: PlanId): boolean {
  const personalPlans: PlanId[] = ["free", "personal_plus", "personal_pro"];
  const teamPlans: PlanId[] = ["team_free", "team_startup", "team_business", "team_enterprise"];

  const currentCategory = getPlanCategory(currentPlan);
  const targetCategory = getPlanCategory(targetPlan);
  if (currentCategory !== targetCategory) return false;

  const plans = currentCategory === "personal" ? personalPlans : teamPlans;
  const currentIndex = plans.indexOf(currentPlan);
  const targetIndex = plans.indexOf(targetPlan);

  return targetIndex < currentIndex;
}
