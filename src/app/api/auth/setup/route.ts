import { createSession, hashPin, isValidPinFormat } from "@/lib/auth";
import { setPinHash } from "@/lib/settings";
import { getSettings } from "@/lib/settings";
import { ensureSeed } from "@/lib/seed";

export async function POST(req: Request) {
  await ensureSeed();
  const s = await getSettings();
  if (s.pinHash) {
    return Response.json({ error: "PIN already set — log in or change it in Settings" }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const pin = String(body.pin ?? "");
  if (!isValidPinFormat(pin)) {
    return Response.json({ error: "PIN must be exactly 6 digits" }, { status: 400 });
  }
  await setPinHash(hashPin(pin));
  await createSession(false);
  return Response.json({ ok: true });
}
