import type Stripe from "stripe";
import { NextResponse } from "next/server";
import prisma from "@phish-guard-app/db";
import { requireAuth } from "@/lib/auth-helpers";
import { getPlanById, isTeamPlan, isValidPlan } from "@/lib/subscription-plans";
import { getStripe } from "@/lib/stripe";
import { syncStripeSubscription } from "@/lib/stripe-sync";

export const runtime = "nodejs";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const NON_REUSABLE_STRIPE_SUBSCRIPTION_STATUSES = new Set<
  Stripe.Subscription.Status
>(["canceled", "incomplete", "incomplete_expired"]);

type CheckoutFlowResult = {
  url?: string;
  message?: string;
};

function getBillingPath(scope: "personal" | "business") {
  return scope === "business"
    ? "/subscriptions/business"
    : "/subscriptions/personal";
}

function getDefaultPeriodEnd() {
  return new Date(Date.now() + THIRTY_DAYS_MS);
}

function formatPeriodEnd(epochSeconds?: number | null) {
  if (!epochSeconds) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
  }).format(new Date(epochSeconds * 1000));
}

async function retrieveReusableStripeSubscription(params: {
  stripe: ReturnType<typeof getStripe>;
  stripeSubscriptionId: string;
}) {
  try {
    const subscription = await params.stripe.subscriptions.retrieve(
      params.stripeSubscriptionId
    );

    if (
      NON_REUSABLE_STRIPE_SUBSCRIPTION_STATUSES.has(
        subscription.status as Stripe.Subscription.Status
      )
    ) {
      return null;
    }

    return subscription;
  } catch (error: any) {
    if (error?.code === "resource_missing" || error?.statusCode === 404) {
      return null;
    }

    throw error;
  }
}

async function createSubscriptionUpdateUrl(params: {
  stripe: ReturnType<typeof getStripe>;
  stripeCustomerId: string;
  currentSubscription: Stripe.Subscription;
  targetPriceId: string;
  origin: string;
  returnPath: string;
  metadata: Record<string, string>;
}): Promise<CheckoutFlowResult> {
  const currentItem = params.currentSubscription.items.data[0];

  if (!currentItem) {
    throw new Error("Stripe subscription item is missing.");
  }

  if (currentItem.price.id === params.targetPriceId) {
    if (params.currentSubscription.cancel_at_period_end) {
      const resumedSubscription = await params.stripe.subscriptions.update(
        params.currentSubscription.id,
        {
          cancel_at_period_end: false,
          metadata: {
            ...params.currentSubscription.metadata,
            ...params.metadata,
          },
        }
      );
      await syncStripeSubscription(resumedSubscription);

      return {
        message:
          "Automatic downgrade removed. Your paid plan will continue renewing normally.",
      };
    }

    return { message: "This plan is already active." };
  }

  try {
    const portalSession = await params.stripe.billingPortal.sessions.create({
      customer: params.stripeCustomerId,
      return_url: `${params.origin}${params.returnPath}`,
      flow_data: {
        type: "subscription_update_confirm",
        subscription_update_confirm: {
          subscription: params.currentSubscription.id,
          items: [
            {
              id: currentItem.id,
              price: params.targetPriceId,
              quantity: 1,
            },
          ],
        },
      },
    });

    return { url: portalSession.url };
  } catch {
    throw new Error("Could not open Stripe to confirm the billing change.");
  }
}

