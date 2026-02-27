import Link from "next/link";
import { getSession } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { syncStripeCheckoutSession } from "@/lib/stripe-sync";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, AlertTriangle } from "lucide-react";

interface PageProps {
  searchParams?: {
    session_id?: string | string[];
    updated?: string | string[];
  };
}

export default async function SubscriptionSuccessPage({ searchParams }: PageProps) {
  const sessionId =
    typeof searchParams?.session_id === "string" ? searchParams.session_id : undefined;
  const updated =
    typeof searchParams?.updated === "string" ? searchParams.updated : undefined;
  const session = await getSession();
  if (!session?.user) {
    const redirectTarget = sessionId
      ? `/subscriptions/success?session_id=${sessionId}`
      : "/subscriptions/success";
    redirect(`/login?redirect=${encodeURIComponent(redirectTarget)}`);
  }
  let status: "success" | "warning" | "error" = "success";
  let message = "Your subscription is active. You can continue using PhishGuard.";

  if (updated === "1") {
    status = "success";
    message = "Your subscription change was applied successfully.";
  } else if (!sessionId) {
    status = "warning";
    message = "Missing Stripe session. If you completed checkout, refresh later.";
  } else {
    try {
      const result = await syncStripeCheckoutSession(sessionId);
      if (!result.synced) {
        status = "warning";
        message = "We received the payment but could not sync the plan yet.";
      }
    } catch (err: any) {
      status = "error";
      message = err?.message || "We could not sync the subscription.";
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-2xl px-4 py-16">
        <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-800/80">
          <CardHeader className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
              {status === "error" ? (
                <AlertTriangle className="h-7 w-7 text-red-600" />
              ) : (
                <CheckCircle className="h-7 w-7 text-green-600" />
              )}
            </div>
            <CardTitle className="mt-4 text-2xl text-gray-900 dark:text-white">
              {status === "error" ? "Subscription error" : "Subscription confirmed"}
            </CardTitle>
            <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
              {message}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/subscriptions">View plans</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

