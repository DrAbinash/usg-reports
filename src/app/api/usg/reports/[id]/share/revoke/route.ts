import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/usg/audit";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/usg/reports/[id]/share/revoke — withdraw every share link issued
 * for this report up to this moment.
 *
 * The tokens are stateless HMAC and were never stored, so there is nothing to
 * delete. The report keeps a cutoff instead: a link is dead when it was minted
 * at or before shareRevokedAt, and tokens minted before the cutoff existed at
 * all (no issue time) die with it too. Sharing again afterwards mints a newer
 * token that still works.
 */
export async function POST(_req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;

  const { id } = await ctx.params;
  const report = await db.usgReport.findUnique({
    where: { id },
    select: { id: true, patientName: true, serialNo: true },
  });
  if (!report) return Response.json({ error: "Not found" }, { status: 404 });

  const at = new Date();
  await db.usgReport.update({ where: { id }, data: { shareRevokedAt: at } });
  await audit({
    action: "report.share_revoke",
    reportId: id,
    patientName: report.patientName,
    serialNo: report.serialNo,
    detail: "all share links withdrawn",
  });

  return Response.json({ ok: true, revokedAt: at.toISOString() });
}
