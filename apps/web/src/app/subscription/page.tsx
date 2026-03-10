import type { Route } from "next";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth-helpers";
import { getBillingRouteForScope, getUserBillingSummaries } from "@/lib/billing-helpers";

export default async function SubscriptionAliasPage() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/subscriptions");
  }

  const billing = await getUserBillingSummaries(session.user.id);
  redirect(getBillingRouteForScope(billing.preferredScope) as Route);
}
