import prisma from "./src/index";
import { auth } from "@phish-guard-app/auth";

async function main() {
  console.log("[seed] Starting database seed...");

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
    console.log(`[seed] Super admin already exists: ${existingSuperAdmin.email}`);
    console.log("[seed] Set ADMIN_RESET=true to replace the super admin.");
    return;
  }

  if (existingUser) {
    if (reset) {
      console.log(`[seed] ADMIN_RESET=true: deleting ${existingUser.email}...`);
      await prisma.user.delete({ where: { id: existingUser.id } });
    } else {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { role: "super_admin", emailVerified: true },
      });
      console.log(`[seed] Updated existing user to super admin: ${adminEmail}`);
      console.log("[seed] If login fails, rerun with ADMIN_RESET=true.");
      return;
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

  await prisma.user.update({
    where: { email: adminEmail },
    data: { role: "super_admin", emailVerified: true },
  });

  console.log(`[seed] Created super admin: ${adminEmail}`);
  console.log(`[seed] Email: ${adminEmail}`);
  console.log(`[seed] Password: ${adminPassword}`);
  console.log("[seed] Please change the password after first login.");
  console.log("[seed] Database seed completed.");
}

main()
  .catch((error) => {
    console.error("[seed] Error seeding database:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
