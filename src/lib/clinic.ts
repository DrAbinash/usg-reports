/**
 * clinic.ts — multi-clinic helpers (v6.10).
 *
 * One installation can host multiple trial centers. Each clinic has its
 * own letterhead (HospitalSettings row), patients, reports, audit trail,
 * and PACS/CARE bridge config. The active clinic is selected via a
 * cookie (see auth.ts → getActiveClinicId).
 *
 * The original single-doctor install gets a "default" clinic at first
 * boot. New clinics are created via the Settings → Clinics admin page.
 */
import { db } from "@/lib/db";

export const DEFAULT_CLINIC_ID = "default";
export const DEFAULT_CLINIC_SLUG = "default";
export const DEFAULT_CLINIC_NAME = "CARE Diagnostics";

export type Clinic = {
  id: string;
  slug: string;
  name: string;
  brandColor: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  trialExpiresAt: Date | null;
  disabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ClinicSummary = Pick<
  Clinic,
  "id" | "slug" | "name" | "brandColor" | "disabled" | "trialExpiresAt"
>;

/** Ensure the "default" clinic row exists. Called at first boot. */
export async function ensureDefaultClinic(): Promise<void> {
  const existing = await db.clinic.findUnique({ where: { id: DEFAULT_CLINIC_ID } });
  if (existing) return;
  await db.clinic.create({
    data: {
      id: DEFAULT_CLINIC_ID,
      slug: DEFAULT_CLINIC_SLUG,
      name: DEFAULT_CLINIC_NAME,
    },
  });
}

/** List all clinics, ordered with "default" first, then by name. */
export async function listClinics(includeDisabled = false): Promise<Clinic[]> {
  const rows = await db.clinic.findMany({
    where: includeDisabled ? {} : { disabled: false },
    orderBy: [{ id: "asc" }, { name: "asc" }],
  });
  // "default" always sorts first.
  return rows.sort((a, b) => {
    if (a.id === DEFAULT_CLINIC_ID) return -1;
    if (b.id === DEFAULT_CLINIC_ID) return 1;
    return a.name.localeCompare(b.name);
  }) as Clinic[];
}

/** Get one clinic by id (returns null if not found or disabled when
 *  `allowDisabled` is false — used by the clinic switcher). */
export async function getClinic(id: string, allowDisabled = false): Promise<Clinic | null> {
  const row = await db.clinic.findUnique({ where: { id } });
  if (!row) return null;
  if (!allowDisabled && row.disabled) return null;
  return row as unknown as Clinic;
}

/** Validate a clinic slug: lowercase, [a-z0-9-]+, 2-40 chars, not "new". */
export function validateClinicSlug(slug: string): string[] {
  const errs: string[] = [];
  if (!slug) errs.push("Slug is required");
  else if (slug.length < 2) errs.push("Slug must be at least 2 chars");
  else if (slug.length > 40) errs.push("Slug must be ≤ 40 chars");
  else if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && slug.length > 1)
    errs.push("Slug must be lowercase, [a-z0-9-]+, not starting/ending with -");
  else if (slug === "new" || slug === "api" || slug === "settings")
    errs.push("Slug 'new', 'api', 'settings' are reserved");
  return errs;
}

/** Create a new clinic. Caller must validate slug uniqueness first. */
export async function createClinic(input: {
  slug: string;
  name: string;
  brandColor?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
}): Promise<Clinic> {
  // Generate a stable id from the slug so the clinic-switcher cookie
  // survives a DB restore (cuid() would change on every restore).
  const id = input.slug;
  const row = await db.clinic.create({
    data: {
      id,
      slug: input.slug,
      name: input.name.trim() || input.slug,
      brandColor: input.brandColor?.trim() ?? "",
      contactName: input.contactName?.trim() ?? "",
      contactPhone: input.contactPhone?.trim() ?? "",
      contactEmail: input.contactEmail?.trim() ?? "",
    },
  });
  // Create a HospitalSettings row for the new clinic so getSettings()
  // finds it on first load. The default-clinic settings row is created
  // lazily by getSettings() itself.
  await db.hospitalSettings.upsert({
    where: { id },
    update: { clinicId: id },
    create: { id, clinicId: id },
  });
  return row as unknown as Clinic;
}

/** Update an existing clinic. */
export async function updateClinic(
  id: string,
  patch: Partial<Pick<Clinic, "name" | "brandColor" | "contactName" | "contactPhone" | "contactEmail" | "disabled" | "trialExpiresAt">>,
): Promise<Clinic | null> {
  if (id === DEFAULT_CLINIC_ID && patch.disabled === true) {
    // The default clinic cannot be disabled — it's the fallback.
    throw new Error("The default clinic cannot be disabled");
  }
  const data: Record<string, unknown> = {};
  if (typeof patch.name === "string") data.name = patch.name.trim();
  if (typeof patch.brandColor === "string") data.brandColor = patch.brandColor.trim();
  if (typeof patch.contactName === "string") data.contactName = patch.contactName.trim();
  if (typeof patch.contactPhone === "string") data.contactPhone = patch.contactPhone.trim();
  if (typeof patch.contactEmail === "string") data.contactEmail = patch.contactEmail.trim();
  if (typeof patch.disabled === "boolean") data.disabled = patch.disabled;
  if (patch.trialExpiresAt === null) data.trialExpiresAt = null;
  else if (typeof patch.trialExpiresAt === "string") {
    const d = new Date(patch.trialExpiresAt);
    if (!Number.isNaN(d.getTime())) data.trialExpiresAt = d;
  }
  if (Object.keys(data).length === 0) return await getClinic(id, true);
  const row = await db.clinic.update({ where: { id }, data });
  return row as unknown as Clinic;
}

/** Is the given clinic's trial expired? Returns false if no expiry set. */
export function isTrialExpired(clinic: { trialExpiresAt: Date | string | null }): boolean {
  if (!clinic.trialExpiresAt) return false;
  const d = new Date(clinic.trialExpiresAt);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}
