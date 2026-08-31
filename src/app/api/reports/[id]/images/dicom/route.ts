import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchRenderedInstance } from "@/lib/orthancClient";

/**
 * POST /api/reports/:id/images/dicom
 * { seriesInstanceUid, sopInstanceUid, frame?, caption? }
 *
 * The premium-report image selector (soul of CARE R1.3): the radiologist
 * picks a DICOM instance; the Studio fetches Orthanc's server-rendered JPEG
 * and FREEZES it into the report — the printed report stays perfect even
 * after the study leaves Orthanc.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const report = await db.report.findUnique({ where: { id }, include: { order: true, images: true } });
  if (!report) return Response.json({ error: "Report not found" }, { status: 404 });
  if (report.status === "FINALIZED") return Response.json({ error: "Report is finalized" }, { status: 400 });
  const studyUid = report.order.studyInstanceUid;
  if (!studyUid) return Response.json({ error: "No study linked to this order" }, { status: 400 });

  const seriesUid = String(body.seriesInstanceUid ?? "");
  const sopUid = String(body.sopInstanceUid ?? "");
  const frame = Number.isFinite(Number(body.frame)) && Number(body.frame) >= 2 ? Math.floor(Number(body.frame)) : null;
  if (!seriesUid || !sopUid) return Response.json({ error: "seriesInstanceUid and sopInstanceUid are required" }, { status: 400 });

  const rendered = await fetchRenderedInstance({ studyUid, seriesUid, sopUid, frame, size: 900, quality: 88 });
  if (!rendered.ok) return Response.json({ error: rendered.error }, { status: 502 });
  if (rendered.data.length > 1_500_000) {
    return Response.json({ error: "Rendered image too large to store" }, { status: 413 });
  }

  const sortOrder = report.images.reduce((m, r) => Math.max(m, r.sortOrder), 0) + 1;
  const image = await db.reportImage.create({
    data: {
      reportId: id,
      dataUrl: rendered.data,
      caption: String(body.caption ?? "").slice(0, 120),
      source: "dicom",
      sortOrder,
    },
  });
  return Response.json({ ok: true, image });
}
