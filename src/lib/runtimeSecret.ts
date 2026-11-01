/**
 * One install secret, minted once, stored beside the database.
 *
 * Two things are signed or sealed with it: share links (`secureShare`) and the
 * AES key that wraps the settings' passwords (`secretCrypto`). Before this, both
 * fell back to a literal baked into the source — which is published to anyone who
 * can read the repo, and on this install the compose file never set the env vars,
 * so the literal was the production answer. A number that cannot be guessed and
 * is not in the source is the whole fix.
 *
 * It lives in `data/` next to the SQLite file, which is inside the volume he
 * already backs up and outside every place a secret is never meant to be: it is
 * not in git, not in the image, not in a settings row, and the backup collector
 * deliberately skips secret columns (the file is the key, the database is not).
 *
 * Setting `STUDIO_INTERNAL_SECRET` or `SECRET_ENCRYPTION_KEY` still wins, and is
 * what he should do when he next edits the compose file — this exists so that
 * doing nothing is not the same as shipping a public key.
 */
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const FILE_NAME = "studio-secret";
let cached: string | null = null;

function secretDir(): string {
  return process.env.USG_RUNTIME_DIR ?? path.join(process.cwd(), "data");
}

function secretPath(): string {
  return path.join(secretDir(), FILE_NAME);
}

function looksLikeSecret(v: string): boolean {
  return /^[0-9a-f]{32,}$/i.test(v);
}

/**
 * The install secret: env if set, otherwise a 32 random bytes minted on first
 * boot and re-read from then on. Throws only if the file exists but is unreadable
 * or corrupt — an ambiguous key would silently mint a second one and invalidate
 * every share link already printed.
 */
export function runtimeSecret(): string {
  const env = (process.env.STUDIO_INTERNAL_SECRET ?? "").trim();
  if (env) return env;
  const enc = (process.env.SECRET_ENCRYPTION_KEY ?? "").trim();
  if (enc) return enc;

  if (cached) return cached;
  const p = secretPath();
  if (existsSync(p)) {
    const stored = readFileSync(p, "utf8").trim();
    if (!looksLikeSecret(stored)) {
      throw new Error(
        `${p} exists but is not a minted secret — refusing to guess. Delete it to mint a new one (share links printed so far will stop verifying).`,
      );
    }
    cached = stored;
    return cached;
  }

  const minted = randomBytes(32).toString("hex");
  mkdirSync(path.dirname(p), { recursive: true });
  // 0600: only the container's user. A world-readable key is no key.
  writeFileSync(p, `${minted}\n`, { mode: 0o600 });
  cached = minted;
  return cached;
}

/** Where it lives, for the health probe and the settings screen to name. */
export function runtimeSecretPath(): string {
  return secretPath();
}

/** Test seam — the cache would otherwise pin one secret across a suite. */
export function forgetRuntimeSecret(): void {
  cached = null;
}
