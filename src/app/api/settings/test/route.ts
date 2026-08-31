import { requireSession } from "@/lib/auth";
import { pingCare } from "@/lib/usg/careClient";
import { testOrthanc } from "@/lib/usg/orthancClient";

/**
 * Test both integrations from Settings → Integrations. Each side is
 * independent: one red light never hides the other's green.
 */
export async function POST(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const body = await req.json().catch(() => ({}));
  const which = String(body.which ?? "all");

  const out: {
    care?: { ok: boolean; version?: string; error?: string };
    orthanc?: { ok: boolean; version?: string; error?: string };
  } = {};

  if (which === "all" || which === "care") {
    const r = await pingCare();
    out.care = r.ok ? { ok: true, version: r.data?.version } : { ok: false, error: r.error };
  }
  if (which === "all" || which === "orthanc") {
    const r = await testOrthanc();
    out.orthanc = r.ok
      ? { ok: true, version: r.data?.Version != null ? String(r.data.Version) : undefined }
      : { ok: false, error: r.error };
  }
  return Response.json(out);
}
