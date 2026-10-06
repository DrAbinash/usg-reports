import { createSession, hashPin, isValidPinFormat } from "@/lib/auth";
import { setPinHash } from "@/lib/settings";
import { getSettings } from "@/lib/settings";
import { ensureSeed } from "@/lib/seed";
import { isDemoPin, isPinSetupOutstanding } from "@/lib/pinPolicy";
import { audit } from "@/lib/usg/audit";

export async function POST(req: Request) {
  await ensureSeed();
  const s = await getSettings();
  // A PIN the doctor actually chose is never replaced from here — that is
  // Settings → change PIN, which verifies the current one first. The seeded
  // demo PIN is the exception: /api/auth/state counts it as "setup owed" and
  // shows this screen, so refusing here would strand the studio with no way
  // in and no way to configure one.
  if (!isPinSetupOutstanding(s.pinHash)) {
    return Response.json({ error: "PIN already set — log in or change it in Settings" }, { status: 400 });
  }
  const replacingDemo = isDemoPin(s.pinHash);
  const body = await req.json().catch(() => ({}));
  const pin = String(body.pin ?? "");
  if (!isValidPinFormat(pin)) {
    return Response.json({ error: "PIN must be exactly 6 digits" }, { status: 400 });
  }
  await setPinHash(hashPin(pin));
  await createSession(false);
  if (replacingDemo) {
    await audit({ action: "auth.setup", detail: "demo PIN replaced during setup" });
  }
  return Response.json({ ok: true });
}
