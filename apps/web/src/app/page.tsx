import Link from "next/link";
import { redirect } from "next/navigation";
import { Shield, Zap, Lock, Brain, TrendingUp, ArrowRight, Chrome, Mail, CheckCircle, Users, Building, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSession, getCurrentYear } from "@/lib/auth-helpers";

const EXTENSION_ID =
  process.env.NEXT_PUBLIC_EXTENSION_ID || "bgmpigmggkapcphapehhjfmghfcdeloh";

const CHROME_STORE_URL =
  process.env.NEXT_PUBLIC_CHROME_STORE_URL ||
  `https://chromewebstore.google.com/detail/phishguard-ai-phishing-de/${EXTENSION_ID}`;

export default async function Home() {
  const session = await getSession();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/20 to-purple-50/20 dark:from-gray-950 dark:via-blue-950/20 dark:to-purple-950/20">
      <section className="min-h-screen relative overflow-hidden flex items-center justify-center px-6 py-20">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 -left-48 w-96 h-96 bg-blue-500/20 dark:bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 -right-48 w-96 h-96 bg-purple-500/20 dark:bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "2s" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-blue-400/5 via-purple-400/5 to-blue-400/5 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto w-full relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-10 text-center lg:text-left">
              <div className="flex items-center gap-3 justify-center lg:justify-start">
                <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-2.5 rounded-xl shadow-xl shadow-blue-500/30">
                  <Shield className="w-8 h-8 text-white" />
                </div>
                <span className="text-3xl text-gray-900 dark:text-white">PhishGuard</span>
              </div>

              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 dark:from-blue-500/20 dark:to-purple-500/20 px-6 py-3 rounded-full border border-blue-200 dark:border-blue-800">
                <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span className="text-blue-700 dark:text-blue-300">Protect Gmail and Outlook in real time</span>
              </div>

              <div className="space-y-6">
                <h1 className="text-5xl lg:text-7xl text-gray-900 dark:text-white leading-[1.1] font-semibold">
                  Secure your inbox with AI precision
                </h1>
                <p className="text-xl text-gray-600 dark:text-gray-400 leading-relaxed max-w-xl mx-auto lg:mx-0">
                  Stop phishing before you click. PhishGuard scans every email in your browser and only warns when risk is real.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-2xl shadow-blue-500/40 text-lg px-8 py-7 group"
                  asChild
                >
                  <Link href={CHROME_STORE_URL} target={CHROME_STORE_URL !== "#" ? "_blank" : undefined}>
                    <Chrome className="mr-2 h-5 w-5" />
                    Add to Chrome
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-full" asChild>
                  <Link href="/login">Web Dashboard</Link>
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-6 justify-center lg:justify-start pt-4">
                {["Works with Gmail", "Works with Outlook", "Privacy first"].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <span className="text-gray-600 dark:text-gray-400">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative flex items-center justify-center min-h-[560px]">
              <div className="relative z-20 w-full max-w-[480px] mx-auto">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-[360px] h-[360px] bg-gradient-to-r from-blue-500/30 via-purple-500/30 to-blue-500/30 rounded-full blur-3xl animate-pulse" />
                </div>

                <div className="relative aspect-square transform transition-all duration-700 hover:scale-105 hover:rotate-2">
                  <div className="relative w-full h-full flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-full h-full max-w-[320px] max-h-[320px] drop-shadow-2xl">
                      <defs>
                        <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#3b82f6" />
                          <stop offset="50%" stopColor="#8b5cf6" />
                          <stop offset="100%" stopColor="#3b82f6" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M12 2L4 5v6.09c0 5.29 3.66 10.25 8 11.41 4.34-1.16 8-6.12 8-11.41V5l-8-3z"
                        fill="url(#shieldGradient)"
                        stroke="none"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-white dark:bg-gray-900 rounded-full p-6 shadow-2xl">
                        <CheckCircle className="w-16 h-16 text-blue-600 dark:text-blue-400" strokeWidth={2.5} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="absolute -top-6 -left-12 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl p-4 rounded-2xl border-2 border-green-200 dark:border-green-800 shadow-2xl">
                  <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-green-500 to-green-600 p-3 rounded-xl shadow-lg">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-xl text-gray-900 dark:text-white">99.8%</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">Detection accuracy</div>
                    </div>
                  </div>
                </div>

                <div className="absolute -bottom-6 -right-10 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl p-4 rounded-2xl border-2 border-blue-200 dark:border-blue-800 shadow-2xl">
                  <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-xl shadow-lg">
                      <Zap className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-xl text-gray-900 dark:text-white">50K+</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">Threats blocked</div>
                    </div>
                  </div>
                </div>

                <div className="absolute top-1/2 -translate-y-1/2 -right-16 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl p-4 rounded-2xl border-2 border-purple-200 dark:border-purple-800 shadow-2xl">
                  <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-3 rounded-xl shadow-lg">
                      <Shield className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-xl text-gray-900 dark:text-white">{"<"}1s</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">Scan latency</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-6 bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm border-y border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-10 text-center">
          {[
            { label: "Threats blocked", value: "50K+" },
            { label: "Detection accuracy", value: "99.8%" },
            { label: "Response time", value: "<1s" },
            { label: "Active users", value: "10K+" },
          ].map((stat) => (
            <div key={stat.label} className="space-y-2">
              <div className="text-4xl md:text-5xl font-semibold bg-gradient-to-br from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {stat.value}
              </div>
              <div className="text-gray-600 dark:text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-24 px-6 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-950/50 px-6 py-3 rounded-full">
              <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span className="text-blue-700 dark:text-blue-300">How it works</span>
            </div>
            <h2 className="text-4xl lg:text-5xl text-gray-900 dark:text-white">
              Protect every email in seconds
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Zap, title: "Instant analysis", desc: "Real-time AI scoring of email text and URLs." },
              { icon: Brain, title: "Edge + AI", desc: "Local TensorFlow.js plus optional deep scan." },
              { icon: Lock, title: "Silent when safe", desc: "Warnings only when risk is critical." },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.title} className="group relative overflow-hidden border-2 border-transparent hover:border-blue-400 dark:hover:border-blue-600 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/20 bg-white dark:bg-gray-900">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <CardContent className="pt-10 pb-8 space-y-5 relative">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-5 rounded-2xl w-fit shadow-xl shadow-blue-500/40">
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-2xl text-gray-900 dark:text-white">{item.title}</h3>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{item.desc}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-24 px-6 bg-white dark:bg-gray-950">
        <div className="max-w-6xl mx-auto text-center space-y-4 mb-14">
          <h2 className="text-4xl lg:text-5xl text-gray-900 dark:text-white">Built for teams and individuals</h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            PhishGuard serves security leaders and everyday users with the same silent protection philosophy.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          <Card className="group hover:shadow-2xl transition-all duration-500 border-2 border-purple-200 dark:border-purple-800 hover:border-purple-400 dark:hover:border-purple-600 bg-gradient-to-br from-white to-purple-50/30 dark:from-gray-900 dark:to-purple-950/30">
            <CardContent className="pt-12 pb-10 space-y-6">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-4 rounded-2xl shadow-xl shadow-purple-500/40">
                  <Building className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl text-gray-900 dark:text-white">Organizations (B2B)</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Security intelligence for admins</p>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                Give admins clear reports on who is most targeted, what attack types dominate, and which employees are vulnerable so you can prove ROI and focus training.
              </p>
              <ul className="space-y-3">
                {[
                  "Most-targeted employees overview",
                  "Attack-type heatmap to spot trends fast",
                  "Risky users list with clear prioritization",
                  "ROI-ready reporting to justify investment",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <div className="mt-1 p-1 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <span className="text-gray-700 dark:text-gray-300">{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-2xl transition-all duration-500 border-2 border-green-200 dark:border-green-800 hover:border-green-400 dark:hover:border-green-600 bg-gradient-to-br from-white to-green-50/30 dark:from-gray-900 dark:to-green-950/30">
            <CardContent className="pt-12 pb-10 space-y-6">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-green-500 to-green-600 p-4 rounded-2xl shadow-xl shadow-green-500/40">
                  <Users className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl text-gray-900 dark:text-white">Individuals (B2C)</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Silence is golden</p>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                For everyday users, PhishGuard stays quiet and steps in only when risk is imminent. Simple, fast protection against credential harvesting.
              </p>
              <ul className="space-y-3">
                {[
                  "Instant detection of credential-harvesting attacks",
                  "Minimal, high-signal warnings only when necessary",
                  "One-click actions to stay safe and move on",
                  "No noise, no friction, just protection",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <div className="mt-1 p-1 rounded-full bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <span className="text-gray-700 dark:text-gray-300">{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <Card className="bg-gradient-to-br from-blue-600 to-blue-700 border-0 shadow-2xl">
            <CardContent className="pt-12 pb-12 text-center text-white space-y-6">
              <div className="bg-white/20 p-5 rounded-full w-fit mx-auto">
                <Shield className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-3xl font-semibold">Ready to stay safe online?</h2>
              <p className="text-blue-100 text-lg">
                Join thousands of users protecting themselves from phishing attacks every day.
              </p>
              <Button
                size="lg"
                variant="secondary"
                className="text-base px-8 py-6 bg-white text-blue-600 hover:bg-blue-50"
                asChild
              >
                <Link href="/login">
                  Get started free
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <footer className="container mx-auto px-4 py-6 text-center text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-800">
        <p className="text-sm">© {getCurrentYear()} PhishGuard. All rights reserved.</p>
      </footer>
    </div>
  );
}
