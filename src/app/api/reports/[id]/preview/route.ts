import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { buildReportHtml } from "@/lib/print";

/** Draft preview — same A4 engine as finalize, without freezing. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;
  const report = await db.report.findUnique({ where: { id }, include: { order: true, findingRows: true, images: { orderBy: { sortOrder: "asc" } } } });
  if (!report) return Response.json({ error: "Report not found" }, { status: 404 });
  const settings = await getSettings();
  const html = buildReportHtml({ settings, order: report.order, report, findingsRows: report.findingRows, images: report.images });
  return Response.json({ html });
}
