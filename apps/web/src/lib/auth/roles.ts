export const SUPER_ADMIN_ROLE = "super_admin" as const;

export function isSuperAdminRole(role?: string | null): boolean {
  return role === SUPER_ADMIN_ROLE;
}

