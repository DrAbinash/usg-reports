import { requireSession } from "@/lib/auth";
import { pingCare } from "@/lib/careClient";
import { testOrthanc } from "@/lib/orthancClient";
import { probeViewer } from "@/lib/viewerClient";
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
    const message = `Orthanc ${r.ok && r.data.Version ? `${r.data.Version} ` : ""}reachable`;
    return Response.json(r.ok ? { ok: true, message } : { ok: false, error: r.error });
  }
  if (target === "ohif") {
    // Tests use the SAVED values — the doctor must click "Save integrations"
    // first. The LAN/Tailscale distinction is preserved via the label.
    const s = await getSettings();
    const which = body.network === "tailscale" ? "ohifTailscaleUrl" : "ohifLanUrl";
    const label = body.network === "tailscale" ? "Tailscale viewer" : "LAN viewer";
    const url = s[which] ?? "";
    if (!url) return Response.json({ ok: false, error: `${label} URL not set (save integrations first)` });
    const r = await probeViewer(url, label);
    return Response.json(r.ok ? { ok: true, message: r.message } : { ok: false, error: r.error });
  }
  return Response.json({ ok: false, error: "Unknown test target" }, { status: 400 });
}
