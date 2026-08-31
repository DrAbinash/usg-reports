import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { buildReportHtml } from "@/lib/print";
import { finalizeReport } from "@/lib/careClient";

/**
 * Finalize (Phase 8): local-first. The local snapshot is saved even when
 * CARE is unreachable — the report is NEVER lost; a retry happens later.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;

  const report = await db.report.findUnique({ where: { id }, include: { order: true, findingRows: true, images: { orderBy: { sortOrder: "asc" } } } });
  if (!report) return Response.json({ error: "Report not found" }, { status: 404 });
  if (report.status === "FINALIZED") return Response.json({ ok: true, alreadyFinalized: true });

  if (report.findingRows.length === 0) {
    return Response.json({ error: "Findings are empty — add at least one finding" }, { status: 400 });
  }
  if (!report.impression.trim()) {
    return Response.json({ error: "Impression is empty" }, { status: 400 });
  }
  if (!report.technique.trim()) {
    return Response.json({ error: "Technique is empty" }, { status: 400 });
  }

  const settings = await getSettings();
  const html = buildReportHtml({ settings, order: report.order, report, findingsRows: report.findingRows, images: report.images });

  await db.report.update({
    where: { id },
    data: { status: "FINALIZED", reportHtml: html, finalizedAt: new Date() },
  });
  await db.careOrderLink.update({
    where: { id: report.orderId },
    data: { status: "REPORTED" },
  });

  // Best-effort CARE finalize — local state is already safe.
  const care = await finalizeReport({
    accessionNumber: report.order.accessionNumber,
    worklistId: report.order.careWorklistId,
    reportText: {
      technique: report.technique,
      findings: report.findings,
      impression: report.impression,
      recommendation: report.recommendation,
    },
    radiologistName: settings.radiologistName,
    radiologistRegNumber: settings.radiologistRegNo,
    finalizedAt: new Date().toISOString(),
  });

  if (care.ok) {
    await db.report.update({ where: { id }, data: { careSyncedAt: new Date() } });
    return Response.json({ ok: true, careOk: true });
  }

  // CARE failed — report is safe locally; the next sync retries it.
  await db.syncState.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", lastError: `Finalize pending for ${report.order.accessionNumber}: ${care.error}` },
    update: { lastError: `Finalize pending for ${report.order.accessionNumber}: ${care.error}` },
  });
  return Response.json({ ok: true, localOnly: true, careError: care.error });
}
