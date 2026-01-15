import { auth } from "@phish-guard-app/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import ManualAnalysis from "@/components/manual-analysis";

export default async function AnalyzePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  return <ManualAnalysis />;
}
