import { createSession, verifyPin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { ensureSeed } from "@/lib/seed";
import { audit } from "@/lib/usg/audit";

export async function POST(req: Request) {
  await ensureSeed();
  const body = await req.json().catch(() => ({}));
  const pin = String(body.pin ?? "");
  const trust = body.trust === true;
  const s = await getSettings();
  if (!s.pinHash) return Response.json({ error: "No PIN set" }, { status: 400 });
  if (!verifyPin(pin, s.pinHash)) {
    // Small delay to blunt brute force
    await new Promise((r) => setTimeout(r, 400));
    await audit({ action: "auth.fail", detail: "incorrect PIN attempt" });
    return Response.json({ error: "Incorrect PIN" }, { status: 401 });
  }
  await createSession(trust);
  await audit({ action: "auth.login", detail: trust ? "trusted device session" : "session created" });
  return Response.json({ ok: true });
}
