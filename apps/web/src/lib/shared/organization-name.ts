export function sanitizeOrganizationName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function toOrganizationNameKey(name: string): string {
  return sanitizeOrganizationName(name).toLowerCase();
}
