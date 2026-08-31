import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

/** Get-or-create the draft report for an order; promote to REPORTING. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;

  const order = await db.careOrderLink.findUnique({ where: { id }, include: { report: true } });
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
  if (order.report?.status === "FINALIZED") {
    return Response.json({ reportId: order.report.id, finalized: true });
  }

  let report = order.report;
  if (!report) {
    // Auto-fill technique from the region template
    const technique = await db.techniqueTemplate.findUnique({
      where: { modality_region: { modality: order.modality, region: order.bodyRegion } },
    });
    report = await db.report.create({
      data: {
        orderId: order.id,
        technique: technique?.text ?? "",
      },
    });
  }
  if (order.status !== "REPORTED") {
    await db.careOrderLink.update({ where: { id }, data: { status: "REPORTING" } });
  }
  return Response.json({ reportId: report.id, finalized: false });
}
