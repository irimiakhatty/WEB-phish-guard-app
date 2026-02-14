import prisma from "./src/index.js";

async function makeUserAdmin() {
  const email = process.argv[2];

  if (!email) {
    console.error("âŒ Usage: bun tsx make-admin.ts <email>");
    process.exit(1);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.log(`âŒ User with email "${email}" not found.`);
      process.exit(1);
    }

    if (user.role === "super_admin") {
      console.log(`âœ… User "${email}" is already a super admin.`);
      
      // Delete all sessions to force re-login
      await prisma.session.deleteMany({
        where: { userId: user.id },
      });
      console.log(`ðŸ”„ Deleted all sessions for "${email}". Please login again.`);
      
      process.exit(0);
    }

    // Update to super admin
    await prisma.user.update({
      where: { email },
      data: { role: "super_admin" },
    });

    // Delete all sessions to force re-login
    await prisma.session.deleteMany({
      where: { userId: user.id },
    });

    console.log(`âœ… User "${email}" is now a super admin!`);
    console.log(`ðŸ”„ All sessions deleted. Please login again to see super admin panel.`);
  } catch (error) {
    console.error("âŒ Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

makeUserAdmin();
