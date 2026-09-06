import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/usg/audit";

type Ctx = { params: Promise<{ id: string; imageId: string }> };

/** Finalized reports are frozen — their printed snapshot already embeds
 *  the images, so any mutation here would diverge the live row from the
 *  signed record. Reject with 409 (mirroring POST on the same route). */
async function ensureDraft(id: string): Promise<Response | null> {
  const report = await db.usgReport.findUnique({
    where: { id },
    select: { status: true, patientName: true },
  });
  if (!report) return Response.json({ error: "Report not found" }, { status: 404 });
  if (report.status === "FINALIZED") {
    return Response.json(
      { error: "Report is finalized and locked — images are frozen in the printed snapshot" },
      { status: 409 },
    );
  }
  return null;
}

/** Edit a still's caption or reorder it within the grid. */
export async function PUT(req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id, imageId } = await ctx.params;

  const locked = await ensureDraft(id);
  if (locked) return locked;

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

  const locked = await ensureDraft(id);
  if (locked) return locked;

  const image = await db.usgReportImage.findFirst({ where: { id: imageId, reportId: id } });
  if (!image) return Response.json({ error: "Not found" }, { status: 404 });
  await db.usgReportImage.delete({ where: { id: imageId } });
  await audit({ action: "image.remove", reportId: id, detail: "still removed" });
  return Response.json({ ok: true });
}
