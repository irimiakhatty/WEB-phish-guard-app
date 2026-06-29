import "./load-env.js";
import prisma from "./src/index";
import { seedSuperAdmin } from "./seed/admin";
import { seedDemoData } from "./seed/demo";

async function main() {
  console.log("[seed] Starting database seed...");
  console.log("");

  const admin = await seedSuperAdmin();
  await seedDemoData(admin.id);

  console.log("");
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
