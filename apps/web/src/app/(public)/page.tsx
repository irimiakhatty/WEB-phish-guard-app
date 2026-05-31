import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ShieldCheck, Users2, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth/auth-helpers";

const EXTENSION_ID =
  process.env.NEXT_PUBLIC_EXTENSION_ID || "bgmpigmggkapcphapehhjfmghfcdeloh";

const CHROME_STORE_URL =
  process.env.NEXT_PUBLIC_CHROME_STORE_URL ||
  `https://chromewebstore.google.com/detail/phishguard-ai-phishing-de/${EXTENSION_ID}`;

const PAGE_SHELL =
  "mx-auto w-full max-w-[1680px] px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-20";

function ProductSummaryPanel() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
          What PhishGuard does
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
          Real-time phishing detection inside the inbox.
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-300">
          PhishGuard runs in the browser while users read email. It inspects links and destinations
          as they appear, then shows a clear verdict + risk score with the signals behind it.
        </p>
      </div>

      <div className="rounded-2xl bg-white/5 p-6">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-zinc-400">
          <span>Example verdict</span>
          <span>Risk score</span>
        </div>

        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-lg font-semibold text-cyan-200">PHISHING</span>
          <span className="font-mono text-2xl font-semibold text-cyan-300">92/100</span>
        </div>

        <div className="mt-4 grid gap-2 text-sm text-zinc-300">
          <div className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300/80" />
            <span>Lookalike domain & impersonation patterns</span>
          </div>
          <div className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300/80" />
            <span>Credential-harvest intent detected</span>
          </div>
          <div className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300/80" />
            <span>Recommended action: block + report</span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-white/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Individuals
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            Instant warnings for suspicious links while reading email.
          </p>
        </div>

        <div className="rounded-2xl bg-white/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Teams</p>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            Organization rollout with shared visibility and admin follow-up.
          </p>
        </div>
      </div>
    </div>
  );
}

export default async function Home() {
  const session = await getSession();
  const currentYear = new Date().getFullYear();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="h-svh overflow-hidden bg-black text-white">
      <main className={`${PAGE_SHELL} flex h-full flex-col`}>
        <header className="flex items-center justify-between gap-4 py-6">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/icon.png"
              alt="PhishGuard logo"
              width={44}
              height={44}
              className="h-11 w-11 rounded-xl"
            />
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight">PhishGuard</p>
              <p className="text-xs text-zinc-400">Phishing protection</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="text-zinc-200 hover:bg-white/5 hover:text-white"
              asChild
            >
              <Link href="/subscriptions">Plans</Link>
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="border-white/15 bg-transparent text-white hover:bg-white/5"
              asChild
            >
              <Link href="/login">
                Sign in
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>

            <Button
              size="sm"
              className="bg-cyan-300 text-black hover:bg-cyan-200"
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
          </div>
        </header>

        <section className="grid flex-1 min-h-0 items-center gap-10 pb-10 lg:grid-cols-[1.05fr_0.95fr] lg:pb-12">
          <div className="flex min-h-0 flex-col justify-center">
            <p className="inline-flex w-fit items-center rounded-full bg-white/5 px-4 py-1.5 text-xs font-semibold text-cyan-100">
              Browser phishing protection for individuals and teams
            </p>

            <h1 className="mt-6 max-w-2xl text-4xl font-semibold leading-[0.98] tracking-tight sm:text-5xl">
              Protect every inbox
              <span className="block text-cyan-300 [text-shadow:0_0_24px_rgba(34,211,238,0.22)]">
                before the click
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-zinc-300">
              Real-time browser warnings for Gmail and Outlook, with a clear verdict, score, and
              recommended action.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <Button className="bg-white text-black hover:bg-zinc-100" asChild>
                <Link href="/login">Start now</Link>
              </Button>

              <Button
                variant="ghost"
                className="text-zinc-200 hover:bg-white/5 hover:text-white"
                asChild
              >
                <a
                  href={CHROME_STORE_URL}
                  target={CHROME_STORE_URL !== "#" ? "_blank" : undefined}
                  rel={CHROME_STORE_URL !== "#" ? "noreferrer" : undefined}
                >
                  View in Chrome Web Store
                </a>
              </Button>
            </div>

            <div className="mt-8 grid gap-2 text-sm text-zinc-300">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-cyan-200" />
                <span>Warn users while they read email, not after they click.</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-cyan-200" />
                <span>Show a verdict + risk score people understand instantly.</span>
              </div>
              <div className="flex items-center gap-2">
                <Users2 className="h-4 w-4 text-cyan-200" />
                <span>Scale from personal protection to organization oversight.</span>
              </div>
            </div>
          </div>

          <div className="hidden lg:block">
            <ProductSummaryPanel />
          </div>
        </section>

        <footer className="shrink-0 border-t border-white/10 py-4 text-center text-xs text-zinc-500">
          © {currentYear} PhishGuard. All rights reserved.
        </footer>
      </main>
    </div>
  );
}
