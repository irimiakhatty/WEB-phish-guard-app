import prisma from "./src/index";

async function main() {
  const email = "admin@phishguard.com";
  console.log(`Checking user: ${email}`);

  const user = await prisma.user.findUnique({
    where: { email },
    include: { accounts: true }
  });

  if (!user) {
    console.log("❌ User not found");
  } else {
    console.log("✅ User found:", user);
    console.log("Accounts:", user.accounts);
  }
}

main()
.catch(e => console.error(e))
.finally(() => prisma.$disconnect());
