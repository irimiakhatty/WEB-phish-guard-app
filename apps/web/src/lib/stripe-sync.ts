import type Stripe from "stripe";
import prisma from "@phish-guard-app/db";
import { getPlanById } from "@/lib/subscription-plans";
import { getStripe } from "@/lib/stripe";

type SyncResult = {
  synced: boolean;
  reason?: string;
};

const toDate = (epochSeconds?: number | null) => {
  if (!epochSeconds) return null;
  return new Date(epochSeconds * 1000);
};

const resolveStripeCustomerId = (customer: Stripe.Subscription["customer"]) => {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
};

async function resolvePersonalUserId(metadata: Stripe.Metadata, stripeCustomerId: string | null) {
  if (metadata.userId) return metadata.userId;
  if (!stripeCustomerId) return null;
  const existing = await prisma.personalSubscription.findFirst({
    where: { stripeCustomerId },
    select: { userId: true },
  });
  return existing?.userId ?? null;
}

async function resolveOrganizationId(metadata: Stripe.Metadata, stripeCustomerId: string | null) {
  if (metadata.organizationId) return metadata.organizationId;
  if (!stripeCustomerId) return null;
  const existing = await prisma.subscription.findFirst({
    where: { stripeCustomerId },
    select: { organizationId: true },
  });
  return existing?.organizationId ?? null;
}

export async function syncStripeSubscription(subscription: Stripe.Subscription): Promise<SyncResult> {
  const metadata = subscription.metadata || {};
  const planId = metadata.planId;
  const subscriptionType = metadata.subscriptionType;

  if (!planId || !subscriptionType) {
    return { synced: false, reason: "missing_metadata" };
  }

  const plan = getPlanById(planId);
  const stripeCustomerId = resolveStripeCustomerId(subscription.customer);
  const stripePriceId = subscription.items.data[0]?.price?.id ?? null;
  const currentPeriodStart = toDate(subscription.current_period_start);
  const currentPeriodEnd = toDate(subscription.current_period_end);
  const canceledAt = toDate(subscription.canceled_at);

  if (subscriptionType === "team") {
    const organizationId = await resolveOrganizationId(metadata, stripeCustomerId);
    if (!organizationId) {
      return { synced: false, reason: "missing_organization" };
    }

    await prisma.subscription.upsert({
      where: { organizationId },
      create: {
        organizationId,
        plan: planId,
        status: subscription.status,
        stripeCustomerId,
        stripeSubscriptionId: subscription.id,
        stripePriceId,
        currentPeriodStart: currentPeriodStart || new Date(),
        currentPeriodEnd: currentPeriodEnd || new Date(),
        cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
        canceledAt,
        maxMembers: (plan.features as any).maxMembers ?? 3,
        scansPerMonth: (plan.features as any).scansPerMonth ?? 500,
        scansPerHourPerUser: (plan.features as any).scansPerHourPerUser ?? 25,
        maxApiTokens: (plan.features as any).maxApiTokens ?? 1,
      },
      update: {
        plan: planId,
        status: subscription.status,
        stripeCustomerId,
        stripeSubscriptionId: subscription.id,
        stripePriceId,
        currentPeriodStart: currentPeriodStart || new Date(),
        currentPeriodEnd: currentPeriodEnd || new Date(),
        cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
        canceledAt,
        maxMembers: (plan.features as any).maxMembers ?? 3,
        scansPerMonth: (plan.features as any).scansPerMonth ?? 500,
        scansPerHourPerUser: (plan.features as any).scansPerHourPerUser ?? 25,
        maxApiTokens: (plan.features as any).maxApiTokens ?? 1,
      },
    });

    return { synced: true };
  }

  if (subscriptionType === "personal") {
    const userId = await resolvePersonalUserId(metadata, stripeCustomerId);
    if (!userId) {
      return { synced: false, reason: "missing_user" };
    }

    await prisma.personalSubscription.upsert({
      where: { userId },
      create: {
        userId,
        plan: planId,
        status: subscription.status,
        stripeCustomerId,
        stripeSubscriptionId: subscription.id,
        stripePriceId,
        currentPeriodStart: currentPeriodStart || new Date(),
        currentPeriodEnd: currentPeriodEnd || new Date(),
        cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
        canceledAt,
        scansPerMonth: (plan.features as any).scansPerMonth ?? 100,
        scansPerHour: (plan.features as any).scansPerHour ?? 25,
        maxApiTokens: (plan.features as any).maxApiTokens ?? 1,
      },
      update: {
        plan: planId,
        status: subscription.status,
        stripeCustomerId,
        stripeSubscriptionId: subscription.id,
        stripePriceId,
        currentPeriodStart: currentPeriodStart || new Date(),
        currentPeriodEnd: currentPeriodEnd || new Date(),
        cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
        canceledAt,
        scansPerMonth: (plan.features as any).scansPerMonth ?? 100,
        scansPerHour: (plan.features as any).scansPerHour ?? 25,
        maxApiTokens: (plan.features as any).maxApiTokens ?? 1,
      },
    });

    return { synced: true };
  }

  return { synced: false, reason: "unsupported_subscription_type" };
}

export async function syncStripeCheckoutSession(sessionId: string): Promise<SyncResult> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"],
  });

  const subscription = session.subscription as Stripe.Subscription | null;
  if (!subscription) {
    return { synced: false, reason: "missing_subscription" };
  }

  return syncStripeSubscription(subscription);
}