async function scheduleCancellationAtPeriodEnd(params: {
  stripe: ReturnType<typeof getStripe>;
  stripeSubscriptionId: string;
  metadata: Record<string, string>;
}): Promise<CheckoutFlowResult | null> {
  const currentSubscription = await retrieveReusableStripeSubscription({
    stripe: params.stripe,
    stripeSubscriptionId: params.stripeSubscriptionId,
  });

  if (!currentSubscription) {
    return null;
  }

  const periodEndLabel = formatPeriodEnd(currentSubscription.current_period_end);

  if (currentSubscription.cancel_at_period_end) {
    return {
      message: periodEndLabel
        ? `Downgrade to Free already scheduled. Your paid benefits stay active until ${periodEndLabel}, then the account switches to Free with no further charges.`
        : "Downgrade to Free already scheduled at the end of the paid billing period.",
    };
  }

  const updatedSubscription = await params.stripe.subscriptions.update(
    currentSubscription.id,
    {
      cancel_at_period_end: true,
      metadata: {
        ...currentSubscription.metadata,
        ...params.metadata,
      },
    }
  );
  await syncStripeSubscription(updatedSubscription);

  const updatedPeriodEndLabel = formatPeriodEnd(
    updatedSubscription.current_period_end
  );

  return {
    message: updatedPeriodEndLabel
      ? `Downgrade scheduled. Your paid plan remains active until ${updatedPeriodEndLabel}. After that, the account switches to Free with no further charges.`
      : "Downgrade scheduled. Your paid plan remains active until the current billing period ends, then the account switches to Free with no further charges.",
  };
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    const body = await req.json().catch(() => null);
    const planId = body?.planId as string | undefined;
    const organizationSlug = body?.organizationSlug as string | undefined;

    if (!planId) {
      return NextResponse.json({ error: "Plan id is required." }, { status: 400 });
    }
    if (!isValidPlan(planId)) {
      return NextResponse.json({ error: "Invalid plan id." }, { status: 400 });
    }

    const plan = getPlanById(planId);

    const origin =
      req.headers.get("origin") ||
      process.env.BETTER_AUTH_URL ||
      "http://localhost:3001";
    const personalBillingPath = getBillingPath("personal");
    const businessBillingPath = getBillingPath("business");
    const stripe = getStripe();

    if (isTeamPlan(planId as any)) {
      if (!organizationSlug) {
        return NextResponse.json(
          { error: "Organization slug is required." },
          { status: 400 }
        );
      }

      const organization = await prisma.organization.findUnique({
        where: { slug: organizationSlug },
        include: {
          subscription: true,
          members: {
            where: { userId: session.user.id },
          },
        },
      });

      if (!organization) {
        return NextResponse.json(
          { error: "Organization not found." },
          { status: 404 }
        );
      }

      const isSuperAdmin = session.user.role === "super_admin";
      const isOrgAdmin =
        isSuperAdmin || organization.members.some((m) => m.role === "admin");

      if (!isOrgAdmin) {
        return NextResponse.json(
          { error: "Only organization admins can upgrade." },
          { status: 403 }
        );
      }

      let subscription = organization.subscription;
      if (!subscription) {
        subscription = await prisma.subscription.create({
          data: {
            organizationId: organization.id,
            plan: "team_free",
            status: "active",
            currentPeriodEnd: getDefaultPeriodEnd(),
          },
        });
      }
      if (planId === "team_free") {
        if (subscription.stripeSubscriptionId) {
          const scheduledDowngrade = await scheduleCancellationAtPeriodEnd({
            stripe,
            stripeSubscriptionId: subscription.stripeSubscriptionId,
            metadata: {
              organizationId: organization.id,
              subscriptionType: "team",
            },
          });

          if (scheduledDowngrade) {
            return NextResponse.json(scheduledDowngrade);
          }
        }

        const freePlan = getPlanById("team_free");
        await prisma.subscription.update({
          where: { organizationId: organization.id },
          data: {
            plan: "team_free",
            status: "active",
            stripePriceId: null,
            stripeSubscriptionId: null,
            cancelAtPeriodEnd: false,
            canceledAt: null,
            currentPeriodStart: new Date(),
            currentPeriodEnd: getDefaultPeriodEnd(),
            maxMembers: (freePlan.features as any).maxMembers ?? 3,
            scansPerMonth: (freePlan.features as any).scansPerMonth ?? 500,
            scansPerHourPerUser:
              (freePlan.features as any).scansPerHourPerUser ?? 25,
            maxApiTokens: (freePlan.features as any).maxApiTokens ?? 1,
          },
        });

        return NextResponse.json({
          url: `${origin}/subscriptions/success?updated=1&scope=business`,
        });
      }

      if (!plan.stripePriceId) {
        return NextResponse.json(
          { error: "Selected team plan is not available for checkout." },
          { status: 400 }
        );
      }

      let stripeCustomerId = subscription.stripeCustomerId;
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: session.user.email,
          name: organization.name,
          metadata: {
            organizationId: organization.id,
            subscriptionType: "team",
          },
        });
        stripeCustomerId = customer.id;
        await prisma.subscription.update({
          where: { organizationId: organization.id },
          data: { stripeCustomerId },
        });
      }
      if (subscription.stripeSubscriptionId) {
        const currentStripeSubscription = await retrieveReusableStripeSubscription({
          stripe,
          stripeSubscriptionId: subscription.stripeSubscriptionId,
        });

        if (currentStripeSubscription) {
          const updateFlow = await createSubscriptionUpdateUrl({
            stripe,
            stripeCustomerId,
            currentSubscription: currentStripeSubscription,
            targetPriceId: plan.stripePriceId,
            origin,
            returnPath: businessBillingPath,
            metadata: {
              planId,
              organizationId: organization.id,
              subscriptionType: "team",
            },
          });

          return NextResponse.json(updateFlow);
        }

        await prisma.subscription.update({
          where: { organizationId: organization.id },
          data: {
            stripeSubscriptionId: null,
            stripePriceId: null,
            cancelAtPeriodEnd: false,
          },
        });
      }

      const checkoutSession = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: stripeCustomerId,
        line_items: [{ price: plan.stripePriceId, quantity: 1 }],
        success_url: `${origin}/subscriptions/success?session_id={CHECKOUT_SESSION_ID}&scope=business`,
        cancel_url: `${origin}/subscriptions/cancel?scope=business`,
        metadata: {
          planId,
          organizationId: organization.id,
          subscriptionType: "team",
        },
        subscription_data: {
          metadata: {
            planId,
            organizationId: organization.id,
            subscriptionType: "team",
          },
        },
      });

      return NextResponse.json({ url: checkoutSession.url });
    }

    const adminMembershipCount = await prisma.organizationMember.count({
      where: {
        userId: session.user.id,
        role: "admin",
      },
    });
    if (adminMembershipCount > 0 || session.user.role === "super_admin") {
      return NextResponse.json(
        {
          error:
            "Organization admins can only manage business subscriptions from the business billing page.",
        },
        { status: 403 }
      );
    }

    let personalSubscription = await prisma.personalSubscription.findUnique({
      where: { userId: session.user.id },
    });

    if (!personalSubscription) {
      personalSubscription = await prisma.personalSubscription.create({
        data: {
          userId: session.user.id,
          plan: "free",
          status: "active",
          currentPeriodEnd: getDefaultPeriodEnd(),
        },
      });
    }
    if (planId === "free") {
      if (personalSubscription.stripeSubscriptionId) {
        const scheduledDowngrade = await scheduleCancellationAtPeriodEnd({
          stripe,
          stripeSubscriptionId: personalSubscription.stripeSubscriptionId,
          metadata: {
            userId: session.user.id,
            subscriptionType: "personal",
          },
        });

        if (scheduledDowngrade) {
          return NextResponse.json(scheduledDowngrade);
        }
      }

      const freePlan = getPlanById("free");
      await prisma.personalSubscription.update({
        where: { userId: session.user.id },
        data: {
          plan: "free",
          status: "active",
          stripePriceId: null,
          stripeSubscriptionId: null,
          cancelAtPeriodEnd: false,
          canceledAt: null,
          currentPeriodStart: new Date(),
          currentPeriodEnd: getDefaultPeriodEnd(),
          scansPerMonth: (freePlan.features as any).scansPerMonth ?? 100,
          scansPerHour: (freePlan.features as any).scansPerHour ?? 25,
          maxApiTokens: (freePlan.features as any).maxApiTokens ?? 1,
        },
      });

      return NextResponse.json({
        url: `${origin}/subscriptions/success?updated=1&scope=personal`,
      });
    }

    if (!plan.stripePriceId) {
      return NextResponse.json(
        { error: "Selected personal plan is not available for checkout." },
        { status: 400 }
      );
    }

    let stripeCustomerId = personalSubscription.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: session.user.email,
        name: session.user.name || session.user.email,
        metadata: {
          userId: session.user.id,
          subscriptionType: "personal",
        },
      });
      stripeCustomerId = customer.id;
      await prisma.personalSubscription.update({
        where: { userId: session.user.id },
        data: { stripeCustomerId },
      });
    }
    if (personalSubscription.stripeSubscriptionId) {
      const currentStripeSubscription = await retrieveReusableStripeSubscription({
        stripe,
        stripeSubscriptionId: personalSubscription.stripeSubscriptionId,
      });

      if (currentStripeSubscription) {
        const updateFlow = await createSubscriptionUpdateUrl({
          stripe,
          stripeCustomerId,
            currentSubscription: currentStripeSubscription,
            targetPriceId: plan.stripePriceId,
            origin,
            returnPath: personalBillingPath,
            metadata: {
              planId,
              userId: session.user.id,
            subscriptionType: "personal",
          },
        });

        return NextResponse.json(updateFlow);
      }

      await prisma.personalSubscription.update({
        where: { userId: session.user.id },
        data: {
          stripeSubscriptionId: null,
          stripePriceId: null,
          cancelAtPeriodEnd: false,
        },
      });
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: `${origin}/subscriptions/success?session_id={CHECKOUT_SESSION_ID}&scope=personal`,
      cancel_url: `${origin}/subscriptions/cancel?scope=personal`,
      metadata: {
        planId,
        userId: session.user.id,
        subscriptionType: "personal",
      },
      subscription_data: {
        metadata: {
          planId,
          userId: session.user.id,
          subscriptionType: "personal",
        },
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error: any) {
    const message = error?.message || "Checkout failed.";
    const status =
      message.toLowerCase().includes("unauthorized") ||
      message.toLowerCase().includes("login")
        ? 401
        : 500;
    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}
