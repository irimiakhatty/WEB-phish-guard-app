import Link from "next/link";
import { redirect } from "next/navigation";
import { Shield, Zap, Lock, TrendingUp, ArrowRight, Chrome, Mail, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSession, getCurrentYear } from "@/lib/auth-helpers";

// TODO: Replace this with the actual Chrome Web Store URL once published
const CHROME_STORE_URL = process.env.NEXT_PUBLIC_CHROME_STORE_URL || "#";

export default async function Home() {
  const session = await getSession();

  // If user is logged in, redirect to dashboard
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-20 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 mb-8 shadow-xl shadow-blue-900/20">
          <Shield className="w-10 h-10 text-white" />
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight text-gray-900 dark:text-white">
          Secure your inbox <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">with AI Precision</span>
        </h1>
        
        <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto font-medium leading-relaxed">
          Stop phishing attacks inside Gmail & Outlook before you click. 
          Real-time AI analysis that lives in your browser.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
          <Button size="lg" className="h-14 px-8 text-lg rounded-full bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5" asChild>
             <Link href={CHROME_STORE_URL} target={CHROME_STORE_URL !== "#" ? "_blank" : undefined}>
                <Chrome className="mr-2 h-6 w-6" />
                Add to Chrome
                <span className="ml-2 text-xs opacity-70 font-normal border-l border-current pl-2">It's Free</span>
             </Link>
          </Button>
          <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-full border-2 hover:bg-gray-50 dark:hover:bg-gray-900" asChild>
            <Link href="/login">
              Web Dashboard
            </Link>
          </Button>
        </div>

        <div className="flex justify-center gap-8 text-sm font-medium text-gray-500 dark:text-gray-400">
             <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Works with Gmail</span>
             </div>
             <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Works with Outlook</span>
             </div>
             <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Privacy First</span>
             </div>
        </div>
      </div>

      {/* Extension Showcase Section */}
      <div className="bg-gray-50 dark:bg-gray-900 py-20 border-y border-gray-100 dark:border-gray-800">
         <div className="container mx-auto px-4">
             <div className="grid md:grid-cols-2 gap-12 items-center">
                 <div className="space-y-6">
                     <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-semibold">
                        <Chrome className="w-4 h-4" /> Browser Extension
                     </div>
                     <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
                        Protection where it matters most.
                     </h2>
                     <p className="text-lg text-gray-600 dark:text-gray-400">
                        Hackers don't attack your firewall; they attack you. PhishGuard sits quietly in your browser and scans every email you open for subtle signs of manipulation, urgency, and fraud.
                     </p>
                     
                     <ul className="space-y-4 pt-4">
                        {[
                            "Deep Learning analysis of email text content",
                            "Real-time URL reputation scanning",
                            "Visual warning banners inside Gmail/Outlook",
                            "One-click reporting to security teams"
                        ].map((item, i) => (
                            <li key={i} className="flex items-start gap-3">
                                <div className="mt-1 p-0.5 rounded-full bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400">
                                    <CheckCircle className="w-4 h-4" />
                                </div>
                                <span className="text-gray-700 dark:text-gray-300">{item}</span>
                            </li>
                        ))}
                     </ul>
                 </div>
                 
                 {/* Visual Mockup Placeholder */}
                 <div className="relative group">
                     <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                     <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700 aspect-video flex flex-col">
                        <div className="bg-gray-100 dark:bg-gray-900 px-4 py-3 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700">
                            <div className="flex gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                                <div className="w-3 h-3 rounded-full bg-green-400"></div>
                            </div>
                            <div className="ml-4 flex-1 bg-white dark:bg-gray-800 rounded px-2 py-1 text-xs text-gray-400 font-mono text-center">
                                mail.google.com
                            </div>
                        </div>
                        <div className="p-6 flex-1 bg-gray-50 dark:bg-gray-900/50 flex flex-col justify-center items-center text-center">
                            <Mail className="w-16 h-16 text-gray-300 mb-4" />
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl max-w-sm w-full mx-auto relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                                <div className="flex items-center gap-3 mb-2">
                                     <Shield className="w-5 h-5 text-red-600" />
                                     <span className="font-bold text-red-700 dark:text-red-400">Phishing Detected</span>
                                </div>
                                <p className="text-xs text-red-600/80 dark:text-red-400/80 text-left">
                                    Analyzed by PhishGuard: High probability of social engineering.
                                </p>
                            </div>
                        </div>
                     </div>
                 </div>
             </div>
         </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-20">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-gray-900 dark:text-white">Why Choose PhishGuard?</h2>
        
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="pt-8 pb-8 space-y-4">
              <div className="bg-blue-600 p-4 rounded-lg w-fit">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Instant Analysis</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Get real-time threat assessment for any URL in seconds. Our AI analyzes hundreds of indicators instantly.
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="pt-8 pb-8 space-y-4">
              <div className="bg-green-600 p-4 rounded-lg w-fit">
                <Lock className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Advanced Security</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Multiple layers of protection including SSL validation, domain reputation, and behavioral analysis.
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="pt-8 pb-8 space-y-4">
              <div className="bg-purple-600 p-4 rounded-lg w-fit">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Track & Monitor</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Keep a complete history of all scanned URLs with detailed reports and threat trends over time.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-4 py-20 text-center">
        <Card className="max-w-3xl mx-auto bg-blue-600 border-0 shadow-lg">
          <CardContent className="pt-12 pb-12">
            <div className="bg-white/20 p-5 rounded-full w-fit mx-auto mb-6">
              <Shield className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to stay safe online?
            </h2>
            <p className="text-blue-50 text-lg mb-8">
              Join thousands of users protecting themselves from phishing attacks every day.
            </p>
            <Link href="/login">
              <Button 
                size="lg" 
                variant="secondary" 
                className="text-base px-8 py-6 bg-white text-blue-600 hover:bg-blue-50"
              >
                Get Started Free
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <div className="container mx-auto px-4 py-6 text-center text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-800">
        <p className="text-sm">© {getCurrentYear()} PhishGuard. All rights reserved.</p>
      </div>
    </div>
  );
}
