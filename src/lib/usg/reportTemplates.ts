/**
 * reportTemplates.ts (v6.15) — Quick report templates.
 *
 * The doctor saves pre-filled report states (e.g. "Normal Whole Abdomen Male")
 * for emergency/crowd situations. One click creates a new report with the
 * template's composer state applied — no typing needed.
 *
 * Templates are clinic-specific and stored in the UsgReportTemplate table.
 */
import { db } from "@/lib/db";
import { getActiveClinicId } from "@/lib/auth";

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

/** List all templates for the active clinic, pinned first then by name. */
export async function listTemplates(): Promise<ReportTemplate[]> {
  const clinicId = await getActiveClinicId().catch(() => "default");
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
