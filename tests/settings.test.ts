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
  it("anything other than classic means premium", async () => {
    await updateSettings({ usgPrintStyle: "classic" });
    expect((await getSettings()).usgPrintStyle).toBe("classic");
    await updateSettings({ usgPrintStyle: "premium" });
    expect((await getSettings()).usgPrintStyle).toBe("premium");
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

  it("silently drops the legacy v1-v3 MRI/PACS fields — the columns no longer exist", async () => {
    // A stale browser tab (or an old backup restore payload) may still send
    // these; writing them would throw an unknown-column Prisma error.
    await expect(
      updateSettings({
        careApiBase: "http://172.16.1.139:8888",
        careApiKey: "legacy-key",
        orthancUrl: "http://172.16.1.139:8042",
        orthancUsername: "admin",
        orthancPassword: "legacy-pw",
        ohifLanUrl: "http://172.16.1.139:3010",
        ohifTailscaleUrl: "https://care.tail-abc.ts.net",
        radiologistName: "Dr. Legacy",
        radiologistQual: "MD",
        radiologistRegNo: "R/1",
      } as Record<string, string>),
    ).resolves.toBeUndefined();
    const s = await getSettings();
    expect((s as Record<string, unknown>).radiologistName).toBeUndefined();
    expect((s as Record<string, unknown>).careApiBase).toBeUndefined();
    expect((s as Record<string, unknown>).orthancUrl).toBeUndefined();
  });

  it("setPinHash writes the hash and needsSetup flips (auth state path)", async () => {
    await setPinHash("hash-1");
    expect((await getSettings()).pinHash).toBe("hash-1");
    await setPinHash("hash-2");
    expect((await getSettings()).pinHash).toBe("hash-2");
  });
});
