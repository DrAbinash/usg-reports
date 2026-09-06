import { requireSession, getActiveClinicId } from "@/lib/auth";
import { listPatients } from "@/lib/usg/patients";

/** Registry listing — patients with scan counts + last scan, searchable.
 *  v6.10 — scoped by clinicId. */
export async function GET(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const clinicId = await getActiveClinicId();
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const patients = await listPatients(q, clinicId);
  return Response.json({ patients });
}
