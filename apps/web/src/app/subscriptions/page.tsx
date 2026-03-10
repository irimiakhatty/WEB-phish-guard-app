import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getSession } from "@/lib/auth-helpers";
import PricingPage from "@/components/pricing-page";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";

export default async function SubscriptionsLandingPage() {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 via-white to-zinc-100/70 text-zinc-900 dark:from-zinc-950 dark:via-zinc-950 dark:to-black dark:text-zinc-100">
      {!session?.user ? (
        <div className="fixed right-4 top-4 z-50">
          <ModeToggle />
        </div>
      ) : null}

      <div className="container mx-auto max-w-7xl space-y-10 px-4 py-10">
        <div className="flex items-center justify-start">
          <Button variant="outline" asChild>
            <Link href={session?.user ? "/settings" : "/"}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>

        <div className="rounded-2xl border border-zinc-200/70 bg-white/90 px-6 py-8 shadow-sm backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/75">
          <h1 className="text-4xl font-semibold text-zinc-900 dark:text-zinc-100">
            Subscriptions
          </h1>
          <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
            Compare personal and business plans in one place. After sign in, you will be routed to
            the billing flow that matches your account type.
          </p>
        </div>

        <PricingPage
          mode="landing"
          subscriptionType="none"
          isAuthenticated={Boolean(session?.user)}
        />
      </div>
    </div>
  );
}
