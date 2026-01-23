"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Copy, Check, Chrome } from "lucide-react";
import { getExtensionAuthData } from "@/app/actions/extension-auth";

export default function ExtAuthPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
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
      
      setUser(data.user);
      setLoading(false);
    } catch (error) {
      console.error("Auth check failed:", error);
      router.push("/login?redirect=/ext-auth");
    }
  }

  async function generateToken() {
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/auth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Chrome Extension",
          expiresInDays: 365, // 1 year
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to generate token");
      }

      setToken(data.data.token);

      // Get extended info
      try {
        const authData = await getExtensionAuthData();
        // Send token to extension
        sendTokenToExtension(data.data.token, authData);
      } catch (e) {
        console.error("Failed to fetch extension auth data:", e);
        // Fallback
        sendTokenToExtension(data.data.token);
      }
    } catch (error: any) {
      console.error("Token generation failed:", error);
      setError(error.message || "Failed to generate token");
    } finally {
      setGenerating(false);
    }
  }

  function sendTokenToExtension(token: string, authData: any = null) {
    // Try to send message to extension
    if (typeof chrome !== "undefined" && chrome.runtime) {
      try {
        const message = {
            action: "AUTH_HANDOFF",
            token,
            user: authData ? authData.user : {
              id: user.id,
              email: user.email,
              name: user.name,
              plan: "free", // Default plan
            },
            subscription: authData?.subscription
        };

        chrome.runtime.sendMessage(
          process.env.NEXT_PUBLIC_EXTENSION_ID || "",
          message,
          (response) => {
            if (chrome.runtime.lastError) {
              console.warn("Extension not found:", chrome.runtime.lastError);
            } else {
              console.log("Token sent to extension:", response);
            }
          }
        );
      } catch (error) {
        console.warn("Could not send to extension:", error);
      }
    }
  }

  async function copyToClipboard() {
    if (!token) return;

    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl py-12 px-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Chrome className="h-8 w-8 text-blue-600" />
            <div>
              <CardTitle>Chrome Extension Authentication</CardTitle>
              <CardDescription>
                Generate an API token to connect your PhishGuard Chrome extension
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!token ? (
            <>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Logged in as: <strong>{user?.email}</strong>
                </p>
                <p className="text-sm text-muted-foreground">
                  Click the button below to generate an API token for your Chrome extension.
                  This token will be valid for 1 year.
                </p>
              </div>

              <Button
                onClick={generateToken}
                disabled={generating}
                className="w-full"
                size="lg"
              >
                {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate API Token
              </Button>
            </>
          ) : (
            <>
              <Alert>
                <AlertDescription>
                  ✅ Token generated successfully! Copy it to your extension settings or it
                  will be automatically sent if the extension is installed.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <label className="text-sm font-medium">Your API Token:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={token}
                    readOnly
                    className="flex-1 px-3 py-2 text-sm border rounded-md bg-muted font-mono"
                  />
                  <Button
                    onClick={copyToClipboard}
                    variant="outline"
                    size="icon"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Keep this token secure. It grants access to your PhishGuard account.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium">Next Steps:</h3>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Open your PhishGuard Chrome extension</li>
                  <li>Go to extension settings (click the gear icon)</li>
                  <li>Paste the token in the "API Token" field</li>
                  <li>Save and start protecting yourself from phishing!</li>
                </ol>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => router.push("/dashboard")}
                  variant="default"
                  className="flex-1"
                >
                  Go to Dashboard
                </Button>
                <Button
                  onClick={() => {
                    setToken(null);
                    setError(null);
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Generate Another Token
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
