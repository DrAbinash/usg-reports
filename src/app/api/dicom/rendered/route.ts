import { requireSession } from "@/lib/auth";
import { fetchRenderedInstance } from "@/lib/orthancClient";

/**
 * GET /api/dicom/rendered?study=&series=&sop=&size= — session-guarded proxy
 * of Orthanc's WADO-RS /rendered image (for picker previews; cookies flow).
 */
export async function GET(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const q = new URL(req.url).searchParams;
  const r = await fetchRenderedInstance({
    studyUid: q.get("study") ?? "",
    seriesUid: q.get("series") ?? "",
    sopUid: q.get("sop") ?? "",
    frame: q.get("frame") ? Number(q.get("frame")) : null,
    size: Math.min(600, Math.max(60, Number(q.get("size") ?? 160))),
    quality: 80,
  });
  if (!r.ok) return Response.json({ error: r.error }, { status: 502 });
  const b64 = r.data.split(",")[1] ?? "";
  const bytes = Buffer.from(b64, "base64");
  return new Response(new Uint8Array(bytes), {
    headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=300" },
  });
}
