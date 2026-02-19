"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Check, Chrome, ShieldCheck } from "lucide-react";
import { getExtensionAuthData } from "@/app/actions/extension-auth";

// Extension ID should be coming from env
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

export default function ExtAuthPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "connecting" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  
  // Prevent double-execution in React strict mode
  const didInit = useRef(false);

  useEffect(() => {
    if (!didInit.current) {
        didInit.current = true;
        checkAuthAndConnect();
    }
  }, []);

  async function checkAuthAndConnect() {
    try {
      // 1. Check Session
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
      
      setUser(data.user);
      setStatus("connecting");

      // 2. Find or Create Token
      await findOrCreateToken();

    } catch (error) {
      console.error("Auth flow failed:", error);
      // Only redirect on auth failure, not connection failure (allow retry)
      setStatus("error");
      setError("Failed to verify authentication.");
    }
  }

  async function findOrCreateToken() {
    try {
        // A. List existing tokens
        const listRes = await fetch("/api/v1/auth/token");
        const listData = await listRes.json();
        
        let targetToken = null;

        if (listData.success && Array.isArray(listData.data)) {
            // Look for existing 'Chrome Extension' token or just pick the latest valid one
            const existing = listData.data.find((t: any) => t.name === "Chrome Extension");
            if (existing) {
                targetToken = existing.token;
            }
        }

        // B. If no token, create one
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
            
            if (!createData.success) {
                throw new Error(createData.error || "Failed to generate token");
            }
            targetToken = createData.data.token;
        }

        // C. Handoff to Extension
        if (targetToken) {
            setGeneratedToken(targetToken);
            await sendTokenToExtension(targetToken);
            setStatus("success");
        } else {
            throw new Error("Could not retrieve a valid token.");
        }

    } catch (err: any) {
        console.error("Connection failed:", err);
        setStatus("error");
        setError(err.message || "Failed to connect to extension.");
    }
  }

  async function sendTokenToExtension(token: string) {
      try {
        // Fetch rich user data for the extension (plan, limits, etc.)
        const authData = await getExtensionAuthData();
        
        const message = {
            action: "AUTH_HANDOFF",
            token,
            user: authData ? authData.user : {
                id: user?.id,
                email: user?.email,
                name: user?.name,
                plan: "free",
            },
            subscription: authData?.subscription,
            deepScanPublicKey: authData?.deepScanPublicKey || null
        };

        // Try standard runtime messaging
        const chromeApi = (
          globalThis as typeof globalThis & { chrome?: { runtime?: ExtensionRuntime } }
        ).chrome;

        if (chromeApi?.runtime) {
            chromeApi.runtime.sendMessage(EXTENSION_ID, message, (_response: unknown) => {
                if (chromeApi.runtime?.lastError) {
                   console.log("Extension not reachable via standard ID, trying self...");
                   // Fallback: If we are not whitelisted in the extension manifest externally_connectable,
                   // this might fail. But for local dev it's tricky.
                }
            });
        }
        
        // Also try window.postMessage for content script pickup (if we implement that later)
        // Send multiple times to ensure the content script is ready and listening
        const msg = { type: "PHISHGUARD_AUTH_SUCCESS", ...message };
        window.postMessage(msg, "*");
        
        // Retry a few times for race conditions
        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            window.postMessage(msg, "*");
            if (attempts >= 5) clearInterval(interval);
        }, 500);

      } catch (e) {
        console.warn("Error preparing extension data:", e);
      }
  }

  const handleRetry = () => {
    setStatus("connecting");
    findOrCreateToken();
  };

  if (status === "loading" || status === "connecting") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/20 to-purple-50/20 dark:from-gray-950 dark:via-blue-950/20 dark:to-purple-950/20 p-4">
        <Card className="w-full max-w-md border-0 shadow-lg">
            <CardContent className="pt-12 pb-12 flex flex-col items-center text-center">
                <div className="relative mb-6">
                    <div className="absolute inset-0 animate-ping rounded-full bg-blue-100 dark:bg-blue-900/30"></div>
                    <div className="relative bg-white dark:bg-slate-900 p-4 rounded-full border-2 border-blue-100 dark:border-blue-800">
                        <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
                    </div>
                </div>
                <h2 className="text-xl font-semibold mb-2">Connecting PhishGuard...</h2>
                <p className="text-muted-foreground">
                    {status === "loading" ? "Verifying your account" : "Syncing with extension"}
                </p>
            </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "error") {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/20 to-purple-50/20 dark:from-gray-950 dark:via-blue-950/20 dark:to-purple-950/20 p-4">
            <Card className="w-full max-w-md border-0 shadow-lg border-t-4 border-t-red-500">
                <CardHeader>
                    <CardTitle className="text-red-600">Connection Failed</CardTitle>
                    <CardDescription>We couldn't connect to the extension.</CardDescription>
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

  // Success State
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/20 to-purple-50/20 dark:from-gray-950 dark:via-blue-950/20 dark:to-purple-950/20 p-4">
      <Card className="w-full max-w-md border-0 shadow-lg border-t-4 border-t-green-500">
        <CardContent className="pt-12 pb-8 flex flex-col items-center text-center">
             <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-full mb-6">
                <ShieldCheck className="h-12 w-12 text-green-600 dark:text-green-400" />
             </div>
             <h2 className="text-2xl font-bold mb-2">You set!</h2>
             <p className="text-muted-foreground mb-8">
                The PhishGuard extension is now connected to your account. 
                You can close this tab.
             </p>
             
             <div className="flex gap-3 w-full">
                 <Button variant="outline" className="flex-1" onClick={() => window.close()}>
                    Close Tab
                 </Button>
                 <Button className="flex-1" onClick={() => router.push("/dashboard")}>
                    Dashboard
                 </Button>
             </div>
             
             <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                <p className="text-sm text-muted-foreground mb-2">Trouble connecting automatically?</p>
                <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded-md">
                     <p className="text-xs text-muted-foreground mb-2">1. Copy this token:</p>
                     <div className="flex gap-2">
                        <input type="text" readOnly value={generatedToken || "No token generated yet..."} className="flex-1 text-xs font-mono bg-white dark:bg-black border rounded px-2 py-1" />
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => {
                            if (generatedToken) navigator.clipboard.writeText(generatedToken);
                        }}>
                             <Check className="h-3 w-3" />
                        </Button>
                     </div>
                     <p className="text-xs text-muted-foreground mt-2 mb-1">2. Open extension popup click "Have trouble?"</p>
                     <p className="text-xs text-muted-foreground">3. Paste token and click Save.</p>
                </div>
             </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Add getStatus wrapper just to satisfy type checker if needed or reuse checkAuthAndConnect logic partially
// Actually simpler to just call sendTokenToExtension if we have token stored in a ref or state
// Let's modify the component to store token in state for the retry button.


