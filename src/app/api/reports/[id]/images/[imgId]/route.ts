import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

/** PUT caption / reorder; DELETE removes a key image. */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string; imgId: string }> }) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id, imgId } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const image = await db.reportImage.findUnique({ where: { id: imgId } });
  if (!image || image.reportId !== id) return Response.json({ error: "Image not found" }, { status: 404 });

  const report = await db.report.findUnique({ where: { id } });
  if (report?.status === "FINALIZED") return Response.json({ error: "Report is finalized" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.caption === "string") data.caption = body.caption.slice(0, 120);
  if (typeof body.sortOrder === "number") data.sortOrder = body.sortOrder;
  const updated = await db.reportImage.update({ where: { id: imgId }, data });
  return Response.json({ ok: true, image: updated });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; imgId: string }> }) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id, imgId } = await ctx.params;

  const image = await db.reportImage.findUnique({ where: { id: imgId } });
  if (!image || image.reportId !== id) return Response.json({ error: "Image not found" }, { status: 404 });

  const report = await db.report.findUnique({ where: { id } });
  if (report?.status === "FINALIZED") return Response.json({ error: "Report is finalized" }, { status: 400 });

  await db.reportImage.delete({ where: { id: imgId } });
  return Response.json({ ok: true });
}
