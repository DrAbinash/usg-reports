import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSeed } from "@/lib/seed";

/** Quick phrases (Settings → Phrases manager + editor chip groups). */
export async function GET(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  await ensureSeed();
  const url = new URL(req.url);
  const region = url.searchParams.get("region");
  const modality = url.searchParams.get("modality");
  const where: Record<string, string> = {};
  if (region) where.region = region;
  if (modality) where.modality = modality;
  const phrases = await db.quickPhrase.findMany({ where, orderBy: [{ region: "asc" }, { sortOrder: "asc" }] });
  return Response.json({ phrases });
}
