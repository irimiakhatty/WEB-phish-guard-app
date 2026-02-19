import { auth } from "@phish-guard-app/auth";
import { headers } from "next/headers";

/**
 * Get the current session without requiring authentication
 * @returns Session object or null if not authenticated
 */
export async function getSession() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    return session;
  } catch (error) {
    // Prevent auth lookup errors from crashing public pages.
    console.error("Failed to load session from better-auth:", error);
    return null;
  }
}

/**
 * Require user authentication, throw error if not authenticated
 * @throws Error if user is not authenticated
 * @returns Session object
 */
export async function requireAuth() {
  const session = await getSession();

  if (!session?.user) {
    throw new Error("Unauthorized - Please login");
  }

  return session;
}

/**
 * Require super admin role, throw error if user is not super admin
 * @throws Error if user is not authenticated or not super admin
 * @returns Session object
 */
export async function requireAdmin() {
  const session = await requireAuth();

  if (session.user.role !== "super_admin") {
    throw new Error("Forbidden - Super admin access required");
  }

  return session;
}

/**
 * Check if a role is super admin
 * @param role - User role to check
 * @returns true if role is super admin
 */
export function isAdmin(role?: string) {
  return role === "super_admin";
}

/**
 * Get current year for copyright notices
 * @returns Current year as number
 */
export function getCurrentYear(): number {
  return new Date().getFullYear();
}
