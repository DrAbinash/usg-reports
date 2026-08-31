import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSeed } from "@/lib/seed";

/** Library: all finalized reports (frozen snapshots). */
export async function GET() {
  const guard = await requireSession();
  if (guard) return guard;
  await ensureSeed();

  const reports = await db.report.findMany({
    where: { status: "FINALIZED" },
    include: { order: true },
    orderBy: { finalizedAt: "desc" },
  });

  return Response.json({
    reports: reports.map((r) => ({
      id: r.id,
      accession: r.order.accessionNumber,
      patientName: r.order.patientName,
      patientAge: r.order.patientAge,
      testName: r.order.testName,
      modality: r.order.modality,
      billingStatus: r.order.billingStatus,
      finalizedAt: r.finalizedAt?.toISOString() ?? null,
      reportHtml: r.reportHtml,
    })),
  });
}
