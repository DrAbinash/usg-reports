import { createSession, verifyPin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { ensureSeed } from "@/lib/seed";
import { audit } from "@/lib/usg/audit";
import { PIN_RULE, clientKey, gated, noteAttempt, retrySeconds } from "@/lib/rateLimit";

export async function POST(req: Request) {
  await ensureSeed();
  const key = clientKey(req, "pin");
  const gate = gated(key, PIN_RULE);
  if (gate.blocked) {
    // Say what to do about it, in the time he can wait for: this is a doctor who
    // has mistyped his own PIN, not an intruder he needs to be warned about.
    await audit({ action: "auth.lockout", detail: `PIN attempts paused for ${retrySeconds(gate.retryAfterMs)}s` });
    return Response.json(
      { error: `Too many wrong PINs. Try again in ${retrySeconds(gate.retryAfterMs)} seconds.` },
      { status: 429, headers: { "Retry-After": String(retrySeconds(gate.retryAfterMs)) } },
    );
  }
  const body = await req.json().catch(() => ({}));
  const pin = String(body.pin ?? "");
  const trust = body.trust === true;
  const s = await getSettings();
  if (!s.pinHash) return Response.json({ error: "No PIN set" }, { status: 400 });
  if (!verifyPin(pin, s.pinHash)) {
    // Small delay to blunt brute force
    await new Promise((r) => setTimeout(r, 400));
    noteAttempt(key, false);
    await audit({ action: "auth.fail", detail: "incorrect PIN attempt" });
    return Response.json({ error: "Incorrect PIN" }, { status: 401 });
  }
  noteAttempt(key, true);
  await createSession(trust);
  await audit({ action: "auth.login", detail: trust ? "trusted device session" : "session created" });
  return Response.json({ ok: true });
}
