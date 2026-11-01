import { hashPin, isValidPinFormat, requireSession, verifyPin, createSession } from "@/lib/auth";
import { getSettings, setPinHash } from "@/lib/settings";
import { db } from "@/lib/db";
import { getActiveClinicId } from "@/lib/auth";
import { clearAttempts, clientKey } from "@/lib/rateLimit";

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
  // Changing the PIN is the one moment that must also mean "every other device
  // is out". Trusted cookies live thirty days, so without this a lost laptop
  // keeps reporting long after he has done the right thing. His own browser is
  // re-minted in the same breath: being locked out mid-edit is data loss, and he
  // has asked for neither.
  const clinicId = await getActiveClinicId();
  await db.session.deleteMany({ where: { clinicId } });
  await createSession(false);
  // Whatever wrong-PIN count was building up against this client dies with the
  // old secret.
  clearAttempts(clientKey(req, "pin"));
  return Response.json({ ok: true, sessionsRefreshed: true });
}
