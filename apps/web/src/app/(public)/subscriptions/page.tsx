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
        <section className="relative overflow-hidden border-b border-border">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -left-24 -top-28 h-72 w-72 rounded-full bg-cyan-500/7 blur-3xl dark:bg-cyan-400/9" />
            <div className="absolute -right-24 -top-20 h-80 w-80 rounded-full bg-fuchsia-500/5 blur-3xl dark:bg-fuchsia-400/7" />
          </div>

          <div className={`${PAGE_SHELL} relative space-y-10 pb-12 pt-10 lg:pb-14 lg:pt-12`}>
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.04fr)_minmax(360px,0.96fr)] lg:items-start">
              <div className="max-w-3xl space-y-6">
                <p className="inline-flex rounded-full border border-cyan-200/80 bg-white/80 px-4 py-1.5 text-xs font-semibold text-zinc-950 shadow-sm shadow-zinc-950/5 backdrop-blur dark:border-cyan-400/25 dark:bg-cyan-950/20 dark:text-cyan-100">
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

              <div className="rounded-[28px] border border-cyan-400/18 bg-white/82 p-6 shadow-xl shadow-black/25 backdrop-blur dark:bg-zinc-950/82">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-950/55 dark:text-cyan-100/55">
                  Choose your path
                </p>
                <div className="mt-5 space-y-4">
                  {ENTRY_POINTS.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-[22px] border border-cyan-200/70 bg-cyan-50/45 p-4 dark:border-cyan-400/18 dark:bg-black/15"
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
