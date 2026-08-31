/**
 * USG Studio seed — makes the studio usable the moment it boots.
 * Idempotent: guards every write so it is safe on every request.
 */
import { db } from "@/lib/db";
import { hashPin } from "@/lib/auth";

/** Seed everything. Safe to call on every boot — all writes are guarded. */
export async function ensureSeed(): Promise<void> {
  // Hospital defaults (only create when missing — never overwrite user edits)
  const s = await db.hospitalSettings.findUnique({ where: { id: "singleton" } });
  if (!s) {
    await db.hospitalSettings.create({
      data: {
        id: "singleton",
        appTitle: "CARE USG Studio",
        hospitalName: "CARE Diagnostics",
        addressLine: "Civil Line Road, Deoghar, Jharkhand",
        phone: "+91 00000 00000",
        footerMessage: "This report is electronically generated.",
        // Demo PIN so the lock screen is explorable immediately; change in Settings.
        pinHash: hashPin("123456"),
      },
    });
  }
}
