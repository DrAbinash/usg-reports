/**
 * USG Studio — printed-report verification (v5 phase 9).
 *
 * Every finalized report can print a signed QR: an HMAC-SHA256 code over the
 * register number + patient name + scan date, keyed by a per-install secret.
 * Anyone holding the sheet can confirm it came from this studio — scan the
 * QR (opens <studio-origin>/verify?d=…) or paste the payload text into the
 * verify page. The payload reveals nothing beyond what the sheet already
 * shows, so verification needs no session.
 */
import { createHmac, randomBytes } from "node:crypto";

export type VerifyPayloadInput = {
  serialNo: number;
  patientName: string;
  /** ISO date (scan or finalized date) — printed on the sheet. */
  dateIso: string;
};

/** "02 Aug 2026" style day stamp used inside the payload. */
function dayStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "undated";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const normName = (n: string) => n.trim().toLowerCase().replace(/\s+/g, " ");

/** The signed message string: serial | name | date. */
export function verifyMessage(input: VerifyPayloadInput): string {
  return `USG-${String(input.serialNo).padStart(4, "0")}|${normName(input.patientName)}|${dayStamp(input.dateIso)}`;
}

/** 8-char HMAC-SHA256 code (hex) for the message under the install secret. */
export function signMessage(message: string, secret: string): string {
  return createHmac("sha256", secret).update(message).digest("hex").slice(0, 8);
}

/** Build the full payload printed in the QR: message|code. */
export function buildPayload(input: VerifyPayloadInput, secret: string): string {
  const message = verifyMessage(input);
  return `${message}|${signMessage(message, secret)}`;
}

/** QR target — a URL when the origin is known (scannable phones open it),
 *  otherwise the bare payload (paste into the verify page). */
export function qrTarget(payload: string, origin: string | null): string {
  const base = origin?.replace(/\/+$/, "");
  return base ? `${base}/verify?d=${encodeURIComponent(payload)}` : payload;
}

/** Parse + check a payload. Returns the parsed fields (never the secret). */
export function checkPayload(
  raw: string,
  secret: string,
): { valid: true; serialNo: number; patientName: string; date: string } | { valid: false } {
  const text = (raw ?? "").trim();
  const parts = text.split("|");
  if (parts.length !== 4) return { valid: false };
  const [serial, name, date, code] = parts;
  const serialNo = Number(serial.replace(/^USG-/i, ""));
  if (!Number.isInteger(serialNo) || serialNo <= 0) return { valid: false };
  if (!/^[0-9a-f]{8}$/i.test(code)) return { valid: false };
  const message = `${serial}|${normName(name)}|${date}`;
  if (signMessage(message, secret) !== code.toLowerCase()) return { valid: false };
  return { valid: true, serialNo, patientName: name, date };
}

/** New 32-hex install secret (stored once on HospitalSettings.qrSecret). */
export function newSecret(): string {
  return randomBytes(16).toString("hex");
}

/** Lazily fetch (or mint) the install secret. */
export async function getOrCreateSecret(get: () => Promise<string | null>, set: (s: string) => Promise<void>): Promise<string> {
  const existing = await get();
  if (existing && existing.length >= 16) return existing;
  const fresh = newSecret();
  await set(fresh);
  return fresh;
}
