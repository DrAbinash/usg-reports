/**
 * secureShare.ts — tokenized expiring report share links + WhatsApp deep links.
 *
 * Tokens are HMAC-SHA256 signed (no external JWT lib). The URL carries only
 * the opaque token — never PHI. WhatsApp uses the standard wa.me URL scheme.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export type WhatsappRouting = "patient_only" | "patient_and_doctor" | "doctor_only";

export const WHATSAPP_ROUTING_VALUES: WhatsappRouting[] = [
  "patient_only",
  "patient_and_doctor",
  "doctor_only",
];

export const SHARE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Resolve signing secret — prefer install secrets, never invent a parallel store. */
export function shareSigningSecret(): string {
  const a = (process.env.STUDIO_INTERNAL_SECRET ?? "").trim();
  if (a) return a;
  const b = (process.env.SECRET_ENCRYPTION_KEY ?? "").trim();
  if (b) return b;
  return "usg-studio-dev-share-secret-do-not-use-in-prod";
}

export function isWhatsappRouting(v: unknown): v is WhatsappRouting {
  return typeof v === "string" && (WHATSAPP_ROUTING_VALUES as string[]).includes(v);
}

export function normalizeWhatsappRouting(v: unknown): WhatsappRouting {
  return isWhatsappRouting(v) ? v : "patient_only";
}

/** Create a signed share token for a report (default 7-day expiry). */
export function createShareToken(
  reportId: string,
  opts?: { ttlMs?: number; now?: number; secret?: string },
): string {
  const now = opts?.now ?? Date.now();
  const ttl = opts?.ttlMs ?? SHARE_TTL_MS;
  const exp = now + ttl;
  const body = Buffer.from(JSON.stringify({ reportId, exp }), "utf8").toString("base64url");
  const sig = createHmac("sha256", opts?.secret ?? shareSigningSecret())
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

export type ShareTokenOk = { reportId: string; exp: number };
export type ShareTokenErr = { error: "invalid" | "expired" };

/** Validate a share token. Never throws. */
export function verifyShareToken(
  token: string,
  opts?: { now?: number; secret?: string },
): ShareTokenOk | ShareTokenErr {
  const raw = (token ?? "").trim();
  const parts = raw.split(".");
  if (parts.length !== 2) return { error: "invalid" };
  const [body, sig] = parts;
  if (!body || !sig) return { error: "invalid" };

  const expected = createHmac("sha256", opts?.secret ?? shareSigningSecret())
    .update(body)
    .digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { error: "invalid" };
  } catch {
    return { error: "invalid" };
  }

  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      reportId?: unknown;
      exp?: unknown;
    };
    if (typeof claims.reportId !== "string" || !claims.reportId) return { error: "invalid" };
    if (typeof claims.exp !== "number" || !Number.isFinite(claims.exp)) return { error: "invalid" };
    const now = opts?.now ?? Date.now();
    if (claims.exp < now) return { error: "expired" };
    return { reportId: claims.reportId, exp: claims.exp };
  } catch {
    return { error: "invalid" };
  }
}

/** Digits-only E.164-ish phone for wa.me (10-digit India → prepend 91). */
export function normalizeWaPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function buildShareMessage(
  shareUrl: string,
  hospitalName = "USG Studio",
): string {
  return `Your Ultrasound Report from ${hospitalName} is ready. View securely here: ${shareUrl}. Valid for 7 days.`;
}

/** Build a wa.me deep link. Returns null when phone is missing/invalid. */
export function buildWaMeUrl(
  phone: string | null | undefined,
  message: string,
): string | null {
  const p = normalizeWaPhone(phone);
  if (!p) return null;
  return `https://wa.me/${p}?text=${encodeURIComponent(message)}`;
}

export type WhatsappSharePlan = {
  routing: WhatsappRouting;
  message: string;
  shareUrl: string;
  /** First link to open (patient or doctor depending on routing). */
  primaryUrl: string | null;
  /** Second link for patient_and_doctor (doctor). */
  secondaryUrl: string | null;
  /** True when we must fall back to clipboard copy (no usable phone). */
  copyFallback: boolean;
};

/**
 * Plan WhatsApp deep links from routing preference + phones.
 * Never puts PHI in the share URL — only the caller-supplied opaque URL.
 */
export function planWhatsappShare(opts: {
  routing: WhatsappRouting;
  shareUrl: string;
  patientPhone?: string | null;
  doctorPhone?: string | null;
  hospitalName?: string;
}): WhatsappSharePlan {
  const message = buildShareMessage(opts.shareUrl, opts.hospitalName);
  const patientUrl = buildWaMeUrl(opts.patientPhone, message);
  const doctorUrl = buildWaMeUrl(opts.doctorPhone, message);

  if (opts.routing === "doctor_only") {
    return {
      routing: opts.routing,
      message,
      shareUrl: opts.shareUrl,
      primaryUrl: doctorUrl,
      secondaryUrl: null,
      copyFallback: !doctorUrl,
    };
  }
  if (opts.routing === "patient_and_doctor") {
    return {
      routing: opts.routing,
      message,
      shareUrl: opts.shareUrl,
      primaryUrl: patientUrl,
      secondaryUrl: doctorUrl,
      copyFallback: !patientUrl && !doctorUrl,
    };
  }
  // patient_only (default)
  return {
    routing: "patient_only",
    message,
    shareUrl: opts.shareUrl,
    primaryUrl: patientUrl,
    secondaryUrl: null,
    copyFallback: !patientUrl,
  };
}

/** Absolute share URL for a token (origin without trailing slash). */
export function shareUrlForToken(origin: string, token: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/share/${encodeURIComponent(token)}`;
}
