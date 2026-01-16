import Link from "next/link";
import { auth } from "@phish-guard-app/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Shield, Zap, Lock, TrendingUp, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // If user is logged in, redirect to dashboard
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-20 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-blue-600 mb-8">
          <Shield className="w-8 h-8 text-white" />
        </div>
        
        <h1 className="text-5xl md:text-6xl font-bold mb-6 text-gray-900 dark:text-white">
          PhishGuard
        </h1>
        
        <p className="text-xl md:text-2xl text-gray-900 dark:text-white mb-4 max-w-3xl mx-auto font-medium">
          Protect yourself from phishing attacks with AI-powered URL analysis
        </p>
        
        <p className="text-base md:text-lg text-gray-600 dark:text-gray-400 mb-10 max-w-2xl mx-auto">
          Detect malicious websites before they steal your data. Real-time threat detection powered by advanced machine learning.
        </p>

        <div className="flex gap-4 justify-center">
          <Link href="/login">
            <Button size="lg" className="text-base px-8 py-6 bg-blue-600 hover:bg-blue-700 transition-colors">
              Get Started
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-20 bg-gray-50 dark:bg-gray-900">
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
        <p className="text-sm">© 2026 PhishGuard. All rights reserved.</p>
      </div>
    </div>
  );
}
