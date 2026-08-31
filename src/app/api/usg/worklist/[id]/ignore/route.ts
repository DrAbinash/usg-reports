import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/usg/audit";

type Ctx = { params: Promise<{ id: string }> };

/** Ignore / un-ignore an order (non-ultrasound leftovers, duplicates). */
export async function POST(req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const order = await db.usgCareOrder.findUnique({ where: { id } });
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

  const ignore = body.ignore !== false; // default true
  const updated = await db.usgCareOrder.update({
    where: { id },
    data: {
      ignored: ignore,
      status: ignore ? "IGNORED" : order.reportId ? "REPORTING" : "PENDING",
    },
  });
  await audit({
    action: "worklist.ignore",
    patientName: order.patientName,
    detail: `${order.accessionNumber} ${ignore ? "hidden from the worklist" : "restored"}`,
  });
  return Response.json({ order: updated });
}
