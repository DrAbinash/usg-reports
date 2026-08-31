import { requireSession } from "@/lib/auth";
import { listDicomSeries } from "@/lib/orthancClient";

/** GET /api/dicom/series?study={StudyInstanceUID} — series of the linked study. */
export async function GET(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const study = new URL(req.url).searchParams.get("study") ?? "";
  const r = await listDicomSeries(study);
  if (!r.ok) return Response.json({ error: r.error }, { status: 502 });
  return Response.json({ series: r.data });
}
