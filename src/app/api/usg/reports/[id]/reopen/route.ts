import { requireSession, getActiveClinicId } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/usg/audit";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Reopen a FINALIZED report for amendment.
 * Keeps serialNo (register discipline). Clears the edit lock so Save works.
 * Next Finalize rebuilds the frozen HTML snapshot and re-notifies CARE.
 */
export async function POST(_req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;
  const clinicId = await getActiveClinicId();

  const report = await db.usgReport.findUnique({ where: { id } });
  if (!report || report.clinicId !== clinicId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (report.status !== "FINALIZED") {
    return Response.json({ error: "Report is not finalized" }, { status: 409 });
  }

  const updated = await db.usgReport.update({
    where: { id },
    data: {
      status: "DRAFT",
      // Keep reportHtml + serialNo — last printed snapshot stays available
      // until the doctor re-finalizes; finalizedAt cleared so UI treats as draft.
      finalizedAt: null,
    },
  });

  const order = await db.usgCareOrder.findFirst({ where: { reportId: id } });
  if (order && order.status === "REPORTED") {
    await db.usgCareOrder.update({
      where: { id: order.id },
      data: { status: "REPORTING", careSyncedAt: null },
    });
  }

  await audit({
    action: "report.reopen",
    reportId: updated.id,
    serialNo: updated.serialNo ?? undefined,
    patientName: updated.patientName,
    detail: "finalized report reopened for edit — serial kept",
  });

  return Response.json({ report: updated });
}
