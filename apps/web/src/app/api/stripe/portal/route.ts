import { NextResponse } from "next/server";
import prisma from "@phish-guard-app/db";
import { requireAuth } from "@/lib/auth-helpers";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const appOrigin = process.env.BETTER_AUTH_URL || `${url.protocol}//${url.host}`;
  const returnUrl = `${appOrigin}/settings`;

  try {
    const session = await requireAuth();
    const organizationSlug = url.searchParams.get("organizationSlug");
    let stripeCustomerId: string | null = null;

    if (organizationSlug) {
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
        return NextResponse.redirect(
          `${returnUrl}?billingError=${encodeURIComponent("Organization not found.")}`,
          303
        );
      }

      const isSuperAdmin = session.user.role === "super_admin";
      const isOrgAdmin =
        isSuperAdmin || organization.members.some((m) => m.role === "admin");

      if (!isOrgAdmin) {
        return NextResponse.redirect(
          `${returnUrl}?billingError=${encodeURIComponent(
            "Only organization admins can manage billing."
          )}`,
          303
        );
      }

      stripeCustomerId = organization.subscription?.stripeCustomerId ?? null;
    } else {
      const personalSubscription = await prisma.personalSubscription.findUnique({
        where: { userId: session.user.id },
        select: { stripeCustomerId: true },
      });
      stripeCustomerId = personalSubscription?.stripeCustomerId ?? null;
    }

    if (!stripeCustomerId) {
      return NextResponse.redirect(
        `${returnUrl}?billingError=${encodeURIComponent(
          "No Stripe customer yet. Choose a paid plan first."
        )}`,
        303
      );
    }

    const stripe = getStripe();
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${appOrigin}/subscriptions`,
    });

    return NextResponse.redirect(portalSession.url, 303);
  } catch (error: any) {
    const message = error?.message || "Could not open Stripe billing portal.";
    return NextResponse.redirect(
      `${returnUrl}?billingError=${encodeURIComponent(message)}`,
      303
    );
  }
}
