import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { recomputeReport } from "../route";
import type { FormatRowSeed } from "@/lib/seedData";

/**
 * POST /api/reports/:id/apply-format  { formatKey, confirm? }
 * One tap → the whole report: replaces all finding rows with the format's
 * scaffold, sets technique / recommendation / study title base, resets the
 * manual flags, then recompiles findings + impression + title.
 * Refuses (409 confirmNeeded) when the report already has content.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const formatKey = String(body.formatKey ?? "");

  const report = await db.report.findUnique({ where: { id }, include: { findingRows: true } });
  if (!report) return Response.json({ error: "Report not found" }, { status: 404 });
  if (report.status === "FINALIZED") return Response.json({ error: "Report is finalized" }, { status: 400 });

  const format = await db.reportFormat.findUnique({ where: { key: formatKey } });
  if (!format) return Response.json({ error: "Unknown format" }, { status: 404 });

  const hasContent = report.findingRows.length > 0 || report.technique.trim() !== "";
  if (hasContent && body.confirm !== true) {
    return Response.json(
      { confirmNeeded: true, rowCount: report.findingRows.length },
      { status: 409 },
    );
  }

  let rows: FormatRowSeed[] = [];
  try {
    const parsed = JSON.parse(format.rowsJson || "[]");
    if (Array.isArray(parsed)) rows = parsed as FormatRowSeed[];
  } catch {
    return Response.json({ error: "Format content is corrupt" }, { status: 500 });
  }

  await db.$transaction([
    db.findingRow.deleteMany({ where: { reportId: id } }),
    ...(rows.length
      ? [db.findingRow.createMany({
          data: rows.map((r, i) => ({
            reportId: id,
            region: r.region || format.region,
            concept: r.concept || "scaffold",
            level: r.level ?? null,
            laterality: r.laterality ?? null,
            severity: r.severity ?? null,
            text: r.text,
            inImpression: r.inImpression ?? true,
            newParagraph: r.newParagraph ?? false,
            impressionOnly: r.impressionOnly ?? false,
            sortOrder: i + 1,
          })),
        })]
      : []),
    db.report.update({
      where: { id },
      data: {
        technique: format.technique,
        recommendation: format.recommendation,
        formatKey: format.key,
        studyBase: format.studyTitle,
        titleSuffix: format.titleSuffix || null,
        titleManual: false,
        impressionManual: false,
        openingManual: false,
      },
    }),
  ]);

  await recomputeReport(id);
  const fresh = await db.report.findUnique({ where: { id } });
  return Response.json({ ok: true, studyName: fresh?.studyName ?? null, findingsOpening: fresh?.findingsOpening ?? null });
}
