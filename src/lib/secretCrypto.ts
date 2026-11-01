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
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "crypto";
import { runtimeSecret } from "@/lib/runtimeSecret";

const ENV_KEY = "SECRET_ENCRYPTION_KEY";
const ENVELOPE_PREFIX = "v1:";
/** The key every envelope written before this install-minted secret existed was
 *  sealed with. Kept only so those rows still open; new writes use the real key. */
const LEGACY_DEV_KEY = Buffer.from("usg-studio-dev-key-do-not-use-in-prod-32b!", "utf8").subarray(0, 32);

let warnedLegacy = false;

/** Resolve the 32-byte AES key.
 *
 * `SECRET_ENCRYPTION_KEY` (64 hex) wins if he set it; otherwise the install
 * secret minted into `data/` on first boot, hashed to 32 bytes so any string is
 * usable. The literal that used to live here is published in this repo, so on an
 * install that never set the env var it was not a secret at all.
 */
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
  return createHash("sha256").update(runtimeSecret()).digest();
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
function openEnvelope(stored: string, key: Buffer): string | null {
  try {
    const parts = stored.slice(ENVELOPE_PREFIX.length).split(":");
    if (parts.length !== 3) return null;
    const iv = Buffer.from(parts[0], "hex");
    const ct = Buffer.from(parts[1], "hex");
    const tag = Buffer.from(parts[2], "hex");
    if (!iv.length || !ct.length || tag.length !== 16) return null;
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function decryptSecret(stored: string | null | undefined): string {
  if (!stored) return "";
  if (!stored.startsWith(ENVELOPE_PREFIX)) return stored; // legacy plaintext
  const pt = openEnvelope(stored, resolveKey());
  if (pt !== null) return pt;
  // Sealed with the key that was public in the source, from before this install
  // had one of its own. Opening it keeps his Orthanc password working across the
  // upgrade; saving Settings again re-seals it with the real key.
  const legacy = openEnvelope(stored, LEGACY_DEV_KEY);
  if (legacy !== null) {
    if (!warnedLegacy) {
      warnedLegacy = true;
      console.warn(
        "[secretCrypto] a stored secret is still sealed with the old published dev key — open Settings → Integrations and press Save to re-seal it.",
      );
    }
    return legacy;
  }
  return "";
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
