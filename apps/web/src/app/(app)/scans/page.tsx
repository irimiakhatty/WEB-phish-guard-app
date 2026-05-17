import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/auth-helpers";

export default async function ScansPage() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  redirect("/analyze");
}
