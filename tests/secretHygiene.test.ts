/**
 * Phase 2 security batch.
 *
 * These are the small, unglamorous holes an internet-facing clinic app has when
 * one person builds it: a signing key published in the source, a QR secret
 * handed to the browser, a six-digit PIN with nothing in front of it, a trusted
 * cookie that survives the PIN change meant to revoke it, and a public verify
 * endpoint that answers yes/no about a 32-bit code.
 */
import { mkdtempSync, readFileSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PIN_RULE,
  VERIFY_RULE,
  clientKey,
  clearAttempts,
  gated,
  noteAttempt,
} from "@/lib/rateLimit";

const req = (ip: string) =>
  new Request("http://localhost/api", { headers: { "x-forwarded-for": `${ip}, 10.0.0.1` } }) as unknown as Request;

describe("the attempt counter", () => {
  it("lets the honest user through and stops the guesser", () => {
    clearAttempts();
    const key = clientKey(req("1.2.3.4"), "pin");
    const t0 = 1_700_000_000_000;
    for (let i = 0; i < PIN_RULE.max; i++) noteAttempt(key, false, t0);
    expect(gated(key, PIN_RULE, t0).blocked).toBe(true);
    // ...and the window is real: an hour later he can try again.
    expect(gated(key, PIN_RULE, t0 + 61 * 60 * 1000).blocked).toBe(false);
  });

  it("clears on a successful sign-in so one typo history is not a record", () => {
    clearAttempts();
    const key = clientKey(req("5.6.7.8"), "pin");
    noteAttempt(key, false);
    noteAttempt(key, false);
    noteAttempt(key, true);
    expect(gated(key, PIN_RULE).blocked).toBe(false);
  });

  it("counts per client, because a global counter would lock the clinic out", () => {
    clearAttempts();
    const a = clientKey(req("9.9.9.9"), "pin");
    const b = clientKey(req("8.8.8.8"), "pin");
    for (let i = 0; i < PIN_RULE.max; i++) noteAttempt(a, false);
    expect(gated(a, PIN_RULE).blocked).toBe(true);
    expect(gated(b, PIN_RULE).blocked).toBe(false);
  });

  it("gives verification a generous but finite budget", () => {
    expect(VERIFY_RULE.max).toBeGreaterThan(PIN_RULE.max);
  });
});

describe("the install secret", () => {
  it("is minted once, on disk, and is not the literal in the source", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "usg-secret-"));
    process.env.USG_RUNTIME_DIR = dir;
    delete process.env.STUDIO_INTERNAL_SECRET;
    delete process.env.SECRET_ENCRYPTION_KEY;
    const mod = await import("@/lib/runtimeSecret");
    mod.forgetRuntimeSecret();
    const first = mod.runtimeSecret();
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toContain("do-not-use");
    expect(existsSync(path.join(dir, "studio-secret"))).toBe(true);
    mod.forgetRuntimeSecret();
    expect(mod.runtimeSecret()).toBe(first); // stable across a re-read
    delete process.env.USG_RUNTIME_DIR;
  });

  it("seals and opens a settings secret, and still opens one sealed with the old published key", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "usg-secret2-"));
    process.env.USG_RUNTIME_DIR = dir;
    const { encryptSecret, decryptSecret } = await import("@/lib/secretCrypto");
    expect(decryptSecret(encryptSecret("orthanc-pw"))).toBe("orthanc-pw");
    // An envelope written under the dev key that used to be the fallback.
    const legacy = legacyEnvelope("legacy-orthanc-pw");
    expect(decryptSecret(legacy)).toBe("legacy-orthanc-pw");
    // And a value from before encryption existed at all still reads.
    expect(decryptSecret("plain-old-value")).toBe("plain-old-value");
    expect(decryptSecret("v1:00:11:22")).toBe("");
    delete process.env.USG_RUNTIME_DIR;
  });
});

/** Encrypt with the key that was published in this repo, to prove the fallback. */
function legacyEnvelope(plain: string): string {
  const { createCipheriv, randomBytes } = require("node:crypto");
  const key = Buffer.from("usg-studio-dev-key-do-not-use-in-prod-32b!", "utf8").subarray(0, 32);
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1:${iv.toString("hex")}:${ct.toString("hex")}:${c.getAuthTag().toString("hex")}`;
}

describe("the printed verification code", () => {
  it("is twelve hex for new sheets and still accepts the eight already in hands", async () => {
    const { buildPayload, checkPayload, signMessage, newSecret } = await import("@/lib/usg/verify");
    const secret = newSecret();
    const input = { serialNo: 7, patientName: "Sample Patientone", dateIso: "2026-08-02" } as never;
    const payload = buildPayload(input, secret);
    expect(payload.split("|").pop()).toMatch(/^[0-9a-f]{12}$/);
    expect(checkPayload(payload, secret).valid).toBe(true);
    const shortForm = `${payload.split("|").slice(0, 3).join("|")}|${signMessage(
      payload.split("|").slice(0, 3).join("|"),
      secret,
      8,
    )}`;
    expect(checkPayload(shortForm, secret).valid).toBe(true);
    expect(checkPayload(`${shortForm.slice(0, -2)}00`, secret).valid).toBe(false);
  });
});

describe("what the browser is handed", () => {
  it("does not include the QR signing secret or the verification-owed flag", () => {
    const settings = readFileSync("src/lib/settings.ts", "utf8");
    expect(settings).toMatch(/SECRET_FIELDS = \[[^\]]*"qrSecret"/);
    expect(settings).toMatch(/qrSecret: _qrSecret/);
    const state = readFileSync("src/app/api/auth/state/route.ts", "utf8");
    expect(state).not.toMatch(/demoPin:/);
  });

  it("re-mints the session and drops every other device when the PIN changes", () => {
    const pin = readFileSync("src/app/api/auth/pin/route.ts", "utf8");
    expect(pin).toMatch(/db\.session\.deleteMany\(\{ where: \{ clinicId \} \}\)/);
    expect(pin).toMatch(/await createSession\(false\)/);
    expect(pin).toMatch(/clearAttempts\(clientKey\(req, "pin"\)\)/);
  });

  it("signs share links from the install secret, not a repo literal", () => {
    const share = readFileSync("src/lib/usg/secureShare.ts", "utf8");
    expect(share).toMatch(/return runtimeSecret\(\)/);
    expect(share).not.toMatch(/return "usg-studio-dev-share-secret/);
  });

  it("documents the env keys on the container", () => {
    const compose = readFileSync("docker-compose.yml", "utf8");
    for (const k of ["STUDIO_INTERNAL_SECRET", "SECRET_ENCRYPTION_KEY", "STUDIO_COOKIE_SECURE"]) {
      expect(compose).toContain(k);
    }
  });

  it("keeps the Secure cookie opt-in so the LAN address still works", () => {
    const auth = readFileSync("src/lib/auth.ts", "utf8");
    expect(auth).toMatch(/secure: \(process\.env\.STUDIO_COOKIE_SECURE \?\? ""\)\.trim\(\) === "1"/);
    const mode = statSync("src/lib/auth.ts");
    expect(mode.size).toBeGreaterThan(0);
  });
});
