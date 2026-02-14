import prisma from "./src/index.js";

async function resetUsers() {
  console.log("🗑️  Deleting all users and related data...");

  try {
    // Delete all users (cascade will delete related data)
    const result = await prisma.user.deleteMany({});
    
    console.log(`✅ Deleted ${result.count} users successfully!`);
    console.log("\n📝 Next steps:");
    console.log("   1. Go to http://localhost:3001/setup");
    console.log("   2. Create your first organization admin account");
    console.log("   3. Or use the sign-up page to create regular users");
  } catch (error) {
    console.error("❌ Error deleting users:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetUsers();
