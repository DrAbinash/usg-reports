import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const COOKIE = "studio_session";
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
  await db.session.create({ data: { tokenHash: tokenHash(token), expiresAt } });
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
