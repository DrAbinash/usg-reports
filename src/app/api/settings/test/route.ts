import { requireSession } from "@/lib/auth";
import { pingCare } from "@/lib/usg/careClient";
import { testOrthanc } from "@/lib/usg/orthancClient";
import { testOhif, type OhifTestResult } from "@/lib/usg/ohifResolver";

/**
 * Test integrations from Settings → Integrations. Each side is independent:
 * one red light never hides the other's green.
 *
 * "ohif" probes every configured viewer endpoint server-side (the browser
 * cannot do this — mixed content and CORS would report a healthy viewer as
 * down) and reports where AUTO would route.
 */
export async function POST(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const body = await req.json().catch(() => ({}));
  const which = String(body.which ?? "all");

  const out: {
    care?: { ok: boolean; version?: string; error?: string };
    orthanc?: { ok: boolean; version?: string; error?: string };
    ohif?: OhifTestResult;
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
  if (which === "all" || which === "ohif") {
    out.ohif = await testOhif();
  }
  return Response.json(out);
}
