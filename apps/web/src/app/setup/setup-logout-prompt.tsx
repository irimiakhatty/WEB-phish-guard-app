"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <Card className="w-full max-w-md border-gray-200/70 dark:border-gray-800/70 shadow-xl bg-white/90 dark:bg-gray-900/80 backdrop-blur">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-100 dark:bg-yellow-900 p-2 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
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
          <p className="text-sm text-gray-600 dark:text-gray-400">
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
