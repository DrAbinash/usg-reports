import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/**
 * The texts a signed report has already been re-signed over.
 *
 * An amendment is a real clinical event — a finding corrected after the referral
 * doctor acted on the first page — and the clinic must be able to say what was
 * signed when. The finalize route keeps one row per superseded version; this is
 * how the studio reads them back.
 *
 * `?version=N&html=1` returns that version's printed page. The page is a
 * snapshot with the machine stills inside it (hundreds of kilobytes), so the
 * list carries the text and says whether a page exists, and the page itself is
 * fetched only when he asks to see it.
 */
export async function GET(req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;

  const report = await db.usgReport.findUnique({ where: { id }, select: { id: true } });
  if (!report) return Response.json({ error: "Not found" }, { status: 404 });

  const want = new URL(req.url).searchParams;
  const versionParam = want.get("version");
  const wantHtml = want.get("html") === "1";

  if (versionParam) {
    const versionNo = Number(versionParam);
    if (!Number.isInteger(versionNo) || versionNo < 1) {
      return Response.json({ error: "Version numbers start at 1" }, { status: 400 });
    }
    const one = await db.usgReportVersion.findUnique({ where: { reportId_versionNo: { reportId: id, versionNo } } });
    if (!one) return Response.json({ error: "No such version" }, { status: 404 });
    return Response.json({
      version: wantHtml
        ? one
        : { ...one, reportHtml: null, htmlBytes: one.reportHtml ? one.reportHtml.length : 0 },
    });
  }

  const rows = await db.usgReportVersion.findMany({
    where: { reportId: id },
    orderBy: { versionNo: "desc" },
    select: {
      versionNo: true,
      findings: true,
      impression: true,
      serialNo: true,
      signedAt: true,
      amendedAt: true,
      reportHtml: true,
    },
    take: 20,
  });

  return Response.json({
    versions: rows.map((r) => ({
      versionNo: r.versionNo,
      findings: r.findings,
      impression: r.impression,
      serialNo: r.serialNo,
      signedAt: r.signedAt ? r.signedAt.toISOString() : null,
      amendedAt: r.amendedAt.toISOString(),
      // Said without shipping it: the page is only fetched when he opens it.
      hasPage: !!r.reportHtml,
    })),
  });
}
