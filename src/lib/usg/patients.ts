/**
 * USG Studio — patient registry linking (v5).
 *
 * Every saved report is linked to a UsgPatient row so repeat scans connect.
 * The matching policy is deliberately conservative because two patients can
 * share a name in a walk-in clinic:
 *
 *   • phone GIVEN  → exact (normName, normPhone) match. If none exists, a
 *                    same-name patient with a BLANK phone is adopted (its
 *                    phone is filled in). Otherwise a new row is created.
 *   • phone BLANK  → only matches a same-name patient whose phone is also
 *                    blank. A phone'd same-name patient is NEVER merged into
 *                    — the stranger keeps her own record, a second blank-
 *                    phone row is created instead.
 *
 * Name is the display form kept verbatim; normName/normPhone are match keys.
 */
import { db } from "@/lib/db";

/** "  Dr.   RANI  devi " → "dr. rani devi" (collapse inner whitespace). */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** "+91 94312-34567" → "9431234567"; "RANI" → "" (no digits at all). */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export type PatientRow = { id: string; name: string; phone: string };

/**
 * Find (or create) the patient a report belongs to. Returns the patient id,
 * or null when the name is blank (report stays unlinked, like legacy rows).
 */
export async function linkPatient(name: string, phone: string): Promise<string | null> {
  const normName = normalizeName(name);
  if (!normName) return null;
  const normPhone = normalizePhone(phone);
  const display = name.trim();

  const found = await findPatient(normName, normPhone);
  if (found) {
    // Adopt: a blank-phone patient gains a phone the first time one is typed.
    if (normPhone && !found.normPhone) {
      await db.usgPatient.update({
        where: { id: found.id },
        data: { phone: phone.trim() || found.phone, normPhone },
      });
    }
    return found.id;
  }

  try {
    const created = await db.usgPatient.create({
      data: { name: display, phone: phone.trim(), normName, normPhone },
    });
    return created.id;
  } catch {
    // Unique race (concurrent save of the same person) — refind and reuse.
    const raced = await findPatient(normName, normPhone);
    return raced?.id ?? null;
  }
}

async function findPatient(
  normName: string,
  normPhone: string,
): Promise<{ id: string; name: string; phone: string; normPhone: string } | null> {
  const exact = await db.usgPatient.findUnique({
    where: { normName_normPhone: { normName, normPhone } },
  });
  if (exact) return exact;
  if (normPhone) {
    // Phone typed now, patient walked in earlier without one — adopt.
    return db.usgPatient.findFirst({ where: { normName, normPhone: "" } });
  }
  return null;
}

/** Registry listing with per-patient scan counts + last scan date. */
export async function listPatients(q = ""): Promise<
  {
    id: string;
    name: string;
    phone: string;
    notes: string;
    scanCount: number;
    lastScanAt: Date | null;
  }[]
> {
  const patients = await db.usgPatient.findMany({
    orderBy: { updatedAt: "desc" },
    take: 500,
  });
  const counts = await db.usgReport.groupBy({
    by: ["patientId"],
    where: { patientId: { not: null } },
    _count: { id: true },
    _max: { scanDate: true, createdAt: true },
  });
  const byPatient = new Map(
    counts.map((c) => [
      c.patientId as string,
      { n: c._count.id, last: c._max.scanDate ?? c._max.createdAt ?? null },
    ]),
  );
  const needle = q.trim().toLowerCase();
  return patients
    .filter((p) => !needle || p.name.toLowerCase().includes(needle) || p.phone.includes(needle))
    .map((p) => {
      const c = byPatient.get(p.id);
      return {
        id: p.id,
        name: p.name,
        phone: p.phone,
        notes: p.notes,
        scanCount: c?.n ?? 0,
        lastScanAt: c?.last ?? null,
      };
    });
}
