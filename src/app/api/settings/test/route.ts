import { requireSession } from "@/lib/auth";
import { pingCare } from "@/lib/careClient";
import { testOrthanc } from "@/lib/orthancClient";
import { getSettings } from "@/lib/settings";

export async function POST(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const body = await req.json().catch(() => ({}));
  const target = String(body.target ?? "");

  if (target === "care") {
    const r = await pingCare();
    return Response.json(r.ok ? { ok: true, message: "CARE reachable" } : { ok: false, error: r.error });
  }
  if (target === "orthanc") {
    const r = await testOrthanc();
    return Response.json(r.ok ? { ok: true, message: `Orthanc ${r.data.Version ?? ""} reachable`.trim() } : { ok: false, error: r.error });
  }
  if (target === "ohif") {
    const s = await getSettings();
    const which = body.network === "tailscale" ? "ohifTailscaleUrl" : "ohifLanUrl";
    const url = s[which];
    if (!url) return Response.json({ ok: false, error: `${body.network === "tailscale" ? "Tailscale" : "LAN"} viewer URL not set` });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(url, { method: "HEAD", signal: controller.signal });
      return Response.json(res.ok ? { ok: true, message: "Viewer reachable" } : { ok: false, error: `Viewer responded ${res.status}` });
    } catch {
      return Response.json({ ok: false, error: "Viewer unreachable" });
    } finally {
      clearTimeout(timer);
    }
  }
  return Response.json({ ok: false, error: "Unknown test target" }, { status: 400 });
}
