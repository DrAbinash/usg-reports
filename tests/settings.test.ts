/**
 * Settings persistence tests — against a REAL Prisma client + scratch SQLite
 * database (created by tests/global-setup.ts). This is the exact save/load
 * path the doctor uses on the Synology:
 *
 *   enter CARE base / Orthanc URL / OHIF LAN URL → Save integrations
 *   → HospitalSettings row must contain those values,
 *   → blank secret inputs must keep the existing secrets,
 *   → ordinary fields must be freely clearable,
 *   → GET /api/settings (masked) must never leak secrets.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getMaskedSettings, getSettings, setPinHash, updateSettings } from "@/lib/settings";

beforeEach(async () => {
  // Clean slate: settings.ts lazily re-creates the singleton row.
  await db.hospitalSettings.deleteMany();
});

describe("integration URLs persist and reload exactly (Fix B)", () => {
  it("stores the Synology triple verbatim", async () => {
    await updateSettings({
      careApiBase: "http://172.16.1.139:8888",
      orthancUrl: "http://172.16.1.139:8042",
      ohifLanUrl: "http://172.16.1.139:3010",
      ohifTailscaleUrl: "https://care.tail-abc.ts.net",
      orthancUsername: "",
      orthancPassword: "",
    });

    const s = await getSettings();

    expect(s.careApiBase).toBe("http://172.16.1.139:8888");
    expect(s.orthancUrl).toBe("http://172.16.1.139:8042");
    expect(s.ohifLanUrl).toBe("http://172.16.1.139:3010");
    expect(s.ohifTailscaleUrl).toBe("https://care.tail-abc.ts.net");
    expect(s.orthancUsername).toBe("");
  });

  it("trims whitespace so a pasted URL can never be corrupted", async () => {
    await updateSettings({
      careApiBase: "  http://172.16.1.139:8888 \n",
      orthancUrl: "\thttp://172.16.1.139:8042 ",
    });
    const s = await getSettings();
    expect(s.careApiBase).toBe("http://172.16.1.139:8888");
    expect(s.orthancUrl).toBe("http://172.16.1.139:8042");
  });

  it("allows clearing an ordinary (non-secret) URL", async () => {
    await updateSettings({ ohifTailscaleUrl: "https://t.ts.net" });
    expect((await getSettings()).ohifTailscaleUrl).toBe("https://t.ts.net");

    await updateSettings({ ohifTailscaleUrl: "" });
    expect((await getSettings()).ohifTailscaleUrl).toBe("");
  });

  it("re-updates an ordinary URL to a new value", async () => {
    await updateSettings({ careApiBase: "http://172.16.1.139:8888" });
    await updateSettings({ careApiBase: "http://172.16.1.140:8888" });
    expect((await getSettings()).careApiBase).toBe("http://172.16.1.140:8888");
  });
});

describe("blank secret input keeps the existing secret (Fix B)", () => {
  it("keeps careApiKey and orthancPassword when blank strings are submitted", async () => {
    await updateSettings({ careApiKey: "  live-key-42  ", orthancPassword: "orthanc-secret" });

    // The form submits "" when the secret inputs are untouched:
    await updateSettings({ careApiKey: "", orthancPassword: "", careApiBase: "http://172.16.1.139:8888" });

    const s = await getSettings();
    expect(s.careApiKey).toBe("live-key-42"); // trimmed on save, then preserved
    expect(s.orthancPassword).toBe("orthanc-secret");
  });

  it("keeps secrets when the keys are absent from the patch entirely", async () => {
    await updateSettings({ careApiKey: "live-key-42", orthancPassword: "orthanc-secret" });
    await updateSettings({ appTitle: "CARE Reporting Studio" });
    const s = await getSettings();
    expect(s.careApiKey).toBe("live-key-42");
    expect(s.orthancPassword).toBe("orthanc-secret");
  });

  it("does not write careApiKey/orthancPassword when only whitespace is entered", async () => {
    await updateSettings({ careApiKey: "live-key-42" });
    await updateSettings({ careApiKey: "   " });
    expect((await getSettings()).careApiKey).toBe("live-key-42");
  });

  it("stores the API key trimmed (paste artifacts) but the password verbatim", async () => {
    await updateSettings({ careApiKey: "  abc123 \n" });
    await updateSettings({ orthancPassword: " leading-and-trailing " });
    const s = await getSettings();
    expect(s.careApiKey).toBe("abc123");
    expect(s.orthancPassword).toBe(" leading-and-trailing ");
  });
});

describe("masked settings never leak secrets (Fix B)", () => {
  it("omits careApiKey / orthancPassword / pinHash and reports presence flags", async () => {
    await updateSettings({ careApiKey: "super-secret-key", orthancPassword: "super-secret-pw" });

    const m = await getMaskedSettings();

    expect(Object.keys(m as object)).not.toContain("careApiKey");
    expect(Object.keys(m as object)).not.toContain("orthancPassword");
    expect(Object.keys(m as object)).not.toContain("pinHash");
    expect(m.careApiKeySet).toBe(true);
    expect(m.orthancPasswordSet).toBe(true);
    expect(m.pinSet).toBe(false); // no PIN yet
  });

  it("the serialized masked payload does not contain the secret values", async () => {
    await updateSettings({ careApiKey: "super-secret-key", orthancPassword: "super-secret-pw" });
    await setPinHash("salt:hash-of-pin");

    const serialized = JSON.stringify(await getMaskedSettings());

    expect(serialized).not.toContain("super-secret-key");
    expect(serialized).not.toContain("super-secret-pw");
    expect(serialized).not.toContain("salt:hash-of-pin");
    const m = await getMaskedSettings();
    expect(m.pinSet).toBe(true);
  });

  it("still exposes the integration URLs the form needs", async () => {
    await updateSettings({
      careApiBase: "http://172.16.1.139:8888",
      orthancUrl: "http://172.16.1.139:8042",
      ohifLanUrl: "http://172.16.1.139:3010",
    });
    const m = await getMaskedSettings();
    expect(m.careApiBase).toBe("http://172.16.1.139:8888");
    expect(m.orthancUrl).toBe("http://172.16.1.139:8042");
    expect(m.ohifLanUrl).toBe("http://172.16.1.139:3010");
  });
});

describe("untrusted fields can never be written through updateSettings", () => {
  it("ignores pinHash, id and unknown keys", async () => {
    await updateSettings({ pinHash: "evil", id: "other-row", nonsense: "x" } as Record<string, string>);
    const s = await getSettings();
    expect(s.id).toBe("singleton");
    expect(s.pinHash ?? null).toBeNull();
  });
});
