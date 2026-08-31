import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

/** Unlinked bucket: ignore (or un-ignore) a study. */
export async function POST(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const body = await req.json().catch(() => ({}));
  const orderId = String(body.orderId ?? "");
  const ignore = body.ignore !== false;
  const order = await db.careOrderLink.findUnique({ where: { id: orderId } });
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
  await db.careOrderLink.update({ where: { id: orderId }, data: { ignored: ignore } });
  return Response.json({ ok: true });
}
