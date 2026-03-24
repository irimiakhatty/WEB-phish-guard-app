import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/auth-helpers";
import ScansClient from "./scans-client";
import { getMyScans } from "@/server/actions/scans";

export default async function ScansPage() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role === "super_admin") {
    redirect("/admin");
  }

  const scans = await getMyScans();

  return <ScansClient scans={scans} />;
}

