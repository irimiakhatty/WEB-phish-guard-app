import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowRight, CheckCircle2, CircleAlert } from "lucide-react";

import { ModeToggle } from "@/components/mode-toggle";
import AuthRedirectGuard from "@/components/auth-redirect-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentYear, getSession } from "@/lib/auth-helpers";

const EXTENSION_ID =
  process.env.NEXT_PUBLIC_EXTENSION_ID || "bgmpigmggkapcphapehhjfmghfcdeloh";

const CHROME_STORE_URL =
  process.env.NEXT_PUBLIC_CHROME_STORE_URL ||
  `https://chromewebstore.google.com/detail/phishguard-ai-phishing-de/${EXTENSION_ID}`;

const VERDICT_EXAMPLES = [
  {
    level: "High Risk",
    title: "Credential phishing attempt",
    example: `"Your Microsoft account is suspended. Verify now at secure-check-login.com"`,
    action: "Block link and report sender.",
    levelClass:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-900/25 dark:text-red-300",
    iconClass: "text-red-600 dark:text-red-300",
  },
  {
    level: "Warning",
    title: "Suspicious urgency pattern",
    example: `"Confirm payment in 10 minutes or account access will be locked."`,
    action: "Validate sender before any action.",
    levelClass:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-900/25 dark:text-amber-300",
    iconClass: "text-amber-600 dark:text-amber-300",
  },
  {
    level: "Safe",
    title: "Trusted communication",
    example: `"Monthly security report is ready in your verified workspace."`,
    action: "No active phishing signals.",
    levelClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-900/25 dark:text-emerald-300",
    iconClass: "text-emerald-600 dark:text-emerald-300",
  },
] as const;

const WORKFLOW_ROWS = [
  {
    signal: "Live Email Scan",
    behavior: "Checks sender/domain and urgency patterns while users read mail.",
    result: "Warnings appear before users click.",
  },
  {
    signal: "URL Reputation",
    behavior: "Scores links with model + heuristics in real time.",
    result: "Malicious destinations are flagged instantly.",
  },
  {
    signal: "Team Visibility",
    behavior: "Central dashboard tracks scan outcomes by member and trend.",
    result: "Admins prioritize training and policy actions.",
  },
] as const;

const BENEFITS = [
  {
    title: "Real-time first",
    description: "Protection appears at exposure time, not only in post-incident reports.",
  },
  {
    title: "Browser-native",
    description: "No copy-paste workflow. Detection runs where users already work.",
  },
  {
    title: "Ready for teams",
    description: "Start personal, then scale to organization controls and analytics.",
  },
] as const;

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

      <main className="pb-12">
        <section className="relative border-b border-border">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(9,9,11,0.06),transparent_34%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.10),transparent_42%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.08),transparent_38%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.20),transparent_44%)]" />

          <div className="relative mx-auto grid max-w-6xl gap-8 px-6 pb-12 pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="space-y-6">
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

              <p className="inline-flex rounded-full border border-border bg-muted px-4 py-1.5 text-xs font-semibold text-muted-foreground">
                Browser extension security for Gmail, Outlook, and suspicious links
              </p>

              <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                Catch phishing
                <span className="block">before the click</span>
              </h1>

              <p className="max-w-xl text-base text-muted-foreground">
                Real-time detection inside the browser with clear red, yellow, and green verdicts
                that users can act on immediately.
              </p>

              <div className="flex flex-wrap items-center gap-2.5">
                <Button size="lg" asChild>
                  <a
                    href={CHROME_STORE_URL}
                    target={CHROME_STORE_URL !== "#" ? "_blank" : undefined}
                    rel={CHROME_STORE_URL !== "#" ? "noreferrer" : undefined}
                  >
                    Add to Chrome
                  </a>
                </Button>

                <Button size="lg" variant="outline" asChild>
                  <Link href="/subscriptions">See plans</Link>
                </Button>

                <Button size="lg" variant="ghost" className="group" asChild>
                  <Link href="/login">
                    Start free scan
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[520px]">
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="flex items-center gap-2 border-b border-border bg-muted px-4 py-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <p className="ml-2 text-xs font-medium text-muted-foreground">Live warning preview</p>
                </div>

                <div className="space-y-3 p-4">
                  {VERDICT_EXAMPLES.map((example) => (
                    <div
                      key={example.level}
                      className={`rounded-xl border px-3 py-3 ${example.levelClass}`}
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
                          <p className="mt-1 text-xs opacity-95">{example.example}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-8">
          <div className="mb-4">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">How the extension works</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Visual flow built for real-time detection, not post-event analysis.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border">
            <div className="grid grid-cols-[1fr_1.35fr_1.15fr] border-b border-border bg-muted px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <p>Signal</p>
              <p>What it checks</p>
              <p>Output to user/admin</p>
            </div>
            {WORKFLOW_ROWS.map((row) => (
              <div
                key={row.signal}
                className="grid grid-cols-1 gap-2 border-b border-border px-4 py-4 last:border-b-0 md:grid-cols-[1fr_1.35fr_1.15fr]"
              >
                <p className="font-semibold">{row.signal}</p>
                <p className="text-sm text-muted-foreground">{row.behavior}</p>
                <p className="text-sm">{row.result}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-5">
          <div className="grid gap-4 md:grid-cols-3">
            {BENEFITS.map((benefit) => (
              <Card key={benefit.title} className="border-border bg-card">
                <CardContent className="pt-6">
                  <p className="text-lg font-semibold">{benefit.title}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pt-8">
          <Card className="border-border bg-card">
            <CardContent className="py-8 text-left sm:text-center">
              <h3 className="text-2xl font-semibold tracking-tight">Start with live protection today</h3>
              <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:mx-auto">
                Install fast. Detect instantly. Upgrade when your team scales.
              </p>
              <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-center">
                <Button asChild>
                  <a
                    href={CHROME_STORE_URL}
                    target={CHROME_STORE_URL !== "#" ? "_blank" : undefined}
                    rel={CHROME_STORE_URL !== "#" ? "noreferrer" : undefined}
                  >
                    Install extension
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/subscriptions">See all plans</Link>
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
