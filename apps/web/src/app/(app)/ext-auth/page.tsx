"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Check, ShieldCheck } from "lucide-react";
import { getExtensionAuthData } from "@/server/actions/extension-auth";
import type { ExtensionAccountContext } from "@/lib/integrations/extension-context";

const EXTENSION_ID =
  process.env.NEXT_PUBLIC_EXTENSION_ID || "bgmpigmggkapcphapehhjfmghfcdeloh";

type ExtensionRuntime = {
  sendMessage: (
    extensionId: string,
    message: unknown,
    callback?: (response: unknown) => void
  ) => void;
  lastError?: { message?: string };
};

type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

function formatConnectedPlanLabel(planName: string, planStatus?: string | null) {
  if (planStatus === "trialing") {
    return /trial$/i.test(planName) ? planName : `${planName} trial`;
  }

  if (planStatus === "trial_expired") {
    return /trial$/i.test(planName) ? `${planName} ended` : `${planName} trial ended`;
  }

  return planName;
}

export default function ExtAuthPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "connecting" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [accountContext, setAccountContext] = useState<ExtensionAccountContext | null>(null);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const didInit = useRef(false);

  useEffect(() => {
    if (!didInit.current) {
      didInit.current = true;
      void checkAuthAndConnect();
    }
  }, []);

  async function checkAuthAndConnect() {
    try {
      const response = await fetch("/api/auth/get-session", {
        credentials: "include",
      });

      if (!response.ok) {
        router.push("/login?redirect=/ext-auth");
        return;
      }

      const data = await response.json();
      if (!data?.user) {
        router.push("/login?redirect=/ext-auth");
        return;
      }

      setUser(data.user as SessionUser);
      setStatus("connecting");
      await findOrCreateToken();
    } catch (authError) {
      console.error("Auth flow failed:", authError);
      setStatus("error");
      setError("Failed to verify authentication.");
    }
  }

  async function findOrCreateToken() {
    try {
      const listRes = await fetch("/api/v1/auth/token");
      const listData = await listRes.json();

      let targetToken: string | null = null;
      if (listData.success && Array.isArray(listData.data)) {
        const existing = listData.data.find((token: { name?: string; token?: string }) => {
          return token.name === "Chrome Extension" && typeof token.token === "string";
        });
        if (existing?.token) {
          targetToken = existing.token;
        }
      }

      if (!targetToken) {
        const createRes = await fetch("/api/v1/auth/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Chrome Extension",
            expiresInDays: 365,
          }),
        });
        const createData = await createRes.json();

        if (!createData.success || typeof createData?.data?.token !== "string") {
          throw new Error(createData.error || "Failed to generate token");
        }

        targetToken = createData.data.token;
      }

      if (!targetToken) {
        throw new Error("Could not retrieve a valid token.");
      }

      const context = await getExtensionAuthData();
      setAccountContext(context);
      setGeneratedToken(targetToken);
      await sendTokenToExtension(targetToken, context);
      setStatus("success");
    } catch (connectError) {
      console.error("Connection failed:", connectError);
      setStatus("error");
      setError(connectError instanceof Error ? connectError.message : "Failed to connect to extension.");
    }
  }

  async function sendTokenToExtension(token: string, context: ExtensionAccountContext) {
    const message = {
      action: "AUTH_HANDOFF",
      token,
      context,
      user: context.user,
      account: context.account,
      subscription: context.subscription,
      activity: context.activity,
      recentScans: context.recentScans,
      keys: context.keys,
      deepScanPublicKey: context.keys.deepScanPublicKey,
      analyzePayloadPublicKey: context.keys.analyzePayloadPublicKey,
    };

    const chromeApi = (
      globalThis as typeof globalThis & { chrome?: { runtime?: ExtensionRuntime } }
    ).chrome;

    if (chromeApi?.runtime) {
      chromeApi.runtime.sendMessage(EXTENSION_ID, message, (_response: unknown) => {
        if (chromeApi.runtime?.lastError) {
          console.log("Extension not reachable via standard ID, falling back to page messaging.");
        }
      });
    }

    const postedMessage = { type: "PHISHGUARD_AUTH_SUCCESS", ...message };
    window.postMessage(postedMessage, "*");

    let attempts = 0;
    const interval = setInterval(() => {
      attempts += 1;
      window.postMessage(postedMessage, "*");
      if (attempts >= 5) {
        clearInterval(interval);
      }
    }, 500);
  }

  function handleRetry() {
    setStatus("connecting");
    setError(null);
    void findOrCreateToken();
  }

  const connectedName = accountContext?.user.name || user?.name || user?.email || "your account";
  const connectedPlan = formatConnectedPlanLabel(
    accountContext?.subscription.planName || "Free",
    accountContext?.subscription.status
  );
  const connectedWorkspace = accountContext?.account.organizationName || "Personal workspace";

  if (status === "loading" || status === "connecting") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-0 shadow-lg">
          <CardContent className="flex flex-col items-center pb-12 pt-12 text-center">
            <div className="relative mb-6">
              <div className="absolute inset-0 animate-ping rounded-full bg-zinc-200/70 dark:bg-zinc-700/40"></div>
              <div className="relative rounded-full border-2 border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-slate-900">
                <Loader2 className="h-10 w-10 animate-spin text-zinc-700 dark:text-zinc-200" />
              </div>
            </div>
            <h2 className="mb-2 text-xl font-semibold">Connecting PhishGuard...</h2>
            <p className="text-muted-foreground">
              {status === "loading" ? "Verifying your account" : "Syncing your account, subscription, and scan history"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-0 border-t-4 border-t-red-500 shadow-lg">
          <CardHeader>
            <CardTitle className="text-red-600">Connection Failed</CardTitle>
            <CardDescription>We couldn&apos;t connect to the extension.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button onClick={handleRetry} className="w-full">
              Try Again
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => router.push("/dashboard")}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-0 border-t-4 border-t-green-500 shadow-lg">
        <CardContent className="flex flex-col items-center pb-8 pt-12 text-center">
          <div className="mb-6 rounded-full bg-green-100 p-4 dark:bg-green-900/30">
            <ShieldCheck className="h-12 w-12 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="mb-2 text-2xl font-bold">Extension connected</h2>
          <p className="mb-4 text-muted-foreground">
            PhishGuard is now linked to {connectedName}. You can close this tab and keep browsing.
          </p>
          <div className="mb-8 w-full rounded-xl border border-emerald-200/80 bg-emerald-50/70 p-4 text-left dark:border-emerald-900/80 dark:bg-emerald-950/30">
            <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">Plan: {connectedPlan}</p>
            <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-200/80">Workspace: {connectedWorkspace}</p>
            <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-200/80">
              Recent scans synced: {accountContext?.recentScans.length ?? 0}
            </p>
          </div>

          <div className="flex w-full gap-3">
            <Button variant="outline" className="flex-1" onClick={() => window.close()}>
              Close Tab
            </Button>
            <Button className="flex-1" onClick={() => router.push("/dashboard")}>
              Dashboard
            </Button>
          </div>

          <div className="mt-6 border-t border-gray-100 pt-4 dark:border-gray-800">
            <p className="mb-2 text-sm text-muted-foreground">Need to connect manually?</p>
            <div className="rounded-md bg-slate-100 p-3 dark:bg-slate-900">
              <p className="mb-2 text-xs text-muted-foreground">1. Copy this token:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={generatedToken || "No token generated yet..."}
                  className="flex-1 rounded border bg-white px-2 py-1 font-mono text-xs dark:bg-black"
                />
                <Button
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                  onClick={() => {
                    if (generatedToken) {
                      void navigator.clipboard.writeText(generatedToken);
                    }
                  }}
                >
                  <Check className="h-3 w-3" />
                </Button>
              </div>
              <p className="mb-1 mt-2 text-xs text-muted-foreground">2. Open the extension popup and use manual token entry.</p>
              <p className="text-xs text-muted-foreground">3. The extension will fetch the same account and subscription context automatically.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
