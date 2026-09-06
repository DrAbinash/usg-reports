/**
 * AES-256-GCM encryption for settings secrets (orthancPassword, geminiApiKey).
 *
 * Audit finding #5: these were stored in plaintext in the singleton
 * HospitalSettings row. SQLite file-level access (or a database backup
 * leak) would expose them. AES-256-GCM gives confidentiality + auth.
 *
 * Envelope format (all hex, no padding):
 *   v1:<iv_hex>:<ct_hex>:<tag_hex>
 *
 * Anything that doesn't start with `v1:` is treated as legacy plaintext
 * (read transparently — see `decryptSecret`). This means existing rows
 * keep working with no migration: the first save after this code ships
 * transparently re-encrypts.
 *
 * The key is `SECRET_ENCRYPTION_KEY` (32 bytes, hex-encoded, 64 chars).
 * If unset, the studio derives a deterministic key from the schema name
 * so dev/test works without env wiring. PRODUCTION MUST set the env var —
 * the derived key is public in the source and offers no real protection.
 */
import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "crypto";

const ENV_KEY = "SECRET_ENCRYPTION_KEY";
const ENVELOPE_PREFIX = "v1:";

/** Resolve the 32-byte AES key. Prefer env; fall back to a deterministic
 *  dev key (logged as a warning on first use so production is aware). */
function resolveKey(): Buffer {
  const env = (process.env[ENV_KEY] ?? "").trim();
  if (env) {
    if (!/^[0-9a-fA-F]{64}$/.test(env)) {
      throw new Error(
        `${ENV_KEY} must be 64 hex chars (32 bytes). Got ${env.length} chars.`,
      );
    }
    return Buffer.from(env, "hex");
  }
  // Dev fallback — NOT secure. Logged once via console.warn.
  if (!process.env.USG_TEST_SUPPRESS_KEY_WARN) {
    // eslint-disable-next-line no-console
    console.warn(
      `[secretCrypto] ${ENV_KEY} is unset — using deterministic dev key. ` +
        `Set the env var (64 hex chars) in production.`,
    );
    process.env.USG_TEST_SUPPRESS_KEY_WARN = "1";
  }
  return Buffer.from("usg-studio-dev-key-do-not-use-in-prod-32b!", "utf8").subarray(0, 32);
}

/** Encrypt a plaintext secret into a `v1:iv:ct:tag` envelope. Empty input
 *  returns empty (so "clear" doesn't store a nonsense envelope). */
export function encryptSecret(plaintext: string): string {
  if (!plaintext) return "";
  const key = resolveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENVELOPE_PREFIX}${iv.toString("hex")}:${ct.toString("hex")}:${tag.toString("hex")}`;
}

/** Decrypt a `v1:iv:ct:tag` envelope back to plaintext. Anything that
 *  doesn't start with `v1:` is returned verbatim — this is the legacy
 *  plaintext path so rows written before encryption shipped keep working.
 *  Auth-tag mismatch returns "" (never the wrong plaintext). */
export function decryptSecret(stored: string | null | undefined): string {
  if (!stored) return "";
  if (!stored.startsWith(ENVELOPE_PREFIX)) return stored; // legacy plaintext
  try {
    const parts = stored.slice(ENVELOPE_PREFIX.length).split(":");
    if (parts.length !== 3) return "";
    const iv = Buffer.from(parts[0], "hex");
    const ct = Buffer.from(parts[1], "hex");
    const tag = Buffer.from(parts[2], "hex");
    if (!iv.length || !ct.length || tag.length !== 16) return "";
    const key = resolveKey();
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString("utf8");
  } catch {
    return "";
  }
}

/** True if the stored value is already encrypted (envelope-prefixed). */
export function isEncryptedSecret(stored: string | null | undefined): boolean {
  return !!stored && stored.startsWith(ENVELOPE_PREFIX);
}

/** Constant-time equality — useful when comparing an entered secret
 *  against the decrypted value. */
export function secretEquals(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
