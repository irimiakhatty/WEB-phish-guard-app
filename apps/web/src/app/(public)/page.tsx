import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowRight, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentYear, getSession } from "@/lib/auth/auth-helpers";

const EXTENSION_ID =
  process.env.NEXT_PUBLIC_EXTENSION_ID || "bgmpigmggkapcphapehhjfmghfcdeloh";

const CHROME_STORE_URL =
  process.env.NEXT_PUBLIC_CHROME_STORE_URL ||
  `https://chromewebstore.google.com/detail/phishguard-ai-phishing-de/${EXTENSION_ID}`;

const START_PATHS = [
  {
    label: "For Individuals",
    description: "Check suspicious emails and links directly in the browser with instant verdicts.",
  },
  {
    label: "For Teams",
    description: "Add shared visibility, rollout support, and admin follow-up for your organization.",
  },
];

const CORE_BENEFITS = [
  {
    title: "Real-time warnings",
    description: "Surface risk while users read email, not after the click.",
  },
  {
    title: "Clear verdicts",
    description: "Use simple safe, warning, and high-risk signals people act on fast.",
  },
  {
    title: "Shared visibility",
    description: "Move from personal protection to team oversight without changing products.",
  },
] as const;

const PAGE_SHELL =
  "mx-auto w-full max-w-[1680px] px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20";

