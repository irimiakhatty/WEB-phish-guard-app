# Stripe Dev Workflow (Local)

This project uses Stripe test mode and a webhook to sync subscriptions.

## 1) Install Stripe CLI
Follow the Stripe CLI install guide: https://stripe.com/docs/stripe-cli

## 2) Login
```bash
stripe login
```

## 3) Start a local webhook listener
```bash
stripe listen --forward-to http://localhost:3001/api/stripe/webhook
```

The CLI prints a `whsec_...` signing secret. Add it to `apps/web/.env`:
```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

## 4) Trigger a test event
```bash
stripe trigger checkout.session.completed
```

## Notes
- Use test keys (`sk_test_...`, `pk_test_...`) in `apps/web/.env`.
- Checkout URLs redirect to `/subscriptions/success` and `/subscriptions/cancel`.
- The webhook updates `PersonalSubscription` or `Subscription` records based on metadata.
