import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

/** GET /api/formats?modality=MR&region=Brain — complete-report formats. */
export async function GET(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;

  const url = new URL(req.url);
  const modality = url.searchParams.get("modality");
  const region = url.searchParams.get("region");

  const where: Record<string, string> = {};
  if (modality) where.modality = modality;
  if (region) where.region = region;

  const formats = await db.reportFormat.findMany({
    where,
    orderBy: [{ region: "asc" }, { isNormal: "desc" }, { sortOrder: "asc" }],
    select: {
      key: true,
      modality: true,
      region: true,
      name: true,
      studyTitle: true,
      titleSuffix: true,
      isNormal: true,
      sortOrder: true,
    },
  });
  return Response.json({ formats });
}
