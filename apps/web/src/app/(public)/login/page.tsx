"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import AuthRedirectGuard from "@/components/auth-redirect-guard";
import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode");
  const accountParam = searchParams.get("account");
  const nextParam = searchParams.get("next") || searchParams.get("redirect");

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
    <div className="relative min-h-svh bg-black text-white">
      <AuthRedirectGuard redirectTo={nextParam?.startsWith("/") ? nextParam : "/dashboard"} />

      <div className="relative flex min-h-svh items-start justify-center px-6 py-8 sm:items-center">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-4 flex items-center justify-center gap-3">
            <Image
              src="/icon.png"
              alt="PhishGuard logo"
              width={44}
              height={44}
              className="h-11 w-11 rounded-xl"
            />
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight">PhishGuard</p>
              <p className="text-xs text-zinc-400">Sign in / Sign up</p>
            </div>
          </Link>

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
  );
}
