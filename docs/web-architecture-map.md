# Web Architecture Map

This document is the shortest factual map of the current web app after the cleanup on 2026-03-24.

## Frontend

`apps/web/src/app/(public)`
- Public or entry-point pages.
- Contains landing, login, invite acceptance, setup, and subscription flows.

`apps/web/src/app/(app)`
- Signed-in application pages.
- Contains dashboard, admin, analyze, scans, settings, organization, and organization member routes.

`apps/web/src/components`
- Shared UI and cross-route client components.
- Good place for reusable primitives or app-wide widgets.

## Backend

`apps/web/src/server/actions`
- Internal backend logic called by the UI through Next.js server actions.
- Large files here are the main candidates for future splitting.

`apps/web/src/app/api`
- HTTP route handlers exposed to browsers, the extension, Stripe, and cron jobs.
- These files must stay under `app/api` because of Next.js routing rules.

`apps/web/src/server/api/api-manifest.ts`
- Single-file inventory of every API endpoint, method, owner file, and purpose.
- Use this as the first stop when you need to explain or discover backend endpoints.

## Biggest Monoliths

These are the files that currently create most of the cognitive load:

- `apps/web/src/server/actions/organizations.ts`
  Contains organization CRUD, invite flows, member management, departments, training, and queries.
- `apps/web/src/server/actions/analyze.ts`
  Contains the main phishing analysis pipeline.
- `apps/web/src/app/api/stripe/checkout/route.ts`
  Contains the largest HTTP handler in the app.

## Safe Cleanup Candidates

These are the best current candidates for removal or consolidation:

- `apps/web/src/app/(app)/admin/admin-dashboard.tsx`
  Safe to remove. It is not imported by any route or component anymore.
- `/admin/users` and `/admin/scans`
  Likely consolidation candidates, not immediate deletion candidates. They overlap with the tabbed `/admin` page, but they are still valid routes and can still be reached directly.

## Routes That Look Duplicate But Should Stay

- `/organization`
  This is an alias route that redirects the user to their real `/org/[slug]` destination.
- `/subscription`
  This is an alias route that redirects the user to the correct personal or business billing screen.
- `/setup`
  Only appears during first-run bootstrap, but it is still functional.
- `/ext-auth`
  Used by the browser extension handoff flow.

## Recommended Next Split

If you want the next cleanup to make the tree much easier to explain, split these files next:

1. `apps/web/src/server/actions/organizations.ts`
   Break into `organization-crud`, `organization-invites`, `organization-members`, `organization-training`, and `organization-queries`.
2. `apps/web/src/app/(app)/admin`
   Move non-route components into `apps/web/src/features/admin/components`.
3. `apps/web/src/app/api/stripe/checkout/route.ts`
   Extract pricing and Stripe session construction into `apps/web/src/server/api/stripe`.