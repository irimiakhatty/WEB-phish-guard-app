/**
 * Central inventory of HTTP endpoints exposed by the web application.
 *
 * Next.js still requires concrete route handlers to live under `src/app/api`,
 * but this file gives the team one backend-focused place to discover what exists,
 * why it exists, and which file owns it.
 */

export type ApiEndpointMethod = "GET" | "POST" | "OPTIONS";

export type ApiEndpointVisibility =
  | "session"
  | "api-token"
  | "cron"
  | "stripe-webhook"
  | "public";

export type ApiEndpoint = {
  method: ApiEndpointMethod;
  path: string;
  visibility: ApiEndpointVisibility;
  ownerFile: string;
  purpose: string;
};

export const API_ENDPOINTS: ApiEndpoint[] = [
  {
    method: "GET",
    path: "/api/auth/[...all]",
    visibility: "session",
    ownerFile: "src/app/api/auth/[...all]/route.ts",
    purpose: "Delegates Better Auth session and authentication endpoints.",
  },
  {
    method: "POST",
    path: "/api/auth/[...all]",
    visibility: "session",
    ownerFile: "src/app/api/auth/[...all]/route.ts",
    purpose: "Delegates Better Auth sign-in, sign-up, sign-out, and callback handlers.",
  },
  {
    method: "GET",
    path: "/api/user/subscription",
    visibility: "session",
    ownerFile: "src/app/api/user/subscription/route.ts",
    purpose: "Returns the current plan label and organization context for the app shell.",
  },
  {
    method: "POST",
    path: "/api/stripe/checkout",
    visibility: "session",
    ownerFile: "src/app/api/stripe/checkout/route.ts",
    purpose: "Creates or updates Stripe checkout flows for personal and business plans.",
  },
  {
    method: "GET",
    path: "/api/stripe/portal",
    visibility: "session",
    ownerFile: "src/app/api/stripe/portal/route.ts",
    purpose: "Creates a Stripe billing portal session for the current user or organization.",
  },
  {
    method: "POST",
    path: "/api/stripe/webhook",
    visibility: "stripe-webhook",
    ownerFile: "src/app/api/stripe/webhook/route.ts",
    purpose: "Receives Stripe webhook events and syncs subscription state.",
  },
  {
    method: "POST",
    path: "/api/org/invites/:inviteId/copy-link",
    visibility: "session",
    ownerFile: "src/app/api/org/invites/[inviteId]/copy-link/route.ts",
    purpose: "Builds a reusable invite link for manual sharing.",
  },
  {
    method: "POST",
    path: "/api/org/invites/:inviteId/resend",
    visibility: "session",
    ownerFile: "src/app/api/org/invites/[inviteId]/resend/route.ts",
    purpose: "Resends an existing organization invite email.",
  },
  {
    method: "POST",
    path: "/api/v1/analyze",
    visibility: "api-token",
    ownerFile: "src/app/api/v1/analyze/route.ts",
    purpose: "Runs the main phishing analysis flow for URL, text, and optional image input.",
  },
  {
    method: "POST",
    path: "/api/v1/quick-check",
    visibility: "api-token",
    ownerFile: "src/app/api/v1/quick-check/route.ts",
    purpose: "Runs a lighter-weight phishing assessment intended for fast extension checks.",
  },
  {
    method: "POST",
    path: "/api/v1/deep-scan",
    visibility: "api-token",
    ownerFile: "src/app/api/v1/deep-scan/route.ts",
    purpose: "Performs the higher-cost deep scan flow backed by the inference service.",
  },
  {
    method: "GET",
    path: "/api/v1/scans",
    visibility: "api-token",
    ownerFile: "src/app/api/v1/scans/route.ts",
    purpose: "Returns the authenticated user's historical scans.",
  },
  {
    method: "POST",
    path: "/api/v1/scans/:scanId/feedback",
    visibility: "api-token",
    ownerFile: "src/app/api/v1/scans/[scanId]/feedback/route.ts",
    purpose: "Stores user or analyst feedback for a single scan.",
  },
  {
    method: "POST",
    path: "/api/v1/incidents",
    visibility: "api-token",
    ownerFile: "src/app/api/v1/incidents/route.ts",
    purpose: "Records extension-side incident data and threat metadata.",
  },
  {
    method: "GET",
    path: "/api/v1/evaluations/summary",
    visibility: "api-token",
    ownerFile: "src/app/api/v1/evaluations/summary/route.ts",
    purpose: "Returns aggregate evaluation metrics for authenticated API consumers.",
  },
  {
    method: "GET",
    path: "/api/v1/admin/reports",
    visibility: "api-token",
    ownerFile: "src/app/api/v1/admin/reports/route.ts",
    purpose: "Provides admin risk reporting data to the dashboard.",
  },
  {
    method: "POST",
    path: "/api/v1/user-actions",
    visibility: "api-token",
    ownerFile: "src/app/api/v1/user-actions/route.ts",
    purpose: "Stores user interaction telemetry coming from the extension.",
  },
  {
    method: "GET",
    path: "/api/v1/auth/verify",
    visibility: "api-token",
    ownerFile: "src/app/api/v1/auth/verify/route.ts",
    purpose: "Validates that an API token is still active and usable.",
  },
  {
    method: "GET",
    path: "/api/v1/extension/context",
    visibility: "api-token",
    ownerFile: "src/app/api/v1/extension/context/route.ts",
    purpose: "Returns account, subscription, and recent scan context for the browser extension.",
  },
  {
    method: "GET",
    path: "/api/v1/auth/token",
    visibility: "session",
    ownerFile: "src/app/api/v1/auth/token/route.ts",
    purpose: "Lists API tokens owned by the current signed-in user.",
  },
  {
    method: "POST",
    path: "/api/v1/auth/token",
    visibility: "session",
    ownerFile: "src/app/api/v1/auth/token/route.ts",
    purpose: "Creates a new API token for the current signed-in user.",
  },
  {
    method: "OPTIONS",
    path: "/api/v1/analyze",
    visibility: "public",
    ownerFile: "src/app/api/v1/analyze/route.ts",
    purpose: "Supports CORS preflight for browser-based API consumers.",
  },
  {
    method: "OPTIONS",
    path: "/api/v1/quick-check",
    visibility: "public",
    ownerFile: "src/app/api/v1/quick-check/route.ts",
    purpose: "Supports CORS preflight for quick-check browser clients.",
  },
  {
    method: "OPTIONS",
    path: "/api/v1/scans",
    visibility: "public",
    ownerFile: "src/app/api/v1/scans/route.ts",
    purpose: "Supports CORS preflight for scan history consumers.",
  },
  {
    method: "OPTIONS",
    path: "/api/v1/scans/:scanId/feedback",
    visibility: "public",
    ownerFile: "src/app/api/v1/scans/[scanId]/feedback/route.ts",
    purpose: "Supports CORS preflight for scan feedback consumers.",
  },
  {
    method: "OPTIONS",
    path: "/api/v1/incidents",
    visibility: "public",
    ownerFile: "src/app/api/v1/incidents/route.ts",
    purpose: "Supports CORS preflight for incident reporting clients.",
  },
  {
    method: "OPTIONS",
    path: "/api/v1/extension/context",
    visibility: "public",
    ownerFile: "src/app/api/v1/extension/context/route.ts",
    purpose: "Supports CORS preflight for extension account context requests.",
  },
  {
    method: "OPTIONS",
    path: "/api/v1/auth/token",
    visibility: "public",
    ownerFile: "src/app/api/v1/auth/token/route.ts",
    purpose: "Supports CORS preflight for token creation requests.",
  },
];