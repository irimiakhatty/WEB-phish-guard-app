import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowRight, CheckCircle2, CircleAlert } from "lucide-react";

import { ModeToggle } from "@/components/mode-toggle";
import AuthRedirectGuard from "@/components/auth-redirect-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentYear, getSession } from "@/lib/auth/auth-helpers";

const EXTENSION_ID =
  process.env.NEXT_PUBLIC_EXTENSION_ID || "bgmpigmggkapcphapehhjfmghfcdeloh";

const CHROME_STORE_URL =
  process.env.NEXT_PUBLIC_CHROME_STORE_URL ||
  `https://chromewebstore.google.com/detail/phishguard-ai-phishing-de/${EXTENSION_ID}`;

const VERDICT_EXAMPLES = [
  {
    level: "High Risk",
    title: "Fake Microsoft reset",
    example: "verify now at secure-check-login.com",
    levelClass:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-900/25 dark:text-red-300",
    iconClass: "text-red-600 dark:text-red-300",
  },
  {
    level: "Warning",
    title: "Urgent payment request",
    example: "confirm payment in 10 minutes",
    levelClass:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-900/25 dark:text-amber-300",
    iconClass: "text-amber-600 dark:text-amber-300",
  },
  {
    level: "Safe",
    title: "Verified workspace update",
    example: "monthly report is ready",
    levelClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-900/25 dark:text-emerald-300",
    iconClass: "text-emerald-600 dark:text-emerald-300",
  },
] as const;

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
      <AuthRedirectGuard redirectTo="/dashboard" />
      <div className="fixed right-4 top-4 z-50">
        <ModeToggle />
      </div>

      <main className="pb-14">
        <section className="relative overflow-hidden border-b border-border">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(49,46,129,0.12),transparent_32%),radial-gradient(circle_at_top_right,_rgba(79,70,229,0.16),transparent_42%),linear-gradient(180deg,rgba(238,242,255,0.72),transparent_58%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(129,140,248,0.14),transparent_34%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.18),transparent_40%),linear-gradient(180deg,rgba(17,24,39,0.55),transparent_56%)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent dark:via-indigo-300/30" />

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

              <p className="inline-flex rounded-full border border-indigo-200/80 bg-white/80 px-4 py-1.5 text-xs font-semibold text-indigo-950 shadow-sm shadow-indigo-950/5 backdrop-blur dark:border-indigo-400/20 dark:bg-indigo-950/45 dark:text-indigo-100">
                Browser phishing protection for individuals and teams
              </p>

              <h1 className="max-w-4xl text-5xl font-semibold leading-[0.98] tracking-tight sm:text-6xl xl:text-[4.25rem]">
                Protect every inbox
                <span className="block bg-gradient-to-r from-indigo-950 via-indigo-700 to-sky-600 bg-clip-text text-transparent dark:from-indigo-100 dark:via-indigo-300 dark:to-sky-300">
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
                  className="bg-indigo-950 text-white shadow-lg shadow-indigo-950/15 hover:bg-indigo-900 dark:bg-indigo-400 dark:text-indigo-950 dark:hover:bg-indigo-300"
                  asChild
                >
                  <a
                    href={CHROME_STORE_URL}
                    target={CHROME_STORE_URL !== "#" ? "_blank" : undefined}
                    rel={CHROME_STORE_URL !== "#" ? "noreferrer" : undefined}
                  >
                    Add to Chrome
                  </a>
                </Button>

                <Button
                  size="lg"
                  variant="outline"
                  className="border-indigo-200/80 bg-white/70 text-indigo-950 hover:bg-indigo-50 hover:text-indigo-950 dark:border-indigo-400/20 dark:bg-indigo-950/30 dark:text-indigo-100 dark:hover:bg-indigo-900/50"
                  asChild
                >
                  <Link href="/subscriptions/business">See team plans</Link>
                </Button>

                <Button
                  size="lg"
                  variant="ghost"
                  className="group text-indigo-950 hover:bg-indigo-100/70 hover:text-indigo-950 dark:text-indigo-200 dark:hover:bg-indigo-900/40 dark:hover:text-indigo-100"
                  asChild
                >
                  <Link href="/login">
                    Start free scan
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </Link>
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {START_PATHS.map((path) => (
                  <div
                    key={path.label}
                    className="rounded-[22px] border border-indigo-200/70 bg-white/72 p-5 shadow-sm shadow-indigo-950/5 backdrop-blur dark:border-indigo-400/18 dark:bg-indigo-950/24"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-950/60 dark:text-indigo-100/55">
                      {path.label}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{path.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[620px] justify-self-end xl:max-w-[680px]">
              <div className="absolute -left-10 top-8 h-40 w-40 rounded-full bg-indigo-500/12 blur-3xl dark:bg-indigo-400/16" />
              <div className="absolute -bottom-8 right-6 h-36 w-36 rounded-full bg-sky-500/10 blur-3xl dark:bg-sky-400/12" />
              <div className="overflow-hidden rounded-[28px] border border-indigo-200/70 bg-card/90 shadow-2xl shadow-indigo-950/8 backdrop-blur dark:border-indigo-400/20 dark:bg-zinc-950/88">
                <div className="flex items-center gap-2 border-b border-indigo-200/70 bg-indigo-50/80 px-4 py-2.5 dark:border-indigo-400/20 dark:bg-indigo-950/45">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <p className="ml-2 text-xs font-medium text-indigo-950/70 dark:text-indigo-100/70">Live warning preview</p>
                </div>

                <div className="space-y-3 bg-gradient-to-b from-transparent to-indigo-50/35 p-4 dark:to-indigo-950/20">
                  {VERDICT_EXAMPLES.map((example) => (
                    <div
                      key={example.level}
                      className={`rounded-2xl border px-3 py-3 shadow-sm ${example.levelClass}`}
                    >
                      <div className="flex items-start gap-2">
                        {example.level === "High Risk" ? (
                          <AlertTriangle className={`mt-0.5 h-4 w-4 ${example.iconClass}`} />
                        ) : example.level === "Warning" ? (
                          <CircleAlert className={`mt-0.5 h-4 w-4 ${example.iconClass}`} />
                        ) : (
                          <CheckCircle2 className={`mt-0.5 h-4 w-4 ${example.iconClass}`} />
                        )}
                        <div>
                          <p className="text-sm font-semibold">{example.level}</p>
                          <p className="mt-1 text-sm font-medium opacity-95">{example.title}</p>
                          <p className="mt-1 text-xs opacity-80">{example.example}</p>
                        </div>
                      </div>
                    </div>
                  ))}
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
                className="border-indigo-200/70 bg-gradient-to-b from-white to-indigo-50/45 shadow-sm shadow-indigo-950/5 dark:border-indigo-400/18 dark:from-zinc-950 dark:to-indigo-950/22"
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
          <Card className="border-indigo-200/80 bg-gradient-to-r from-white via-indigo-50/65 to-sky-50/65 shadow-xl shadow-indigo-950/6 dark:border-indigo-400/20 dark:from-zinc-950 dark:via-indigo-950/35 dark:to-sky-950/25">
            <CardContent className="py-10 text-left sm:text-center">
              <h3 className="text-2xl font-semibold tracking-tight">Start personal. Scale to team protection.</h3>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:mx-auto">
                Install the extension for your own browsing, or move directly into a business plan
                when you need shared visibility and rollout support.
              </p>
              <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-center">
                <Button
                  className="bg-indigo-950 text-white shadow-lg shadow-indigo-950/15 hover:bg-indigo-900 dark:bg-indigo-400 dark:text-indigo-950 dark:hover:bg-indigo-300"
                  asChild
                >
                  <a
                    href={CHROME_STORE_URL}
                    target={CHROME_STORE_URL !== "#" ? "_blank" : undefined}
                    rel={CHROME_STORE_URL !== "#" ? "noreferrer" : undefined}
                  >
                    Add to Chrome
                  </a>
                </Button>
                <Button
                  variant="outline"
                  className="border-indigo-200/80 bg-white/70 text-indigo-950 hover:bg-indigo-50 hover:text-indigo-950 dark:border-indigo-400/20 dark:bg-indigo-950/30 dark:text-indigo-100 dark:hover:bg-indigo-900/50"
                  asChild
                >
                  <Link href="/subscriptions/business">See team plans</Link>
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
