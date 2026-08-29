import { hashPin, isValidPinFormat, requireSession, verifyPin } from "@/lib/auth";
import { getSettings, setPinHash } from "@/lib/settings";

export async function POST(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const body = await req.json().catch(() => ({}));
  const current = String(body.current ?? "");
  const next = String(body.next ?? "");
  const s = await getSettings();
  if (!s.pinHash || !verifyPin(current, s.pinHash)) {
    return Response.json({ error: "Current PIN is incorrect" }, { status: 401 });
  }
  if (!isValidPinFormat(next)) {
    return Response.json({ error: "New PIN must be exactly 6 digits" }, { status: 400 });
  }
  await setPinHash(hashPin(next));
  return Response.json({ ok: true });
}
