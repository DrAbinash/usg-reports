import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { recomputeReport } from "../../route";

/** PUT edit a finding row (text, inImpression). DELETE removes it. */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string; fid: string }> }) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id, fid } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const row = await db.findingRow.findFirst({ where: { id: fid, reportId: id } });
  if (!row) return Response.json({ error: "Finding not found" }, { status: 404 });
  const report = await db.report.findUnique({ where: { id } });
  if (report?.status === "FINALIZED") return Response.json({ error: "Report is finalized" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.text === "string" && body.text.trim()) data.text = body.text.trim();
  if (typeof body.inImpression === "boolean") data.inImpression = body.inImpression;
  if (typeof body.severity === "string") data.severity = body.severity || null;
  if (typeof body.laterality === "string") data.laterality = body.laterality || null;

  await db.findingRow.update({ where: { id: fid }, data });
  await recomputeReport(id);
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; fid: string }> }) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id, fid } = await ctx.params;
  const row = await db.findingRow.findFirst({ where: { id: fid, reportId: id } });
  if (!row) return Response.json({ error: "Finding not found" }, { status: 404 });
  const report = await db.report.findUnique({ where: { id } });
  if (report?.status === "FINALIZED") return Response.json({ error: "Report is finalized" }, { status: 400 });

  await db.findingRow.delete({ where: { id: fid } });
  await recomputeReport(id);
  return Response.json({ ok: true });
}
