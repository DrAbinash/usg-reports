import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const COOKIE = "studio_session";
const CLINIC_COOKIE = "studio_clinic";
const TRUST_MS = 30 * 24 * 3600 * 1000; // 30 days
const SESSION_MS = 12 * 3600 * 1000; // 12 hours

// ── PIN hashing (scrypt — no external deps) ──────────────────────────────

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPin(pin: string, stored: string | null): boolean {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const candidate = scryptSync(pin, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export function isValidPinFormat(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

// ── Sessions ─────────────────────────────────────────────────────────────

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(trust: boolean): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + (trust ? TRUST_MS : SESSION_MS));
  // v6.10 — bind the session to the currently-selected clinic (from the
  // clinic-switcher cookie, or "default" if none). The clinicId is read
  // on every API call via getClinicId() below.
  const clinicId = await getActiveClinicId();
  await db.session.create({ data: { tokenHash: tokenHash(token), expiresAt, clinicId } });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function getSession(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return false;
  const row = await db.session.findUnique({ where: { tokenHash: tokenHash(token) } });
  if (!row) return false;
  if (row.expiresAt < new Date()) {
    await db.session.delete({ where: { id: row.id } }).catch(() => {});
    return false;
  }
  return true;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: tokenHash(token) } }).catch(() => {});
  }
  jar.delete(COOKIE);
}

/** API-route guard: returns null when authorized, or a 401 Response. */
export async function requireSession(): Promise<Response | null> {
  const ok = await getSession();
  if (ok) return null;
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

/** Prune expired sessions (fire-and-forget). */
export async function pruneSessions(): Promise<void> {
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {});
}

// ── Clinic scope (v6.10) ─────────────────────────────────────────────────
//
// The active clinic is stored in a separate cookie (studio_clinic) so the
// doctor can switch clinics without re-authenticating. The session row
// records the clinic at login time, but if the doctor switches mid-session,
// the cookie is the source of truth. The Session.clinicId is just an
// audit breadcrumb.
//
// On a single-clinic install (the original CARE Diagnostics), the cookie
// is never set and we fall back to "default" — every existing query keeps
// working with no change.

/** Read the active clinic id from the clinic-switcher cookie. Returns
 *  "default" when no clinic is selected (the original install's clinic),
 *  OR when called outside a request scope (tests, background jobs). */
export async function getActiveClinicId(): Promise<string> {
  try {
    const jar = await cookies();
    const c = jar.get(CLINIC_COOKIE)?.value;
    if (c && /^[a-zA-Z0-9_-]+$/.test(c)) return c;
  } catch {
    // Outside a request scope (tests, background jobs). Fall back to the
    // default clinic so the lib functions stay callable.
  }
  return "default";
}

/** Set the active clinic (called by the clinic switcher). */
export async function setActiveClinicId(clinicId: string): Promise<void> {
  const jar = await cookies();
  jar.set(CLINIC_COOKIE, clinicId, {
    httpOnly: true,
    sameSite: "lax",
    expires: new Date(Date.now() + TRUST_MS),
    path: "/",
  });
}

/** Clear the active-clinic cookie (logout). */
export async function clearActiveClinic(): Promise<void> {
  const jar = await cookies();
  jar.delete(CLINIC_COOKIE);
}
