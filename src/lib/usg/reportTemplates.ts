/**
 * reportTemplates.ts (v6.15) — Quick report templates.
 *
 * The doctor saves pre-filled report states (e.g. "Normal Whole Abdomen Male")
 * for emergency/crowd situations. One click creates a new report with the
 * template's composer state applied — no typing needed.
 *
 * Templates are clinic-specific and stored in the UsgReportTemplate table.
 *
 * v6.23: on first boot we seed pinned "NP …" templates (measurement-free
 * normals) so peak-time reporting works before the doctor saves anything.
 */
import { db } from "@/lib/db";
import { getActiveClinicId } from "@/lib/auth";
import { BUILTIN_NP_TEMPLATES, buildNpTemplateState } from "./npTemplates";

export type ReportTemplate = {
  id: string;
  name: string;
  studyKey: string;
  stateJson: string;
  pinned: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export { BUILTIN_NP_TEMPLATES, buildNpTemplateState } from "./npTemplates";

/**
 * Seed pinned NP templates for a clinic. Idempotent — skips names that
 * already exist so a doctor's edits are never overwritten.
 * @returns number of templates newly created
 */
export async function ensureBuiltinNpTemplates(clinicId?: string): Promise<number> {
  const cid = clinicId ?? (await getActiveClinicId().catch(() => "default"));
  let created = 0;
  for (const t of BUILTIN_NP_TEMPLATES) {
    const existing = await db.usgReportTemplate.findUnique({
      where: { clinicId_name: { clinicId: cid, name: t.name } },
    });
    if (existing) continue;
    const state = buildNpTemplateState(t.studyKey);
    await db.usgReportTemplate.create({
      data: {
        clinicId: cid,
        name: t.name,
        studyKey: t.studyKey,
        stateJson: JSON.stringify(state),
        pinned: true,
        sortOrder: t.sortOrder,
      },
    });
    created++;
  }
  return created;
}

/** List all templates for the active clinic, pinned first then by name. */
export async function listTemplates(): Promise<ReportTemplate[]> {
  const clinicId = await getActiveClinicId().catch(() => "default");
  // Peak-time: ensure NP seeds exist before listing (fast no-op after first boot).
  await ensureBuiltinNpTemplates(clinicId).catch(() => 0);
  const rows = await db.usgReportTemplate.findMany({
    where: { clinicId },
    orderBy: [{ pinned: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    studyKey: r.studyKey,
    stateJson: r.stateJson,
    pinned: r.pinned,
    sortOrder: r.sortOrder,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

/** Save a new template (or update if name already exists for this clinic). */
export async function saveTemplate(input: {
  name: string;
  studyKey: string;
  stateJson: string;
}): Promise<ReportTemplate> {
  const clinicId = await getActiveClinicId().catch(() => "default");
  const name = input.name.trim().slice(0, 120);
  if (!name) throw new Error("Template name is required");

  const row = await db.usgReportTemplate.upsert({
    where: { clinicId_name: { clinicId, name } },
    create: {
      clinicId,
      name,
      studyKey: input.studyKey,
      stateJson: input.stateJson,
    },
    update: {
      studyKey: input.studyKey,
      stateJson: input.stateJson,
    },
  });
  return {
    id: row.id,
    name: row.name,
    studyKey: row.studyKey,
    stateJson: row.stateJson,
    pinned: row.pinned,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Delete a template. */
export async function deleteTemplate(id: string): Promise<void> {
  await db.usgReportTemplate.delete({ where: { id } });
}

/** Toggle pin status. */
export async function toggleTemplatePin(id: string): Promise<void> {
  const row = await db.usgReportTemplate.findUnique({ where: { id } });
  if (!row) return;
  await db.usgReportTemplate.update({
    where: { id },
    data: { pinned: !row.pinned },
  });
}
