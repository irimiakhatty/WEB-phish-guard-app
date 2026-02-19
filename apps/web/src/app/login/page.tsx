"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import SignInForm from "../../components/sign-in-form";
import SignUpForm from "../../components/sign-up-form";
import { CheckCircle, Shield, Zap, Chrome, Mail } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import AuthRedirectGuard from "@/components/auth-redirect-guard";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode");
  const accountParam = searchParams.get("account");

  const [showSignIn, setShowSignIn] = useState(modeParam !== "signup");
  const [defaultAccountType, setDefaultAccountType] = useState<"personal" | "organization">(
    accountParam === "organization" ? "organization" : "personal",
  );

  useEffect(() => {
    if (modeParam === "signup") {
      setShowSignIn(false);
    } else if (modeParam === "signin") {
      setShowSignIn(true);
    }

    if (accountParam === "organization" || accountParam === "personal") {
      setDefaultAccountType(accountParam);
    }
  }, [modeParam, accountParam]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AuthRedirectGuard redirectTo="/dashboard" />
      <div className="fixed right-4 top-4 z-50">
        <ModeToggle />
      </div>
      <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
        <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 px-10 py-12 text-white">
          <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-indigo-300/20 blur-3xl" />

          <div className="relative z-10 space-y-8">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-blue-100">
                  PhishGuard
                </p>
                <h1 className="text-3xl font-semibold">Security Console</h1>
              </div>
            </div>

            <p className="text-lg text-blue-100 leading-relaxed">
              Monitor threats, manage organizations, and keep users safe with
              real-time phishing intelligence.
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-1 rounded-lg bg-white/15 p-2">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium">AI-powered detection</p>
                  <p className="text-sm text-blue-100">
                    Adaptive models trained on modern phishing tactics.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1 rounded-lg bg-white/15 p-2">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium">Email risk monitoring</p>
                  <p className="text-sm text-blue-100">
                    Track user exposure across Gmail and Outlook.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1 rounded-lg bg-white/15 p-2">
                  <Chrome className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium">Browser extension ready</p>
                  <p className="text-sm text-blue-100">
                    Real-time alerts where your users work.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-2 text-sm text-blue-100">
            <CheckCircle className="h-4 w-4 text-green-300" />
            Trusted by security teams
          </div>
        </div>

        <div className="flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-md">
            {showSignIn ? (
              <SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
            ) : (
              <SignUpForm
                defaultAccountType={defaultAccountType}
                onSwitchToSignIn={() => setShowSignIn(true)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
