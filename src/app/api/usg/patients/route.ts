import { requireSession } from "@/lib/auth";
import { listPatients } from "@/lib/usg/patients";

/** Registry listing — patients with scan counts + last scan, searchable. */
export async function GET(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const patients = await listPatients(q);
  return Response.json({ patients });
}
