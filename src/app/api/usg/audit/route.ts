import { requireSession, getActiveClinicId } from "@/lib/auth";
import { db } from "@/lib/db";

/** The activity feed — newest first, capped. Append-only by design.
 *  v6.10 — scoped by clinicId so each clinic sees only its own activity. */
export async function GET(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const clinicId = await getActiveClinicId();
  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 200) || 200, 1), 1000);
  const action = url.searchParams.get("action")?.trim();

  const where: { clinicId: string; action?: string } = { clinicId };
  if (action) where.action = action;
  const entries = await db.usgAudit.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return Response.json({ entries });
}
