import { requireSession } from "@/lib/auth";
import { listDicomInstances } from "@/lib/orthancClient";

/** GET /api/dicom/instances?study=&series= — instances of one series. */
export async function GET(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const q = new URL(req.url).searchParams;
  const r = await listDicomInstances(q.get("study") ?? "", q.get("series") ?? "");
  if (!r.ok) return Response.json({ error: r.error }, { status: 502 });
  return Response.json({ instances: r.data });
}
