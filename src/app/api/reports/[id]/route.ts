import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { compileFindingsText, compileImpressionText, composeFindingsOpening } from "@/lib/compile";

/** GET report + order + rows + region phrases. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;

  const report = await db.report.findUnique({
    where: { id },
    include: {
      order: true,
      findingRows: { orderBy: { sortOrder: "asc" } },
      images: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!report) return Response.json({ error: "Report not found" }, { status: 404 });

  const phrases = await db.quickPhrase.findMany({
    where: { modality: report.order.modality },
    orderBy: [{ region: "asc" }, { sortOrder: "asc" }],
  });

  return Response.json({
    report: {
      id: report.id,
      technique: report.technique,
      impression: report.impression,
      impressionManual: report.impressionManual,
      recommendation: report.recommendation,
      status: report.status,
      studyName: report.studyName,
      findingsOpening: report.findingsOpening,
      openingManual: report.openingManual,
      formatKey: report.formatKey,
      titleManual: report.titleManual,
      finalizedAt: report.finalizedAt?.toISOString() ?? null,
      reportHtml: report.reportHtml,
    },
    order: {
      id: report.order.id,
      accessionNumber: report.order.accessionNumber,
      patientName: report.order.patientName,
      patientAge: report.order.patientAge,
      patientGender: report.order.patientGender,
      patientMrn: report.order.patientMrn,
      referringDoctor: report.order.referringDoctor,
      testName: report.order.testName,
      modality: report.order.modality,
      bodyRegion: report.order.bodyRegion,
      billingStatus: report.order.billingStatus,
      status: report.order.status,
      studyDate: report.order.studyDate?.toISOString() ?? null,
      studyInstanceUid: report.order.studyInstanceUid,
    },
    findings: report.findingRows,
    images: report.images,
    phrases,
  });
}

/** PUT technique / impression / recommendation. Editing impression manually flags it. */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const report = await db.report.findUnique({ where: { id }, include: { findingRows: true } });
  if (!report) return Response.json({ error: "Report not found" }, { status: 404 });
  if (report.status === "FINALIZED") return Response.json({ error: "Report is finalized" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.technique === "string") data.technique = body.technique;
  if (typeof body.recommendation === "string") data.recommendation = body.recommendation;
  if (typeof body.studyName === "string" && body.studyName.trim() !== "") {
    data.studyName = body.studyName;
    data.titleManual = true;
  }
  if (typeof body.findingsOpening === "string") {
    data.findingsOpening = body.findingsOpening;
    data.openingManual = body.findingsOpening.trim() !== "";
  }
  if (typeof body.impression === "string") {
    const compiled = compileImpressionText(report.findingRows);
    data.impression = body.impression;
    // Manual flag flips on when the stored text diverges from compiled output.
    data.impressionManual = body.impression.trim() !== "" && body.impression.trim() !== compiled.trim();
  }

  const updated = await db.report.update({ where: { id }, data });
  return Response.json({
    ok: true,
    impressionManual: updated.impressionManual,
  });
}

/** Shared helper for findings routes — recompute derived text after mutation.
 *  The heading stays SHORT ("MRI BRAIN"); the composed phrase lives as the
 *  bold opening line of FINDINGS. */
export async function recomputeReport(reportId: string) {
  const report = await db.report.findUnique({ where: { id: reportId }, include: { findingRows: true } });
  if (!report) return;
  const findings = compileFindingsText(report.findingRows);
  const data: Record<string, unknown> = { findings };
  if (!report.impressionManual) {
    data.impression = compileImpressionText(report.findingRows);
  }
  if (report.studyBase) {
    const fragments = report.findingRows
      .filter((r) => !r.impressionOnly && r.titleFragment)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((r) => r.titleFragment as string);
    if (!report.titleManual) data.studyName = report.studyBase;
    if (!report.openingManual) {
      data.findingsOpening = composeFindingsOpening(report.studyBase, report.titleSuffix, fragments);
    }
  }
  await db.report.update({ where: { id: reportId }, data });
}
