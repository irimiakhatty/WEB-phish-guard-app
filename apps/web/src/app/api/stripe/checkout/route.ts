import { NextResponse } from "next/server";
import prisma from "@phish-guard-app/db";
import { requireAuth } from "@/lib/auth-helpers";
import { getPlanById, isTeamPlan, isValidPlan } from "@/lib/subscription-plans";
import { getStripe } from "@/lib/stripe";
import { syncStripeSubscription } from "@/lib/stripe-sync";

export const runtime = "nodejs";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function getDefaultPeriodEnd() {
  return new Date(Date.now() + THIRTY_DAYS_MS);
}

async function createSubscriptionUpdateUrl(params: {
  stripe: ReturnType<typeof getStripe>;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  targetPriceId: string;
  origin: string;
  metadata: Record<string, string>;
}) {
  const currentSubscription = await params.stripe.subscriptions.retrieve(
    params.stripeSubscriptionId
  );
  const currentItem = currentSubscription.items.data[0];

  if (!currentItem) {
    throw new Error("Stripe subscription item is missing.");
  }

  if (currentItem.price.id === params.targetPriceId) {
    return `${params.origin}/subscriptions?updated=1`;
  }

  try {
    const portalSession = await params.stripe.billingPortal.sessions.create({
      customer: params.stripeCustomerId,
      return_url: `${params.origin}/subscriptions`,
      flow_data: {
        type: "subscription_update_confirm",
        subscription_update_confirm: {
          subscription: params.stripeSubscriptionId,
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

    return portalSession.url;
  } catch {
    const updatedSubscription = await params.stripe.subscriptions.update(
      params.stripeSubscriptionId,
      {
        items: [{ id: currentItem.id, price: params.targetPriceId, quantity: 1 }],
        proration_behavior: "create_prorations",
        metadata: {
          ...currentSubscription.metadata,
          ...params.metadata,
        },
      }
    );
    await syncStripeSubscription(updatedSubscription);

    return `${params.origin}/subscriptions/success?updated=1`;
  }
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
          try {
            await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
          } catch (err) {
            console.error("Failed to cancel team Stripe subscription:", err);
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
          url: `${origin}/subscriptions/success?updated=1`,
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
        const updateUrl = await createSubscriptionUpdateUrl({
          stripe,
          stripeCustomerId,
          stripeSubscriptionId: subscription.stripeSubscriptionId,
          targetPriceId: plan.stripePriceId,
          origin,
          metadata: {
            planId,
            organizationId: organization.id,
            subscriptionType: "team",
          },
        });

        return NextResponse.json({ url: updateUrl });
      }

      const checkoutSession = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: stripeCustomerId,
        line_items: [{ price: plan.stripePriceId, quantity: 1 }],
        success_url: `${origin}/subscriptions/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/subscriptions/cancel`,
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
        try {
          await stripe.subscriptions.cancel(personalSubscription.stripeSubscriptionId);
        } catch (err) {
          console.error("Failed to cancel personal Stripe subscription:", err);
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
        url: `${origin}/subscriptions/success?updated=1`,
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
      const updateUrl = await createSubscriptionUpdateUrl({
        stripe,
        stripeCustomerId,
        stripeSubscriptionId: personalSubscription.stripeSubscriptionId,
        targetPriceId: plan.stripePriceId,
        origin,
        metadata: {
          planId,
          userId: session.user.id,
          subscriptionType: "personal",
        },
      });

      return NextResponse.json({ url: updateUrl });
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: `${origin}/subscriptions/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/subscriptions/cancel`,
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
