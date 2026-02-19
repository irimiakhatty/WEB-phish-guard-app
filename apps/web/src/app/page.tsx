import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CircleAlert, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ModeToggle } from "@/components/mode-toggle";
import { getCurrentYear, getSession } from "@/lib/auth-helpers";

const EXTENSION_ID =
  process.env.NEXT_PUBLIC_EXTENSION_ID || "bgmpigmggkapcphapehhjfmghfcdeloh";

const CHROME_STORE_URL =
  process.env.NEXT_PUBLIC_CHROME_STORE_URL ||
  `https://chromewebstore.google.com/detail/phishguard-ai-phishing-de/${EXTENSION_ID}`;

const VERDICT_EXAMPLES = [
  {
    level: "High Risk",
    levelClass:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-900/25 dark:text-red-300",
    iconClass: "text-red-600 dark:text-red-300",
    title: "Credential phishing attempt",
    example: `"Your Microsoft account is suspended. Verify now at secure-check-login.com"`,
    action: "Block link and report sender immediately.",
  },
  {
    level: "Warning",
    levelClass:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-900/25 dark:text-amber-300",
    iconClass: "text-amber-600 dark:text-amber-300",
    title: "Suspicious urgency pattern",
    example: `"Confirm payment in the next 10 minutes or your access will be locked"`,
    action: "Verify sender identity before any action.",
  },
  {
    level: "Safe",
    levelClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-900/25 dark:text-emerald-300",
    iconClass: "text-emerald-600 dark:text-emerald-300",
    title: "Trusted communication",
    example: `"Monthly security report is ready in your verified workspace."`,
    action: "No risk signals detected.",
  },
] as const;

const EXTENSION_WORKFLOW = [
  {
    step: "01",
    title: "Install",
    text: "Add PhishGuard from Chrome Web Store and pin it.",
  },
  {
    step: "02",
    title: "Detect",
    text: "Live checks run in Gmail, Outlook, and web pages.",
  },
  {
    step: "03",
    title: "Act",
    text: "Users receive instant verdicts and clear next actions.",
  },
] as const;

const BENEFITS = [
  {
    title: "Real-time first",
    description: "Protection activates at exposure time, not after incident review.",
    card: "from-cyan-50/90 to-blue-50/80 dark:from-cyan-900/20 dark:to-blue-900/20",
  },
  {
    title: "Built into workflow",
    description: "No copy-paste flow. Users stay in browser, fully protected.",
    card: "from-blue-50/90 to-indigo-50/80 dark:from-blue-900/20 dark:to-indigo-900/20",
  },
  {
    title: "Scales with your team",
    description: "Start personal, then move to organization visibility and controls.",
    card: "from-indigo-50/90 to-violet-50/80 dark:from-indigo-900/20 dark:to-violet-900/20",
  },
] as const;

