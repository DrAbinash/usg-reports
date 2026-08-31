import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Key images printed with the report (premium report soul from CARE ERP).
 * POST accepts a base64 JPEG/PNG data URL — captured from the embedded OHIF
 * viewport or uploaded/pasted as a fallback. Capped at ~1.5 MB.
 */
const MAX_DATA_URL = 1_500_000; // ≈ 1.1 MB binary
const DATA_URL_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;
  const report = await db.report.findUnique({ where: { id }, include: { images: { orderBy: { sortOrder: "asc" } } } });
  if (!report) return Response.json({ error: "Report not found" }, { status: 404 });
  return Response.json({ images: report.images });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const report = await db.report.findUnique({ where: { id }, include: { images: true } });
  if (!report) return Response.json({ error: "Report not found" }, { status: 404 });
  if (report.status === "FINALIZED") return Response.json({ error: "Report is finalized" }, { status: 400 });

  const dataUrl = String(body.dataUrl ?? "");
  if (!DATA_URL_RE.test(dataUrl)) {
    return Response.json({ error: "Image must be a JPEG or PNG data URL" }, { status: 400 });
  }
  if (dataUrl.length > MAX_DATA_URL) {
    return Response.json({ error: "Image too large (max ~1 MB) — capture at a smaller window size" }, { status: 413 });
  }
  const caption = String(body.caption ?? "").slice(0, 120);
  const source = body.source === "upload" ? "upload" : "capture";

  const sortOrder = report.images.reduce((m, r) => Math.max(m, r.sortOrder), 0) + 1;
  const image = await db.reportImage.create({ data: { reportId: id, dataUrl, caption, source, sortOrder } });
  return Response.json({ ok: true, image });
}
