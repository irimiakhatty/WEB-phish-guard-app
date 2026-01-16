"use client";

import { useState } from "react";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import { ModeToggle } from "@/components/mode-toggle";
import Link from "next/link";
import { Shield } from "lucide-react";

export default function LoginPage() {
  const [showSignIn, setShowSignIn] = useState(true);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Simple header for login page */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
        <Link href="/" className="flex items-center gap-3 text-lg font-bold">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="text-gray-900 dark:text-white">PhishGuard</span>
        </Link>
        <ModeToggle />
      </div>

      {showSignIn ? (
        <SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
      ) : (
        <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
      )}
    </div>
  );
}
