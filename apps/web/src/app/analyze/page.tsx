import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-helpers";
import ManualAnalysis from "@/components/manual-analysis";

export default async function AnalyzePage() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role === "super_admin") {
    redirect("/admin");
  }

  return <ManualAnalysis />;
}
