import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB = path.join(ROOT, "tests", ".tmp", "test.db");

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(ROOT, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    env: {
      // Absolute path so the SQLite file location never depends on cwd.
      // Set before any test module (re)creates the Prisma client.
      DATABASE_URL: `file:${TEST_DB}`,
    },
    // One shared SQLite file across suites — run files sequentially.
    fileParallelism: false,
  },
});
