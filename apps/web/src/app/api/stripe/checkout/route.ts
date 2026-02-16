import { NextResponse } from "next/server";
import prisma from "@phish-guard-app/db";
import { requireAuth } from "@/lib/auth-helpers";
import { getPlanById, isTeamPlan } from "@/lib/subscription-plans";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    const body = await req.json().catch(() => null);
    const planId = body?.planId as string | undefined;
    const organizationSlug = body?.organizationSlug as string | undefined;

    if (!planId) {
      return NextResponse.json({ error: "Plan id is required." }, { status: 400 });
    }

    const plan = getPlanById(planId);
    if (!plan.stripePriceId || plan.price === 0) {
      return NextResponse.json(
        { error: "Selected plan is not available for checkout." },
        { status: 400 }
      );
    }

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
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
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
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
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
