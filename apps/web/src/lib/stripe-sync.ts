import type Stripe from "stripe";
import prisma from "@phish-guard-app/db";
import {
  getPlanById,
  isValidPlan,
  SUBSCRIPTION_PLANS,
  type PlanId,
} from "@/lib/subscription-plans";
import { getStripe } from "@/lib/stripe";

type SyncResult = {
  synced: boolean;
  reason?: string;
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const INCOMPLETE_STRIPE_SUBSCRIPTION_STATUSES = new Set<
  Stripe.Subscription.Status
>(["incomplete", "incomplete_expired"]);

const toDate = (epochSeconds?: number | null) => {
  if (!epochSeconds) return null;
  return new Date(epochSeconds * 1000);
};

const resolveStripeCustomerId = (customer: Stripe.Subscription["customer"]) => {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
};

const getDefaultPeriodEnd = (anchor: Date) =>
  new Date(anchor.getTime() + THIRTY_DAYS_MS);

const resolvePlanIdFromPriceId = (stripePriceId: string | null): PlanId | null => {
  if (!stripePriceId) {
    return null;
  }

  const matchedPlan = Object.values(SUBSCRIPTION_PLANS).find(
    (plan) => plan.stripePriceId === stripePriceId
  );

  return (matchedPlan?.id as PlanId | undefined) ?? null;
};

const resolveSyncedPlanId = (
  metadataPlanId: string | undefined,
  stripePriceId: string | null
): PlanId | null => {
  const pricePlanId = resolvePlanIdFromPriceId(stripePriceId);
  if (pricePlanId) {
    return pricePlanId;
  }

  if (metadataPlanId && isValidPlan(metadataPlanId)) {
    return metadataPlanId;
  }

  return null;
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
  const subscriptionType = metadata.subscriptionType;

  if (!subscriptionType) {
    return { synced: false, reason: "missing_metadata" };
  }
  const stripeCustomerId = resolveStripeCustomerId(subscription.customer);
  const stripePriceId = subscription.items.data[0]?.price?.id ?? null;
  const currentPeriodStart = toDate(subscription.current_period_start);
  const currentPeriodEnd = toDate(subscription.current_period_end);
  const canceledAt = toDate(subscription.canceled_at);
  const syncedPlanId = resolveSyncedPlanId(metadata.planId, stripePriceId);

  if (
    INCOMPLETE_STRIPE_SUBSCRIPTION_STATUSES.has(
      subscription.status as Stripe.Subscription.Status
    )
  ) {
    return { synced: false, reason: "awaiting_payment" };
  }

  if (subscriptionType === "team") {
    const organizationId = await resolveOrganizationId(metadata, stripeCustomerId);
    if (!organizationId) {
      return { synced: false, reason: "missing_organization" };
    }

    if (subscription.status === "canceled") {
      const plan = getPlanById("team_free");
      const freePeriodStart = currentPeriodEnd || new Date();
      const stripeCustomerData = stripeCustomerId ? { stripeCustomerId } : {};

      await prisma.subscription.upsert({
        where: { organizationId },
        create: {
          organizationId,
          plan: "team_free",
          status: "active",
          stripeSubscriptionId: null,
          stripePriceId: null,
          currentPeriodStart: freePeriodStart,
          currentPeriodEnd: getDefaultPeriodEnd(freePeriodStart),
          cancelAtPeriodEnd: false,
          canceledAt: null,
          maxMembers: (plan.features as any).maxMembers ?? 3,
          scansPerMonth: (plan.features as any).scansPerMonth ?? 500,
          scansPerHourPerUser: (plan.features as any).scansPerHourPerUser ?? 25,
          maxApiTokens: (plan.features as any).maxApiTokens ?? 1,
          ...stripeCustomerData,
        },
        update: {
          plan: "team_free",
          status: "active",
          stripeSubscriptionId: null,
          stripePriceId: null,
          currentPeriodStart: freePeriodStart,
          currentPeriodEnd: getDefaultPeriodEnd(freePeriodStart),
          cancelAtPeriodEnd: false,
          canceledAt: null,
          maxMembers: (plan.features as any).maxMembers ?? 3,
          scansPerMonth: (plan.features as any).scansPerMonth ?? 500,
          scansPerHourPerUser: (plan.features as any).scansPerHourPerUser ?? 25,
          maxApiTokens: (plan.features as any).maxApiTokens ?? 1,
          ...stripeCustomerData,
        },
      });

      return { synced: true };
    }

    if (!syncedPlanId) {
      return { synced: false, reason: "missing_plan" };
    }

    const plan = getPlanById(syncedPlanId);
    const stripeCustomerData = stripeCustomerId ? { stripeCustomerId } : {};

    await prisma.subscription.upsert({
      where: { organizationId },
      create: {
        organizationId,
        plan: syncedPlanId,
        status: subscription.status,
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
        ...stripeCustomerData,
      },
      update: {
        plan: syncedPlanId,
        status: subscription.status,
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
        ...stripeCustomerData,
      },
    });

    return { synced: true };
  }

  if (subscriptionType === "personal") {
    const userId = await resolvePersonalUserId(metadata, stripeCustomerId);
    if (!userId) {
      return { synced: false, reason: "missing_user" };
    }

    if (subscription.status === "canceled") {
      const plan = getPlanById("free");
      const freePeriodStart = currentPeriodEnd || new Date();
      const stripeCustomerData = stripeCustomerId ? { stripeCustomerId } : {};

      await prisma.personalSubscription.upsert({
        where: { userId },
        create: {
          userId,
          plan: "free",
          status: "active",
          stripeSubscriptionId: null,
          stripePriceId: null,
          currentPeriodStart: freePeriodStart,
          currentPeriodEnd: getDefaultPeriodEnd(freePeriodStart),
          cancelAtPeriodEnd: false,
          canceledAt: null,
          scansPerMonth: (plan.features as any).scansPerMonth ?? 100,
          scansPerHour: (plan.features as any).scansPerHour ?? 25,
          maxApiTokens: (plan.features as any).maxApiTokens ?? 1,
          ...stripeCustomerData,
        },
        update: {
          plan: "free",
          status: "active",
          stripeSubscriptionId: null,
          stripePriceId: null,
          currentPeriodStart: freePeriodStart,
          currentPeriodEnd: getDefaultPeriodEnd(freePeriodStart),
          cancelAtPeriodEnd: false,
          canceledAt: null,
          scansPerMonth: (plan.features as any).scansPerMonth ?? 100,
          scansPerHour: (plan.features as any).scansPerHour ?? 25,
          maxApiTokens: (plan.features as any).maxApiTokens ?? 1,
          ...stripeCustomerData,
        },
      });

      return { synced: true };
    }

    if (!syncedPlanId) {
      return { synced: false, reason: "missing_plan" };
    }

    const plan = getPlanById(syncedPlanId);
    const stripeCustomerData = stripeCustomerId ? { stripeCustomerId } : {};

    await prisma.personalSubscription.upsert({
      where: { userId },
      create: {
        userId,
        plan: syncedPlanId,
        status: subscription.status,
        stripeSubscriptionId: subscription.id,
        stripePriceId,
        currentPeriodStart: currentPeriodStart || new Date(),
        currentPeriodEnd: currentPeriodEnd || new Date(),
        cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
        canceledAt,
        scansPerMonth: (plan.features as any).scansPerMonth ?? 100,
        scansPerHour: (plan.features as any).scansPerHour ?? 25,
        maxApiTokens: (plan.features as any).maxApiTokens ?? 1,
        ...stripeCustomerData,
      },
      update: {
        plan: syncedPlanId,
        status: subscription.status,
        stripeSubscriptionId: subscription.id,
        stripePriceId,
        currentPeriodStart: currentPeriodStart || new Date(),
        currentPeriodEnd: currentPeriodEnd || new Date(),
        cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
        canceledAt,
        scansPerMonth: (plan.features as any).scansPerMonth ?? 100,
        scansPerHour: (plan.features as any).scansPerHour ?? 25,
        maxApiTokens: (plan.features as any).maxApiTokens ?? 1,
        ...stripeCustomerData,
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
