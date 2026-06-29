import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = dirname(fileURLToPath(import.meta.url));
const webEnvDir = resolve(pkgDir, "../../apps/web");

/**
 * Single source of truth: apps/web/.env (same Neon URL as Vercel).
 * packages/db/.env is optional legacy; apps/web always wins.
 */
export function loadDbEnv(): void {
  config({ path: resolve(pkgDir, ".env") });
  config({ path: resolve(webEnvDir, ".env"), override: true });
  config({ path: resolve(webEnvDir, ".env.local"), override: true });
}

loadDbEnv();
