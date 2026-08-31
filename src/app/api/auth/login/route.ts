import { createSession, verifyPin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { ensureSeed } from "@/lib/seed";

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
    return Response.json({ error: "Incorrect PIN" }, { status: 401 });
  }
  await createSession(trust);
  return Response.json({ ok: true });
}