export default async function Home() {
  const session = await getSession();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="pb-14">
        <section className="relative overflow-hidden border-b border-border">
          <div className={`${PAGE_SHELL} relative grid gap-10 pb-14 pt-14 lg:grid-cols-[minmax(0,1.02fr)_minmax(560px,0.98fr)] lg:items-center lg:gap-12 xl:gap-16 xl:py-18`}>
            <div className="max-w-3xl space-y-7">
              <div className="flex items-center gap-3">
                <Image
                  src="/icon.png"
                  alt="PhishGuard logo"
                  width={52}
                  height={52}
                  className="h-12 w-12 rounded-xl"
                />
                <p className="text-4xl font-semibold tracking-tight">PhishGuard</p>
              </div>

              <p className="inline-flex rounded-full border border-cyan-200/80 bg-white px-4 py-1.5 text-xs font-semibold text-zinc-950 shadow-sm shadow-zinc-950/5 dark:border-cyan-400/25 dark:bg-cyan-950 dark:text-cyan-100">
                Browser phishing protection for individuals and teams
              </p>

              <h1 className="max-w-4xl text-5xl font-semibold leading-[0.98] tracking-tight sm:text-6xl xl:text-[4.25rem]">
                Protect every inbox
                <span className="block text-cyan-300 [text-shadow:0_0_24px_rgba(34,211,238,0.22)]">
                  before the click
                </span>
              </h1>

              <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                Real-time browser warnings for Gmail and Outlook, built for suspicious links,
                personal protection, and team-wide visibility.
              </p>

              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  size="lg"
                  className="shadow-[0_0_0_1px_rgba(0,229,255,0.25),0_0_40px_rgba(0,229,255,0.12)] hover:shadow-[0_0_0_1px_rgba(0,229,255,0.3),0_0_52px_rgba(0,229,255,0.16)]"
                  asChild
                >
                  <a
                    href={CHROME_STORE_URL}
                    target={CHROME_STORE_URL !== "#" ? "_blank" : undefined}
                    rel={CHROME_STORE_URL !== "#" ? "noreferrer" : undefined}
                  >
                    Install extension
                  </a>
                </Button>

                <Button
                  size="lg"
                  variant="outline"
                  className="border-cyan-400/25 bg-background text-foreground hover:bg-cyan-50 hover:text-foreground dark:text-cyan-100 dark:hover:bg-cyan-950"
                  asChild
                >
                  <Link href="/subscriptions">Compare plans</Link>
                </Button>

                <Button
                  size="lg"
                  variant="ghost"
                  className="group text-cyan-950 hover:bg-cyan-50 hover:text-cyan-950 dark:text-cyan-100 dark:hover:bg-cyan-950 dark:hover:text-cyan-50"
                  asChild
                >
                  <Link href="/login">
                    Start now
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </Link>
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {START_PATHS.map((path) => (
                  <div
                    key={path.label}
                    className="rounded-[22px] border border-cyan-400/18 bg-white p-5 shadow-sm shadow-zinc-950/5 dark:bg-zinc-950"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-950/60 dark:text-cyan-100/55">
                      {path.label}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{path.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[620px] justify-self-end xl:max-w-[680px]">
              <div className="overflow-hidden rounded-[28px] border border-cyan-400/18 bg-card shadow-2xl shadow-black/40 dark:bg-zinc-950">
                <div className="flex items-center gap-2 border-b border-cyan-400/18 bg-cyan-50 px-4 py-2.5 dark:bg-black">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <p className="ml-2 text-xs font-medium text-cyan-950/70 dark:text-cyan-100/70">
                    In-product verdict overlay (demo)
                  </p>
                </div>

                <div className="bg-background p-4">
                  <div className="mx-auto w-full max-w-[640px]">
                    <div className="overflow-hidden rounded-[26px] border border-cyan-400/18 bg-zinc-950 shadow-[0_0_0_1px_rgba(0,229,255,0.08),0_28px_70px_rgba(0,0,0,0.65)]">
                      <div className="flex items-center justify-between border-b border-white/5 bg-black px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-red-400" />
                          <span className="h-2 w-2 rounded-full bg-amber-400" />
                          <span className="h-2 w-2 rounded-full bg-emerald-400" />
                          <p className="ml-2 text-[11px] font-medium text-zinc-200">Email client (demo)</p>
                        </div>
                        <span className="text-[11px] text-zinc-400">Verdict overlay</span>
                      </div>

                      <div className="relative p-6">
                        <div className="rounded-2xl border border-white/5 bg-black/60 p-5">
                          <p className="text-[10px] uppercase tracking-wide text-zinc-400">
                            Microsoft Security &lt;security@microsoft-support.com&gt;
                          </p>
                          <p className="mt-1 text-lg font-semibold text-zinc-50">Password expired — verify now</p>
                          <div className="mt-4 space-y-2 text-sm text-zinc-200">
                            <p>
                              We detected unusual sign-in activity. To prevent suspension, verify your credentials
                              immediately:
                            </p>
                            <div className="rounded-xl border border-red-500/35 bg-red-950 px-3 py-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-red-200">
                                Suspicious link
                              </p>
                              <p className="mt-1 font-mono text-[12px] text-red-100 underline decoration-red-300/70 decoration-2 underline-offset-2">
                                https://secure-check-login.com/verify
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="pointer-events-none absolute bottom-6 right-6 w-[300px] rounded-2xl border border-red-500/25 bg-zinc-950 px-4 py-3 shadow-[0_0_0_1px_rgba(255,0,86,0.10),0_18px_44px_rgba(0,0,0,0.6)]">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-400" />
                            <p className="text-sm font-semibold text-zinc-50">High risk — blocked</p>
                          </div>
                          <ul className="mt-2 space-y-1 text-[11px] text-zinc-300">
                            <li className="flex gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                              <span>Impersonation domain</span>
                            </li>
                            <li className="flex gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                              <span>Urgent call to action</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <ShieldCheck className="h-4 w-4 text-cyan-300" />
                      <span>Clean, in-context verdict shown where the user reads the email.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={`${PAGE_SHELL} py-12`}>
          <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Why people start with PhishGuard</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Essential protection for personal use, with a clean path to team adoption.
            </p>
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            {CORE_BENEFITS.map((item) => (
              <Card
                key={item.title}
                className="border-cyan-400/18 bg-white shadow-sm shadow-black/20 dark:bg-zinc-950"
              >
                <CardContent className="pt-7">
                  <p className="text-xl font-semibold text-foreground">{item.title}</p>
                  <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className={`${PAGE_SHELL} pt-4`}>
          <Card className="border-cyan-400/18 bg-white shadow-xl shadow-black/25 dark:bg-zinc-950">
            <CardContent className="py-10 text-left sm:text-center">
              <h3 className="text-2xl font-semibold tracking-tight">Start personal. Scale to team protection.</h3>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:mx-auto">
                Install the extension for your own browsing, or move directly into a business plan
                when you need shared visibility and rollout support.
              </p>
              <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-center">
                <Button
                  className="shadow-[0_0_0_1px_rgba(0,229,255,0.22),0_0_40px_rgba(0,229,255,0.12)] hover:shadow-[0_0_0_1px_rgba(0,229,255,0.28),0_0_52px_rgba(0,229,255,0.16)]"
                  asChild
                >
                  <a
                    href={CHROME_STORE_URL}
                    target={CHROME_STORE_URL !== "#" ? "_blank" : undefined}
                    rel={CHROME_STORE_URL !== "#" ? "noreferrer" : undefined}
                  >
                    Install extension
                  </a>
                </Button>
                <Button
                  variant="outline"
                  className="border-cyan-400/25 bg-background text-foreground hover:bg-cyan-50 hover:text-foreground dark:text-cyan-100 dark:hover:bg-cyan-950"
                  asChild
                >
                  <Link href="/subscriptions">Compare plans</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        <p>(c) {getCurrentYear()} PhishGuard. All rights reserved.</p>
      </footer>
    </div>
  );
}
