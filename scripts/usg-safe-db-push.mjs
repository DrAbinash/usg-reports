#!/usr/bin/env node
/**
 * `npm run db:push` without the footgun.
 *
 * The entrypoint already refuses to boot on a schema change that would drop data
 * (docker-entrypoint.sh), and the README says so twice. The npm script used to
 * carry `--accept-data-loss`, which is the one command that walks straight past
 * that rule — a single slip against the mounted production file drops columns,
 * and a dropped column here is a dropped report.
 *
 * So: push with force disabled, and if Prisma says it needs force, print what it
 * wants to destroy and exit non-zero. The escape hatch is deliberately manual and
 * named — you have to type the word, which is the point.
 */
import { spawnSync } from "node:child_process";

const force = process.argv.slice(2).filter((a) => a.startsWith("--"));
const allowed = new Set(["--script", "--skip-generate", "--preview-feature"]);
for (const a of force) {
  if (!allowed.has(a.split("=")[0])) {
    console.error(`Refusing unknown argument ${a}. Allowed: --script, --skip-generate.`);
    process.exit(2);
  }
}

const prismaBin = "node";
const prismaArgs = ["./node_modules/prisma/build/index.js", "db", "push", ...force];

const run = spawnSync(prismaBin, prismaArgs, { encoding: "utf8" });
const out = `${run.stdout ?? ""}${run.stderr ?? ""}`;
process.stdout.write(out);

if (run.status !== 0) {
  if (/use\s+--accept-data-loss|would\s+(soon\s+)?(require|result in)\s+data\s+loss/i.test(out)) {
    console.error(
      [
        "",
        "STOP — this schema change would destroy data, so it was not applied.",
        "Finalized reports live in this database. Read what Prisma wants to drop above.",
        "If it is truly intended, do it consciously and with a backup in hand:",
        "  1) download a backup from Settings → Data, and keep it off the NAS,",
        "  2) npx prisma migrate dev   (or: npx prisma db push --accept-data-loss)",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }
  process.exit(run.status ?? 1);
}

console.log("db push applied — no data loss was required.");
