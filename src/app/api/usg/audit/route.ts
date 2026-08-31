import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

/** The activity feed — newest first, capped. Append-only by design. */
export async function GET(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 200) || 200, 1), 1000);
  const action = url.searchParams.get("action")?.trim();

  const entries = await db.usgAudit.findMany({
    where: action ? { action } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return Response.json({ entries });
}
