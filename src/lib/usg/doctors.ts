/**
 * doctors.ts (v6.16) — referring doctor directory.
 *
 * Stores referring doctors (imported from CARE ERP CSV or entered
 * manually) for autocomplete in the composer's "Referred By" field.
 * Clinic-specific.
 */
import { db } from "@/lib/db";
import { getActiveClinicId } from "@/lib/auth";

export type Doctor = {
  id: string;
  name: string;
  specialization: string;
  degree: string;
  phone: string;
  hospital: string;
  area: string;
};

export type DoctorRow = Doctor & { normName: string };

/** Normalise a doctor name for dedup: lowercase, collapse whitespace, trim. */
export function normalizeDoctorName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Search doctors by name (autocomplete). Returns up to 20 matches. */
export async function searchDoctors(query: string): Promise<Doctor[]> {
  const clinicId = await getActiveClinicId().catch(() => "default");
  const q = query.trim().toLowerCase();
  if (!q) {
    // Return the 20 most-recently-used doctors when query is empty
    const rows = await db.usgDoctor.findMany({
      where: { clinicId },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });
    return rows.map(toDoctor);
  }
  // Substring match on normName (SQLite LIKE is case-insensitive for ASCII)
  const rows = await db.usgDoctor.findMany({
    where: {
      clinicId,
      OR: [
        { normName: { contains: q } },
        { name: { contains: q } },
      ],
    },
    orderBy: { name: "asc" },
    take: 20,
  });
  return rows.map(toDoctor);
}

/** List all doctors (for Settings display). */
export async function listDoctors(): Promise<Doctor[]> {
  const clinicId = await getActiveClinicId().catch(() => "default");
  const rows = await db.usgDoctor.findMany({
    where: { clinicId },
    orderBy: { name: "asc" },
  });
  return rows.map(toDoctor);
}

/** Add or update a single doctor. */
export async function saveDoctor(input: Doctor): Promise<Doctor> {
  const clinicId = await getActiveClinicId().catch(() => "default");
  const normName = normalizeDoctorName(input.name);
  if (!normName) throw new Error("Doctor name is required");

  const row = await db.usgDoctor.upsert({
    where: { clinicId_normName: { clinicId, normName } },
    create: {
      clinicId,
      name: input.name.trim(),
      specialization: input.specialization?.trim() ?? "",
      degree: input.degree?.trim() ?? "",
      phone: input.phone?.trim() ?? "",
      hospital: input.hospital?.trim() ?? "",
      area: input.area?.trim() ?? "",
      normName,
    },
    update: {
      name: input.name.trim(),
      specialization: input.specialization?.trim() ?? "",
      degree: input.degree?.trim() ?? "",
      phone: input.phone?.trim() ?? "",
      hospital: input.hospital?.trim() ?? "",
      area: input.area?.trim() ?? "",
    },
  });
  return toDoctor(row);
}

/** Delete a doctor. */
export async function deleteDoctor(id: string): Promise<void> {
  await db.usgDoctor.delete({ where: { id } });
}

/** Parse a CARE ERP doctors CSV and import all rows. Idempotent (upserts by name). */
export async function importDoctorsFromCsv(csvText: string): Promise<{ imported: number; skipped: number; total: number }> {
  const clinicId = await getActiveClinicId().catch(() => "default");
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { imported: 0, skipped: 0, total: 0 };

  // Parse header — the CARE ERP CSV has: name, specialization, degree, phone,
  // email, hospitalAffiliation, address, area, registrationNumber
  // We use a simple CSV parser (handles quoted fields with commas)
  const header = parseCsvLine(lines[0]);
  const colName = header.findIndex((h) => /name/i.test(h));
  const colSpec = header.findIndex((h) => /spec/i.test(h));
  const colDegree = header.findIndex((h) => /degree/i.test(h));
  const colPhone = header.findIndex((h) => /phone/i.test(h));
  const colHospital = header.findIndex((h) => /hospital/i.test(h));
  const colArea = header.findIndex((h) => /area/i.test(h));

  let imported = 0;
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const name = (colName >= 0 ? cols[colName] : cols[0] ?? "").trim();
    if (!name) { skipped++; continue; }

    const normName = normalizeDoctorName(name);
    if (!normName) { skipped++; continue; }

    try {
      await db.usgDoctor.upsert({
        where: { clinicId_normName: { clinicId, normName } },
        create: {
          clinicId,
          name,
          specialization: colSpec >= 0 ? (cols[colSpec] ?? "").trim() : "",
          degree: colDegree >= 0 ? (cols[colDegree] ?? "").trim() : "",
          phone: colPhone >= 0 ? (cols[colPhone] ?? "").trim() : "",
          hospital: colHospital >= 0 ? (cols[colHospital] ?? "").trim() : "",
          area: colArea >= 0 ? (cols[colArea] ?? "").trim() : "",
          normName,
        },
        update: {
          name,
          specialization: colSpec >= 0 ? (cols[colSpec] ?? "").trim() : "",
          degree: colDegree >= 0 ? (cols[colDegree] ?? "").trim() : "",
          phone: colPhone >= 0 ? (cols[colPhone] ?? "").trim() : "",
          hospital: colHospital >= 0 ? (cols[colHospital] ?? "").trim() : "",
          area: colArea >= 0 ? (cols[colArea] ?? "").trim() : "",
        },
      });
      imported++;
    } catch {
      skipped++;
    }
  }

  return { imported, skipped, total: lines.length - 1 };
}

/** Simple CSV line parser — handles quoted fields with embedded commas. */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  // Strip BOM from first field if present
  if (result.length > 0) result[0] = result[0].replace(/^\uFEFF/, "");
  return result;
}

function toDoctor(r: {
  id: string;
  name: string;
  specialization: string;
  degree: string;
  phone: string;
  hospital: string;
  area: string;
}): Doctor {
  return {
    id: r.id,
    name: r.name,
    specialization: r.specialization,
    degree: r.degree,
    phone: r.phone,
    hospital: r.hospital,
    area: r.area,
  };
}
