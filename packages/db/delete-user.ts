import prisma from "./src/index.js";

async function deleteUserByEmail() {
  const email = process.argv[2];

  if (!email) {
    console.error("❌ Usage: bun tsx delete-user.ts <email>");
    process.exit(1);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        _count: {
          select: {
            scans: true,
            accounts: true,
            sessions: true,
          },
        },
      },
    });

    if (!user) {
      console.log(`❌ User with email "${email}" not found.`);
      process.exit(1);
    }

    console.log("\n📋 User details:");
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Scans: ${user._count.scans}`);
    console.log(`   Accounts: ${user._count.accounts}`);
    console.log(`   Sessions: ${user._count.sessions}`);
    console.log("\n🗑️  Deleting user and all related data...");

    // Delete user (cascade will delete related data)
    await prisma.user.delete({
      where: { email },
    });

    console.log(`✅ User "${email}" successfully deleted!`);
  } catch (error) {
    console.error("❌ Error deleting user:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

deleteUserByEmail();
