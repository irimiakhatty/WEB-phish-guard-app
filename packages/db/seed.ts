import prisma from "./src/index";
import { hash } from "@node-rs/argon2";

// const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Check if any admin exists
  const existingAdmin = await prisma.user.findFirst({
    where: { role: "admin" },
  });

  if (existingAdmin) {
    console.log("✅ Admin user already exists:", existingAdmin.email);
    return;
  }

  // Create default admin user
  const adminEmail = process.env.ADMIN_EMAIL || "admin@phishguard.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123456";
  const adminName = process.env.ADMIN_NAME || "Admin User";

  // Check if user with this email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingUser) {
    // Update existing user to admin
    await prisma.user.update({
      where: { id: existingUser.id },
      data: { role: "admin" },
    });
    console.log("✅ Updated existing user to admin:", adminEmail);
  } else {
    // Create new admin user
    const hashedPassword = await hash(adminPassword, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });

    // Generate a unique ID for the user
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const admin = await prisma.user.create({
      data: {
        id: userId,
        email: adminEmail,
        name: adminName,
        role: "admin",
        emailVerified: true,
        accounts: {
          create: {
            id: `account_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            accountId: userId,
            providerId: "credential",
            password: hashedPassword,
          },
        },
      },
    });

    console.log("✅ Created admin user:", admin.email);
    console.log("📧 Email:", adminEmail);
    console.log("🔑 Password:", adminPassword);
    console.log("\n⚠️  Please change the password after first login!");
  }

  console.log("\n🎉 Database seed completed!");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
