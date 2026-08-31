import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchRenderedInstance } from "@/lib/usg/orthancClient";
import { audit } from "@/lib/usg/audit";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/usg/reports/:id/images/dicom
 * { seriesInstanceUid, sopInstanceUid, frame?, caption? }
 *
 * The same frozen key-image flow the MRI studio has: the doctor picks a
 * DICOM instance; the Studio fetches Orthanc's server-rendered JPEG and
 * FREEZES it into the report — the printed report stays perfect even after
 * the study leaves Orthanc.
 */
export async function POST(req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const report = await db.usgReport.findUnique({ where: { id } });
  if (!report) return Response.json({ error: "Report not found" }, { status: 404 });
  if (report.status === "FINALIZED") {
    return Response.json({ error: "Report is finalized and locked" }, { status: 409 });
  }

  const order = await db.usgCareOrder.findFirst({ where: { reportId: id } });
  const studyUid = order?.studyInstanceUid ?? null;
  if (!studyUid) {
    return Response.json(
      { error: "No PACS study linked to this report yet (sync the worklist first)" },
      { status: 400 },
    );
  }

  const seriesUid = String(body.seriesInstanceUid ?? "");
  const sopUid = String(body.sopInstanceUid ?? "");
  const frame = Number.isFinite(Number(body.frame)) && Number(body.frame) >= 2 ? Math.floor(Number(body.frame)) : null;
  if (!seriesUid || !sopUid) {
    return Response.json({ error: "seriesInstanceUid and sopInstanceUid are required" }, { status: 400 });
  }

  const rendered = await fetchRenderedInstance({ studyUid, seriesUid, sopUid, frame, size: 900, quality: 88 });
  if (!rendered.ok) return Response.json({ error: rendered.error }, { status: 502 });
  if (rendered.data.length > 1_500_000) {
    return Response.json({ error: "Rendered image too large to store" }, { status: 413 });
  }

  const max = await db.usgReportImage.aggregate({
    where: { reportId: id },
    _max: { sortOrder: true },
  });
  const image = await db.usgReportImage.create({
    data: {
      reportId: id,
      dataUrl: rendered.data,
      caption: String(body.caption ?? "").slice(0, 120),
      sortOrder: (max._max.sortOrder ?? 0) + 10,
    },
  });
  await audit({
    action: "image.dicom",
    reportId: id,
    patientName: report.patientName,
    detail: `key image frozen from PACS (${Math.round(rendered.data.length / 1000)} KB)`,
  });
  return Response.json({ ok: true, image });
}
