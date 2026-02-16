import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth-helpers";
import { getUserSubscriptionInfo } from "@/lib/subscription-helpers";

export default async function OrganizationLandingPage() {
  const session = await requireAuth();

  if (session.user.role === "super_admin") {
    redirect("/organizations");
  }

  const subInfo = await getUserSubscriptionInfo(session.user.id);
  if (subInfo.organizationSlug) {
    redirect(`/org/${subInfo.organizationSlug}`);
  }

  redirect("/dashboard");
}
