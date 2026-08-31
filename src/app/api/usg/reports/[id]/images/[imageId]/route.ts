import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string; imageId: string }> };

/** Edit a still's caption or reorder it within the grid. */
export async function PUT(req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id, imageId } = await ctx.params;

  const image = await db.usgReportImage.findFirst({ where: { id: imageId, reportId: id } });
  if (!image) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, string | number> = {};
  if (typeof body.caption === "string") data.caption = body.caption.trim().slice(0, 120);
  if (typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)) {
    data.sortOrder = Math.round(body.sortOrder);
  }
  if (!Object.keys(data).length) return Response.json({ image });

  const updated = await db.usgReportImage.update({ where: { id: imageId }, data });
  return Response.json({ image: updated });
}

/** Remove a still from the draft. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id, imageId } = await ctx.params;

  const image = await db.usgReportImage.findFirst({ where: { id: imageId, reportId: id } });
  if (!image) return Response.json({ error: "Not found" }, { status: 404 });
  await db.usgReportImage.delete({ where: { id: imageId } });
  return Response.json({ ok: true });
}
