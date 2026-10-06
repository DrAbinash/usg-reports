#!/usr/bin/env node
/**
 * Forgotten-PIN recovery — clears one clinic's PIN so the setup screen can
 * set a new one. Run it on the studio server:
 *
 *   node scripts/pin-reset.mjs              # the default (CARE Diagnostics) clinic
 *   node scripts/pin-reset.mjs care-bangalore   # any clinic, by id or slug
 *
 * It writes exactly one column (HospitalSettings.pinHash) on one row. Nothing
 * else is touched — live sessions are deliberately left alone, so a reset at
 * the desk cannot interrupt a report being written on the studio PC.
 *
 * Why this exists as a server command rather than a "forgot my PIN" link on
 * the login screen: the studio is reachable from outside the clinic, and an
 * unauthenticated reset endpoint would be a permanent second door into every
 * patient record. The person who can reach this shell is already the owner.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const arg = (process.argv[2] ?? "default").trim();

async function main() {
  const clinic = await db.clinic.findFirst({
    where: { OR: [{ id: arg }, { slug: arg }] },
  });
  const clinicId = clinic?.id ?? arg;
  // Mirrors src/lib/settings.ts: the default clinic keeps the legacy row id.
  const settingsId = clinicId === "default" ? "singleton" : clinicId;

  const row = await db.hospitalSettings.findUnique({ where: { id: settingsId } });
  if (!row) {
    console.log(`[pin-reset] no settings row '${settingsId}' — nothing to reset`);
    return;
  }
  if (!row.pinHash) {
    console.log(`[pin-reset] '${settingsId}' already has no PIN — open the studio and set one`);
    return;
  }

  await db.hospitalSettings.update({ where: { id: settingsId }, data: { pinHash: "" } });

  await db.usgAudit.create({
    data: {
      clinicId,
      action: "auth.pin_reset",
      detail: "PIN cleared by scripts/pin-reset.mjs",
    },
  });

  console.log(
    `[pin-reset] cleared the PIN for '${clinic?.name ?? settingsId}'. ` +
      "Open the studio: it will ask you to set a new one.",
  );
}

main()
  .catch((e) => console.log(`[pin-reset] ERROR ${e.message}`))
  .finally(() => db.$disconnect());
