/**
 * Vitest global setup: recreate a scratch SQLite database with the studio
 * schema before any test module runs. Uses the repo's own Prisma schema via
 * `db push` (additive, empty DB — nothing to lose). Never touches ./data or
 * the developer's dev.db.
 */
import { execSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TMP = path.join(ROOT, "tests", ".tmp");

export default function globalSetup(): void {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  execSync("npx prisma db push --skip-generate", {
    cwd: ROOT,
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: `file:${path.join(TMP, "test.db")}` },
  });
}
