import prisma from "./src/index";

async function main() {
  const email = "admin@phishguard.com";
  console.log(`Deleting user: ${email}`);

  await prisma.user.deleteMany({
    where: { email },
  });
  
  console.log("✅ User deleted");
}

main()
.catch(e => console.error(e))
.finally(() => prisma.$disconnect());
