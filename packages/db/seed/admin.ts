import prisma from "../src/index";
import { auth } from "@phish-guard-app/auth";

export async function seedSuperAdmin() {
  console.log("[seed:admin] Ensuring super admin user...");

  const adminEmail = process.env.ADMIN_EMAIL || "admin@phishguard.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123456";
  const adminName = process.env.ADMIN_NAME || "Admin User";
  const reset = process.env.ADMIN_RESET === "true";

  const existingSuperAdmin = await prisma.user.findFirst({
    where: { role: "super_admin" },
  });

  const existingUser = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (
    existingSuperAdmin &&
    !reset &&
    (!existingUser || existingSuperAdmin.id !== existingUser.id)
  ) {
    console.log(`[seed:admin] Super admin already exists: ${existingSuperAdmin.email}`);
    console.log("[seed:admin] Set ADMIN_RESET=true to replace the super admin.");
    return existingSuperAdmin;
  }

  if (existingUser) {
    if (reset) {
      console.log(`[seed:admin] ADMIN_RESET=true: deleting ${existingUser.email}...`);
      await prisma.user.delete({ where: { id: existingUser.id } });
    } else {
      const updated = await prisma.user.update({
        where: { id: existingUser.id },
        data: { role: "super_admin", emailVerified: true },
      });
      console.log(`[seed:admin] Updated existing user to super admin: ${adminEmail}`);
      console.log("[seed:admin] If login fails, rerun with ADMIN_RESET=true.");
      return updated;
    }
  }

  const result = await auth.api.signUpEmail({
    body: {
      email: adminEmail,
      password: adminPassword,
      name: adminName,
    },
  });

  if (!result) {
    throw new Error("Failed to create super admin user");
  }

  const admin = await prisma.user.update({
    where: { email: adminEmail },
    data: { role: "super_admin", emailVerified: true },
  });

  console.log(`[seed:admin] Created super admin: ${adminEmail}`);
  console.log(`[seed:admin] Password: ${adminPassword}`);
  console.log("[seed:admin] Please change the password after first login.");

  return admin;
}
