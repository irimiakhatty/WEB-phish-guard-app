import "./load-env.js";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  // We use a multi-file Prisma schema (schema folder)
  schema: "prisma/schema",
  // Keep migrations co-located with the schema folder
  migrations: {
    path: "prisma/schema/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
