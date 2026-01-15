import { auth } from "@phish-guard-app/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth-helpers";
import AdminUsersClient from "./users-client";
import { getAllUsers } from "@/app/actions/scans";
import { getAllOrganizations } from "@/app/actions/organizations";

export default async function AdminUsersPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user || !isAdmin(session.user.role)) {
    redirect("/dashboard");
  }

  const [users, organizations] = await Promise.all([
    getAllUsers(),
    getAllOrganizations(),
  ]);

  return <AdminUsersClient users={users} organizations={organizations} />;
}
