import "./load-env.js";
import { execSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import prisma from "./src/index";
import { seedSuperAdmin } from "./seed/admin";
import { seedDemoData } from "./seed/demo";

const bootstrapDir = dirname(fileURLToPath(import.meta.url));

function isLocalDockerUrl(databaseUrl: string | undefined): boolean {
  if (!databaseUrl) return false;
  return (
    databaseUrl.includes("@localhost:") ||
    databaseUrl.includes("@127.0.0.1:") ||
    databaseUrl.includes("phishguard_dev_password")
  );
}

function printDatabaseHelp(databaseUrl: string | undefined): void {
  console.error("");
  console.error("[bootstrap] Nu pot conecta la baza de date.");
  console.error("");

  if (isLocalDockerUrl(databaseUrl)) {
    console.error("DATABASE_URL folosește localhost, dar Postgres/Docker nu rulează.");
    console.error("");
    console.error("Recomandat (multi-device, fără seed repetat):");
    console.error("  1. Creează proiect gratuit: https://neon.tech");
    console.error("  2. Copiază connection string în apps/web/.env");
    console.error("  3. Rulează din nou: bun run db:bootstrap");
    console.error("");
    console.error("Alternativ local (un singur PC): docker compose up -d");
  } else {
    console.error("Verifică DATABASE_URL în apps/web/.env și conexiunea la internet.");
    console.error("Pentru Neon, adaugă ?sslmode=require la connection string.");
  }

  console.error("");
}

function runDbPush(): void {
  try {
    execSync("npx prisma db push --schema=./prisma/schema", {
      cwd: bootstrapDir,
      stdio: "inherit",
      env: process.env,
    });
  } catch {
    printDatabaseHelp(process.env.DATABASE_URL);
    process.exit(1);
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("[bootstrap] DATABASE_URL lipsește. Setează-l în apps/web/.env");
    process.exit(1);
  }

  if (isLocalDockerUrl(databaseUrl)) {
    console.warn("[bootstrap] DATABASE_URL = localhost (Docker). Pentru mai multe device-uri, folosește Neon.");
    console.warn("[bootstrap] Ghid: docs/DEV_DATABASE.md");
  }

  console.log("[bootstrap] Applying Prisma schema (db push)...");
  runDbPush();

  console.log("[bootstrap] Checking database connection...");
  await prisma.$queryRaw`SELECT 1`;

  const userCount = await prisma.user.count();
  console.log(`[bootstrap] Found ${userCount} user(s) in database.`);

  if (userCount === 0) {
    console.log("[bootstrap] Empty database — running one-time seed...");
    const admin = await seedSuperAdmin();
    await seedDemoData(admin.id);
    console.log("[bootstrap] Initial seed completed.");
  } else {
    console.log("[bootstrap] Seed skipped — existing data preserved.");
    console.log("[bootstrap] Run `bun run db:seed` only if you need to refresh demo users.");
  }

  console.log("[bootstrap] Ready. Start the app with `bun run dev:web`.");
}

main()
  .catch((error) => {
    console.error("[bootstrap] Failed:", error);
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "ECONNREFUSED"
    ) {
      printDatabaseHelp(process.env.DATABASE_URL);
    }
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
