"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/auth-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function SetupLogoutPrompt() {
  const router = useRouter();

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          toast.success("Logged out successfully");
          router.refresh();
        },
        onError: () => {
          toast.error("Failed to logout");
        },
      },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-2">
              <AlertTriangle className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <CardTitle>Already Logged In</CardTitle>
              <CardDescription>
                Logout before accessing the setup page.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You are currently logged in. To create a new admin account, please logout first.
          </p>

          <div className="flex gap-3">
            <Button
              onClick={handleLogout}
              variant="destructive"
              className="flex-1"
            >
              Logout and Continue
            </Button>
            <Button
              onClick={() => router.push("/dashboard")}
              variant="outline"
              className="flex-1"
            >
              Go to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
