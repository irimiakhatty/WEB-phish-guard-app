"use server";

import { requireAuth } from "@/lib/auth/auth-helpers";
import { getExtensionContextForUser } from "@/lib/integrations/extension-context";

export async function getExtensionAuthData() {
  const { user } = await requireAuth();
  return getExtensionContextForUser(user.id);
}