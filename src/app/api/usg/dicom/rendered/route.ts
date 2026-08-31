import { requireSession } from "@/lib/auth";
import { fetchRenderedBuffer } from "@/lib/usg/orthancClient";

/** Stream a server-rendered JPEG of one DICOM instance for preview. */
export async function GET(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const url = new URL(req.url);
  const study = url.searchParams.get("study") ?? "";
  const series = url.searchParams.get("series") ?? "";
  const sop = url.searchParams.get("sop") ?? "";
  const size = Number(url.searchParams.get("size") ?? "700") || 700;
  const r = await fetchRenderedBuffer({ studyUid: study, seriesUid: series, sopUid: sop, size });
  if (!r.ok) return Response.json({ error: r.error }, { status: 502 });
  return new Response(new Uint8Array(r.buf), {
    headers: { "content-type": r.contentType, "cache-control": "no-store" },
  });
}