export default async function Home() {
  const session = await getSession();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-blue-100 to-slate-200 text-slate-900 dark:from-[#061233] dark:via-[#071943] dark:to-[#05122d] dark:text-slate-100">
      <div className="fixed right-4 top-4 z-50">
        <ModeToggle />
      </div>

      <main className="pb-12">
        <section className="relative border-b border-slate-200/80 dark:border-slate-800/80">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.20),transparent_36%),radial-gradient(circle_at_top_right,_rgba(30,64,175,0.18),transparent_38%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.14),transparent_40%),radial-gradient(circle_at_top_right,_rgba(37,99,235,0.16),transparent_42%)]" />

          <div className="relative mx-auto grid max-w-6xl gap-8 px-6 pb-10 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center sm:pt-12">
            <div className="space-y-6 text-left">
              <div className="flex items-center gap-3">
                <Image
                  src="/icon.png"
                  alt="PhishGuard logo"
                  width={52}
                  height={52}
                  className="h-12 w-12 rounded-xl shadow-[0_10px_24px_rgba(37,99,235,0.35)]"
                />
                <p className="text-[2rem] font-semibold leading-none tracking-tight text-slate-900 dark:text-blue-100 sm:text-[2.35rem]">
                  PhishGuard
                </p>
              </div>

              <p className="inline-flex rounded-full border border-blue-300/80 bg-blue-100/85 px-4 py-1.5 text-[11px] font-semibold text-blue-900 dark:border-blue-500/40 dark:bg-blue-900/30 dark:text-blue-100">
                Real-time phishing detection in browser
              </p>

              <h1 className="text-3xl font-semibold leading-tight sm:text-4xl md:text-5xl">
                Live protection that
                <span className="bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 bg-clip-text text-transparent dark:from-blue-300 dark:via-blue-300 dark:to-indigo-300">
                  {" "}
                  reacts before the click
                </span>
              </h1>

              <p className="max-w-xl text-sm text-slate-600 dark:text-slate-300 sm:text-base">
                PhishGuard monitors suspicious email and web signals in real time and surfaces clear
                verdicts exactly where users work.
              </p>

              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  size="lg"
                  className="h-11 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 px-6 text-white shadow-[0_10px_24px_rgba(37,99,235,0.35)] hover:from-blue-700 hover:via-blue-800 hover:to-indigo-800"
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
                  className="h-11 border-blue-300 px-6 text-blue-700 hover:bg-blue-100 dark:border-blue-500/60 dark:text-blue-200 dark:hover:bg-blue-900/35"
                  asChild
                >
                  <Link href="/subscriptions">See plans</Link>
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  className="h-11 px-5 text-blue-700 hover:bg-blue-100 dark:text-blue-200 dark:hover:bg-blue-900/35"
                  asChild
                >
                  <Link href="/login">Start free scan</Link>
                </Button>
              </div>
            </div>

            <div className="relative flex justify-center lg:justify-center">
              <div className="w-full max-w-[520px] overflow-hidden rounded-3xl border border-blue-200/80 bg-white/92 shadow-[0_22px_55px_rgba(30,64,175,0.24)] dark:border-blue-700/50 dark:bg-[#0a1a46]/82">
                <div className="flex items-center gap-2 border-b border-blue-200/80 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-2.5 dark:border-blue-700/40 dark:from-blue-900/20 dark:to-indigo-900/20">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <p className="ml-2 text-xs font-medium text-slate-500 dark:text-slate-300">
                    mail.google.com
                  </p>
                </div>

                <div className="space-y-3 p-4">
                  <div className="rounded-xl border border-slate-200/90 bg-slate-50/90 p-3 dark:border-slate-700/60 dark:bg-slate-900/40">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-300">
                      Suspicious message
                    </p>
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                      "Your account is suspended. Verify now at secure-check-login.com"
                    </p>
                  </div>

                  <div className="rounded-xl border border-red-200/80 bg-red-50/85 p-3 dark:border-red-500/40 dark:bg-red-900/20">
                    <div className="flex items-center gap-3">
                      <Image
                        src="/icon.png"
                        alt="PhishGuard detection badge"
                        width={28}
                        height={28}
                        className="h-7 w-7 rounded-md"
                      />
                      <div>
                        <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                          High Risk detected
                        </p>
                        <p className="text-xs text-red-700/80 dark:text-red-200/90">
                          Likely credential harvesting. Do not open the link.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white">
                      Block link
                    </span>
                    <span className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:border-blue-600/50 dark:bg-blue-900/30 dark:text-blue-200">
                      Mark as phishing
                    </span>
                    <span className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                      View reason
                    </span>
                  </div>
                </div>
              </div>

              <div className="absolute -right-2 -top-2 rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700 shadow-sm dark:border-blue-500/40 dark:bg-blue-900/30 dark:text-blue-200">
                Live scan active
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-7">
          <div className="mb-4">
            <h2 className="text-2xl font-semibold sm:text-3xl">Real examples: red, yellow, green</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              How verdicts look in day-to-day usage.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {VERDICT_EXAMPLES.map((example) => (
              <Card
                key={example.level}
                className="overflow-hidden border-blue-200/80 bg-white/90 dark:border-blue-700/50 dark:bg-[#0a1a46]/75"
              >
                <CardContent className="space-y-3 p-4">
                  <div className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${example.levelClass}`}>
                    {example.level === "High Risk" ? (
                      <AlertTriangle className={`h-4 w-4 ${example.iconClass}`} />
                    ) : example.level === "Warning" ? (
                      <CircleAlert className={`h-4 w-4 ${example.iconClass}`} />
                    ) : (
                      <CheckCircle2 className={`h-4 w-4 ${example.iconClass}`} />
                    )}
                    <p className="text-sm font-semibold">{example.level}</p>
                  </div>
                  <p className="text-base font-semibold">{example.title}</p>
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-700 dark:border-slate-700/60 dark:bg-slate-900/40 dark:text-slate-200">
                    {example.example}
                  </p>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {example.action}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-4">
          <Card className="border-indigo-200/80 bg-white/90 dark:border-indigo-700/50 dark:bg-[#0a1a46]/75">
            <CardContent className="p-0">
              <div className="border-b border-indigo-200/80 bg-gradient-to-r from-indigo-50/90 to-blue-50/90 px-5 py-4 dark:border-indigo-700/50 dark:from-indigo-900/20 dark:to-blue-900/20">
                <h2 className="text-2xl font-semibold">Extension workflow</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Three steps from installation to live protection.
                </p>
              </div>

              <div className="grid gap-3 px-4 py-4 md:grid-cols-3">
                {EXTENSION_WORKFLOW.map((item) => (
                  <div
                    key={item.step}
                    className="rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/80 to-blue-50/60 p-4 dark:border-indigo-700/40 dark:from-indigo-900/20 dark:to-blue-900/20"
                  >
                    <p className="text-xs font-semibold tracking-[0.12em] text-indigo-700 dark:text-indigo-300">
                      {item.step}
                    </p>
                    <p className="mt-1 text-lg font-semibold">{item.title}</p>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.text}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-5">
          <div className="grid gap-4 md:grid-cols-3">
            {BENEFITS.map((benefit) => (
              <Card
                key={benefit.title}
                className={`border-blue-200/80 bg-gradient-to-br ${benefit.card} dark:border-blue-700/50`}
              >
                <CardContent className="pt-6">
                  <p className="text-lg font-semibold text-slate-900 dark:text-blue-100">
                    {benefit.title}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {benefit.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pt-10">
          <Card className="border-blue-200/80 bg-gradient-to-r from-blue-50/95 via-indigo-50/90 to-blue-100/90 dark:border-blue-700/50 dark:from-blue-900/22 dark:via-indigo-900/18 dark:to-blue-900/22">
            <CardContent className="py-8 text-left sm:text-center">
              <h3 className="text-2xl font-semibold">Start with live protection today</h3>
              <p className="mt-3 max-w-xl text-sm text-slate-600 dark:text-slate-300 sm:mx-auto">
                Install fast. Detect in real time. Scale when ready.
              </p>
              <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-center">
                <Button
                  className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white hover:from-blue-700 hover:via-blue-800 hover:to-indigo-800"
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
                <Button variant="outline" asChild>
                  <Link href="/subscriptions">See all plans</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
        <p>(c) {getCurrentYear()} PhishGuard. All rights reserved.</p>
      </footer>
    </div>
  );
}
