import PricingPage from "@/components/pricing-page";
import { getSession } from "@/lib/auth/auth-helpers";

const PAGE_SHELL =
  "mx-auto w-full max-w-[1680px] px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20";

const ENTRY_POINTS = [
  {
    label: "Personal",
    description: "For individual browser protection, personal scan history, and flexible limits.",
  },
  {
    label: "Business",
    description: "For admin rollout, shared visibility, member management, and organization billing.",
  },
] as const;

export default async function SubscriptionsLandingPage() {
  const session = await getSession();
  const isAuthenticated = Boolean(session?.user);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="pb-14">
        <section className="border-b border-border bg-background">
          <div className={`${PAGE_SHELL} space-y-10 pb-12 pt-10 lg:pb-14 lg:pt-12`}>
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.04fr)_minmax(360px,0.96fr)] lg:items-start">
              <div className="max-w-3xl space-y-6">
                <p className="inline-flex rounded-full border border-border bg-muted px-4 py-1.5 text-xs font-semibold text-foreground">
                  Plans and billing
                </p>
                <div className="space-y-3">
                  <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                    Compare personal and business protection in one place
                  </h1>
                  <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                    Browse every PhishGuard tier before you commit. When you are ready, we route
                    you into the signup or billing flow that matches your account type.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-6 shadow-none">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-950/55 dark:text-cyan-100/55">
                  Choose your path
                </p>
                <div className="mt-5 space-y-4">
                  {ENTRY_POINTS.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl border border-border bg-muted/50 p-4"
                    >
                      <p className="text-sm font-semibold text-foreground">{item.label}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={`${PAGE_SHELL} py-12`}>
          <PricingPage mode="landing" subscriptionType="none" isAuthenticated={isAuthenticated} />
        </section>
      </main>
    </div>
  );
}
