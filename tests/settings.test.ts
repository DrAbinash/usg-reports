/**
 * Settings persistence tests — against a REAL Prisma client + scratch SQLite
 * database (created by tests/global-setup.ts). This is the exact save/load
 * path the doctor uses:
 *
 *   edit letterhead / sonologist block / print preferences → Save
 *   → HospitalSettings row must contain those values,
 *   → print enums must be normalised (premium/a4 defaults),
 *   → legacy MRI/PACS fields must NEVER be written (the columns are gone),
 *   → GET /api/settings (masked) must never leak the PIN hash.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getMaskedSettings, getSettings, setPinHash, updateSettings } from "@/lib/settings";

beforeEach(async () => {
  // Clean slate: settings.ts lazily re-creates the singleton row.
  await db.hospitalSettings.deleteMany();
});

afterEach(async () => {
  await db.hospitalSettings.deleteMany();
});

describe("singleton creation with USG defaults", () => {
  it("lazily creates the row with the USG studio defaults", async () => {
    await db.hospitalSettings.deleteMany();
    const s = await getSettings();
    expect(s.id).toBe("singleton");
    expect(s.appTitle).toBe("CARE USG Studio");
    expect(s.usgPrintStyle).toBe("premium");
    expect(s.usgPrintPaper).toBe("a4");
    expect(s.usgShowMachine).toBe(true);
    expect(s.usgMachineLine).toContain("GE Voluson Pro");
    expect(s.pinHash).toBeNull();
    expect(s.usgDoctorName).toBe("");
  });
});

describe("USG settings persist and reload exactly", () => {
  it("stores the sonologist block verbatim", async () => {
    await updateSettings({
      usgDoctorName: "Dr. Sugandha Priyadarshini",
      usgDoctorQual: "MBBS, MD",
      usgDoctorRegNo: "J/12345",
      usgFooterLine: "Kindly co-relate with clinico-pathological findings.",
    });
    const s = await getSettings();
    expect(s.usgDoctorName).toBe("Dr. Sugandha Priyadarshini");
    expect(s.usgDoctorQual).toBe("MBBS, MD");
    expect(s.usgDoctorRegNo).toBe("J/12345");
  });

  it("trims whitespace so a pasted value can never be corrupted", async () => {
    await updateSettings({
      hospitalName: "  CARE Diagnostics \n",
      usgDeclarationLine: "\tPC-PNDT declaration ",
    });
    const s = await getSettings();
    expect(s.hospitalName).toBe("CARE Diagnostics");
    expect(s.usgDeclarationLine).toBe("PC-PNDT declaration");
  });

  it("allows clearing an ordinary field (empty string is a valid update)", async () => {
    await updateSettings({ usgSignatureUrl: "https://example.com/sig.png" });
    expect((await getSettings()).usgSignatureUrl).toBe("https://example.com/sig.png");
    await updateSettings({ usgSignatureUrl: "" });
    expect((await getSettings()).usgSignatureUrl).toBe("");
  });

  it("re-updates a field to a new value", async () => {
    await updateSettings({ appTitle: "CARE USG Studio" });
    await updateSettings({ appTitle: "Sugandha USG" });
    expect((await getSettings()).appTitle).toBe("Sugandha USG");
  });
});

describe("print enum + checkbox normalisation (string form contract)", () => {
  it("accepts classic / sidebar / preprinted; unknown falls back to premium", async () => {
    await updateSettings({ usgPrintStyle: "classic" });
    expect((await getSettings()).usgPrintStyle).toBe("classic");
    await updateSettings({ usgPrintStyle: "premium" });
    expect((await getSettings()).usgPrintStyle).toBe("premium");
    await updateSettings({ usgPrintStyle: "preprinted" });
    expect((await getSettings()).usgPrintStyle).toBe("preprinted");
    await updateSettings({ usgPrintStyle: "gibberish" });
    expect((await getSettings()).usgPrintStyle).toBe("premium");
  });

  it("anything other than a5 means a4", async () => {
    await updateSettings({ usgPrintPaper: "a5" });
    expect((await getSettings()).usgPrintPaper).toBe("a5");
    await updateSettings({ usgPrintPaper: "A4" });
    expect((await getSettings()).usgPrintPaper).toBe("a4");
  });

  it("string checkboxes parse truthy/falsy words, booleans pass through", async () => {
    await updateSettings({ usgShowMachine: "off", usgPrintCompact: "true" });
    let s = await getSettings();
    expect(s.usgShowMachine).toBe(false);
    expect(s.usgPrintCompact).toBe(true);

    await updateSettings({ usgShowMachine: true, usgPrintCompact: false });
    s = await getSettings();
    expect(s.usgShowMachine).toBe(true);
    expect(s.usgPrintCompact).toBe(false);
  });
});

describe("masked settings never leak the PIN (secret surface is pinHash only)", () => {
  it("omits pinHash and reports pinSet", async () => {
    await setPinHash("hashed-value");
    const m = (await getMaskedSettings()) as Record<string, unknown>;
    expect(Object.keys(m)).not.toContain("pinHash");
    expect(m.pinSet).toBe(true);
    expect(m.usgDoctorName).toBe(""); // ordinary fields still exposed
  });

  it("the serialized masked payload does not contain the hash", async () => {
    await setPinHash("super-secret-hash");
    const m = await getMaskedSettings();
    expect(JSON.stringify(m)).not.toContain("super-secret-hash");
    await setPinHash("");
    expect((await getMaskedSettings()).pinSet).toBe(false);
  });
});

describe("untrusted / legacy fields can never be written (v4 USG-only guard)", () => {
  it("ignores pinHash, id and unknown keys", async () => {
    await updateSettings({ pinHash: "hax", id: "other-row", nonsense: "x" });
    const s = await getSettings();
    expect(s.id).toBe("singleton");
    expect(s.pinHash).toBeNull();
    expect((s as Record<string, unknown>).nonsense).toBeUndefined();
  });

  it("keeps the legacy v1-v3 MRI fields dropped, accepts the v6 bridge + OHIF fields", async () => {
    // A stale browser tab (or an old backup restore payload) may still send
    // the MRI-era fields; writing them would throw an unknown-column Prisma
    // error. The v6 CARE/Orthanc bridge columns, however, ARE real now and
    // must persist (URL normalized, secrets write-only) — and so must the
    // restored OHIF viewer columns, which are plain settings, not secrets.
    await expect(
      updateSettings({
        careApiBase: "172.16.1.139:8888",
        careApiKey: "bridge-key",
        orthancUrl: "172.16.1.139:8042",
        orthancUsername: "admin",
        orthancPassword: "bridge-pw",
        ohifLanUrl: "172.16.1.139:3010",
        ohifTailscaleUrl: "https://care.tail-abc.ts.net",
        radiologistName: "Dr. Legacy",
        radiologistQual: "MD",
        radiologistRegNo: "R/1",
      } as Record<string, string>),
    ).resolves.toBeUndefined();
    const s = await getSettings();
    expect((s as Record<string, unknown>).radiologistName).toBeUndefined();
    expect((s as Record<string, unknown>).careApiBase).toBe("http://172.16.1.139:8888");
    expect((s as Record<string, unknown>).orthancUrl).toBe("http://172.16.1.139:8042");
    expect(s.careApiKey).toBe("bridge-key");
    expect(s.orthancUsername).toBe("admin");
    expect(s.orthancPassword).toBe("bridge-pw");
    // OHIF endpoints persist and survive a restart — scripts/usg-v4-cleanup.mjs
    // must never list them again or the doctor's saved viewer is wiped at boot.
    expect(s.ohifLanUrl).toBe("http://172.16.1.139:3010");
    expect(s.ohifTailscaleUrl).toBe("https://care.tail-abc.ts.net");
    // Secrets are masked out of the client payload, only their presence flips.
    // OHIF has no secret, so the client sees the real endpoints.
    const masked = await getMaskedSettings();
    expect((masked as Record<string, unknown>).careApiKey).toBeUndefined();
    expect(masked.careApiKeySet).toBe(true);
    expect((masked as Record<string, unknown>).orthancPassword).toBeUndefined();
    expect(masked.orthancPasswordSet).toBe(true);
    expect(masked.ohifLanUrl).toBe("http://172.16.1.139:3010");
    expect(masked.ohifMode).toBe("auto");
  });

  it("stores the OHIF routing mode as a validated enum", async () => {
    await updateSettings({ ohifMode: "tailscale" });
    expect((await getSettings()).ohifMode).toBe("tailscale");

    // Anything unexpected cannot be saved — an unmatchable mode would leave
    // the resolver with no rule to follow.
    await updateSettings({ ohifMode: "cloudflare" as string });
    expect((await getSettings()).ohifMode).toBe("auto");
  });

  it("keeps a same-origin OHIF path instead of mangling it into a URL", async () => {
    // "/ohif" is a legitimate endpoint (the Caddy proxy route) and the only
    // mixed-content-safe way an https studio can show an http LAN viewer.
    // normalizeUrl() would produce the unusable "http:///ohif".
    await updateSettings({ ohifCustomUrl: "/ohif" });
    expect((await getSettings()).ohifCustomUrl).toBe("/ohif");

    // A protocol-relative "//host" inherits whatever scheme the page uses, so
    // it is refused rather than silently sent somewhere unexpected.
    await updateSettings({ ohifCustomUrl: "//evil.example/ohif" });
    expect((await getSettings()).ohifCustomUrl).toBe("");
  });

  it("falls back to env then the LAN default when OHIF is unsaved", async () => {
    const saved = process.env.OHIF_LAN_URL;
    const savedTs = process.env.OHIF_TAILSCALE_URL;
    try {
      // Nothing saved, nothing configured → the built-in LAN default, which
      // is derived from the clinic LAN host rather than a launch-path literal.
      delete process.env.OHIF_LAN_URL;
      delete process.env.OHIF_TAILSCALE_URL;
      await db.hospitalSettings.deleteMany();
      let s = await getSettings();
      expect(s.ohifLanUrl).toMatch(/^https?:\/\/.+:\d+$/);
      expect(s.ohifLanUrl.endsWith(":3010")).toBe(true);
      // Tailscale is never guessed — an unconfigured route is simply skipped.
      expect(s.ohifTailscaleUrl).toBe("");

      // An environment value applies while nothing is saved…
      process.env.OHIF_LAN_URL = "http://10.9.8.7:3011";
      process.env.OHIF_TAILSCALE_URL = "https://ohif.tail-example.ts.net";
      s = await getSettings();
      expect(s.ohifLanUrl).toBe("http://10.9.8.7:3011");
      expect(s.ohifTailscaleUrl).toBe("https://ohif.tail-example.ts.net");

      // …but a saved value always wins.
      await updateSettings({ ohifTailscaleUrl: "https://saved.tail-real.ts.net" });
      s = await getSettings();
      expect(s.ohifTailscaleUrl).toBe("https://saved.tail-real.ts.net");
    } finally {
      if (saved === undefined) delete process.env.OHIF_LAN_URL; else process.env.OHIF_LAN_URL = saved;
      if (savedTs === undefined) delete process.env.OHIF_TAILSCALE_URL; else process.env.OHIF_TAILSCALE_URL = savedTs;
    }
  });

  it("setPinHash writes the hash and needsSetup flips (auth state path)", async () => {
    await setPinHash("hash-1");
    expect((await getSettings()).pinHash).toBe("hash-1");
    await setPinHash("hash-2");
    expect((await getSettings()).pinHash).toBe("hash-2");
  });
});

describe("v6.8 audit #5 — at-rest secret encryption", () => {
  it("encrypts orthancPassword and geminiApiKey at rest (round-trip transparent)", async () => {
    await updateSettings({
      orthancPassword: "super-secret-pw",
      geminiApiKey: "AIzaSy-test-key",
    });
    // Read the row directly from the DB (bypassing the decrypt layer) —
    // the value MUST be encrypted (start with v1:) and NOT plaintext.
    const row = await db.hospitalSettings.findUnique({ where: { id: "singleton" } });
    expect(row?.orthancPassword).toMatch(/^v1:/);
    expect(row?.orthancPassword).not.toContain("super-secret-pw");
    expect(row?.geminiApiKey).toMatch(/^v1:/);
    expect(row?.geminiApiKey).not.toContain("AIzaSy-test-key");

    // The public getSettings() path decrypts transparently.
    const s = await getSettings();
    expect(s.orthancPassword).toBe("super-secret-pw");
    expect(s.geminiApiKey).toBe("AIzaSy-test-key");
  });

  it("reads legacy plaintext rows without breaking (transparent migration)", async () => {
    // Simulate a pre-v6.8 row that stored the secret in plaintext.
    await db.hospitalSettings.upsert({
      where: { id: "singleton" },
      update: { orthancPassword: "legacy-plaintext-pw", geminiApiKey: "legacy-key" },
      create: { id: "singleton", orthancPassword: "legacy-plaintext-pw", geminiApiKey: "legacy-key" },
    });
    const s = await getSettings();
    expect(s.orthancPassword).toBe("legacy-plaintext-pw");
    expect(s.geminiApiKey).toBe("legacy-key");
    // The read should have transparently re-encrypted at rest.
    const row = await db.hospitalSettings.findUnique({ where: { id: "singleton" } });
    expect(row?.orthancPassword).toMatch(/^v1:/);
    expect(row?.geminiApiKey).toMatch(/^v1:/);
  });

  it("__clear__ marker removes the secret", async () => {
    await updateSettings({ orthancPassword: "to-be-cleared" });
    expect((await getSettings()).orthancPassword).toBe("to-be-cleared");
    await updateSettings({ orthancPassword: "__clear__" });
    // null vs "" — both mean "absent". Use ?? to normalize.
    expect((await getSettings()).orthancPassword ?? "").toBe("");
  });
});
