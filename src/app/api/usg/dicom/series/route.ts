import { requireSession } from "@/lib/auth";
import { listDicomSeries } from "@/lib/usg/orthancClient";

export async function GET(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const url = new URL(req.url);
  const study = url.searchParams.get("study") ?? "";
  const r = await listDicomSeries(study);
  if (!r.ok) return Response.json({ error: r.error }, { status: 502 });
  return Response.json({ series: r.data });
}
