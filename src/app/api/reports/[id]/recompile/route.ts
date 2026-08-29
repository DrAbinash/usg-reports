import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { compileImpressionText } from "@/lib/compile";

/** Explicit recompile of a manually-edited impression from finding rows. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;

  const report = await db.report.findUnique({ where: { id }, include: { findingRows: true } });
  if (!report) return Response.json({ error: "Report not found" }, { status: 404 });
  if (report.status === "FINALIZED") return Response.json({ error: "Report is finalized" }, { status: 400 });

  const impression = compileImpressionText(report.findingRows);
  await db.report.update({ where: { id }, data: { impression, impressionManual: false } });
  return Response.json({ ok: true, impression });
}
