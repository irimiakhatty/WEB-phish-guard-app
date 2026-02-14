import { redirect } from "next/navigation";
import { Building2, Shield, Users } from "lucide-react";

import { checkAdminExists } from "@/app/actions/setup";
import { getSession } from "@/lib/auth-helpers";
import SetupAdminForm from "./setup-admin-form";
import SetupLogoutPrompt from "./setup-logout-prompt";

export default async function SetupPage() {
  const adminExists = await checkAdminExists();

  if (adminExists) {
    redirect("/login");
  }

  const session = await getSession();
  if (session?.user) {
    return <SetupLogoutPrompt />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
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
                <h1 className="text-3xl font-semibold">Organization Setup</h1>
              </div>
            </div>

            <p className="text-lg text-blue-100 leading-relaxed">
              Create the first administrator for your organization workspace.
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-1 rounded-lg bg-white/15 p-2">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium">Workspace ready</p>
                  <p className="text-sm text-blue-100">
                    Your organization will be created automatically.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1 rounded-lg bg-white/15 p-2">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium">Invite your team</p>
                  <p className="text-sm text-blue-100">
                    Add members and manage access in minutes.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 text-sm text-blue-100">
            This page is only accessible during initial setup.
          </div>
        </div>

        <div className="flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-md space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Create your admin account
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                You will be able to configure security settings after sign in.
              </p>
            </div>

            <SetupAdminForm />

            <div className="text-center text-xs text-muted-foreground">
              Once an organization admin is created, this page will be disabled.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
