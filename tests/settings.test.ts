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
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

describe("ship-with-defaults: git pull → integrations preconfigured", () => {
  const ENV_KEYS = [
    "CARE_API_BASE", "CARE_API_KEY", "ORTHANC_URL", "ORTHANC_USERNAME",
    "ORTHANC_PASSWORD", "OHIF_LAN_URL", "OHIF_TAILSCALE_URL", "INTEGRATION_DEFAULTS",
  ] as const;
  let savedEnv: Record<string, string | undefined>;

  beforeEach(async () => {
    savedEnv = {};
    for (const k of ENV_KEYS) { savedEnv[k] = process.env[k]; delete process.env[k]; }
    await db.hospitalSettings.deleteMany();
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  });

  it("a fresh database opens with the clinic LAN defaults", async () => {
    const s = await getSettings();
    expect(s.careApiBase).toBe("http://172.16.1.139:8888");
    expect(s.orthancUrl).toBe("http://172.16.1.139:8042");
    expect(s.ohifLanUrl).toBe("http://172.16.1.139:3010");
    expect(s.orthancUsername).toBe("");   // this Orthanc has no auth
    expect(s.orthancPassword).toBe("");
    expect(s.ohifTailscaleUrl).toBe("");  // optional — never guessed
  });

  it("the API key comes from CARE_API_KEY (never hardcoded, still masked)", async () => {
    process.env.CARE_API_KEY = "env-key-from-dotenv";
    const s = await getSettings();
    expect(s.careApiKey).toBe("env-key-from-dotenv");
    const m = await getMaskedSettings();
    expect(m.careApiKeySet).toBe(true);
    expect(JSON.stringify(m)).not.toContain("env-key-from-dotenv");
  });

  it("a value the doctor SAVED always beats env and defaults", async () => {
    process.env.CARE_API_BASE = "http://env-should-lose:9999";
    await updateSettings({ careApiBase: "http://172.16.1.139:8888" });
    expect((await getSettings()).careApiBase).toBe("http://172.16.1.139:8888");
  });

  it("a saved API key beats CARE_API_KEY from the environment", async () => {
    process.env.CARE_API_KEY = "env-key";
    await updateSettings({ careApiKey: "saved-key" });
    expect((await getSettings()).careApiKey).toBe("saved-key");
  });

  it("env overrides beat the built-in LAN defaults", async () => {
    process.env.ORTHANC_URL = "http://172.16.1.140:8042";
    process.env.OHIF_TAILSCALE_URL = "https://care.tail-x.ts.net";
    const s = await getSettings();
    expect(s.orthancUrl).toBe("http://172.16.1.140:8042");
    expect(s.ohifTailscaleUrl).toBe("https://care.tail-x.ts.net");
  });

  it("clearing a URL reverts to the default (appliance semantics)", async () => {
    await updateSettings({ careApiBase: "http://elsewhere:8888" });
    expect((await getSettings()).careApiBase).toBe("http://elsewhere:8888");
    await updateSettings({ careApiBase: "" });
    expect((await getSettings()).careApiBase).toBe("http://172.16.1.139:8888");
  });

  it("INTEGRATION_DEFAULTS=off keeps cleared fields blank (read per call)", async () => {
    await updateSettings({ careApiBase: "http://temp:8888" });
    await updateSettings({ careApiBase: "" });
    expect((await getSettings()).careApiBase).toBe("http://172.16.1.139:8888");
    process.env.INTEGRATION_DEFAULTS = "off";
    expect((await getSettings()).careApiBase).toBe("");
    delete process.env.INTEGRATION_DEFAULTS;
    expect((await getSettings()).careApiBase).toBe("http://172.16.1.139:8888");
  });
});

describe("URL normalization — the doctor types 172.16.1.139:8888, we make it a URL", () => {
  const ENV_KEYS = [
    "CARE_API_BASE", "CARE_API_KEY", "ORTHANC_URL", "ORTHANC_USERNAME",
    "ORTHANC_PASSWORD", "OHIF_LAN_URL", "OHIF_TAILSCALE_URL", "INTEGRATION_DEFAULTS",
  ] as const;
  let savedEnv: Record<string, string | undefined>;

  beforeEach(async () => {
    savedEnv = {};
    for (const k of ENV_KEYS) { savedEnv[k] = process.env[k]; delete process.env[k]; }
    await db.hospitalSettings.deleteMany();
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  });

  it("saves a bare host:port with http:// prepended (all three integrations)", async () => {
    await updateSettings({
      careApiBase: " 172.16.1.139:8888 ",
      orthancUrl: "172.16.1.139:8042",
      ohifLanUrl: "172.16.1.139:3010",
      ohifTailscaleUrl: "100.101.102.103:80",
    });
    const s = await getSettings();
    expect(s.careApiBase).toBe("http://172.16.1.139:8888");
    expect(s.orthancUrl).toBe("http://172.16.1.139:8042");
    expect(s.ohifLanUrl).toBe("http://172.16.1.139:3010");
    expect(s.ohifTailscaleUrl).toBe("http://100.101.102.103:80");
  });

  it("heals LEGACY scheme-less rows at read time — no re-typing, no re-save", async () => {
    // Simulate the exact production row: values saved by the earlier build
    // without a scheme (the reported "save integration is not working" state).
    await db.hospitalSettings.create({
      data: {
        id: "singleton",
        careApiBase: "172.16.1.139:8888",
        orthancUrl: "172.16.1.139:8042",
        ohifLanUrl: "172.16.1.139:3010",
      },
    });
    const s = await getSettings();
    expect(s.careApiBase).toBe("http://172.16.1.139:8888");
    expect(s.orthancUrl).toBe("http://172.16.1.139:8042");
    expect(s.ohifLanUrl).toBe("http://172.16.1.139:3010");
    // The masked API the Settings form reads shows the healed URLs too:
    const m = await getMaskedSettings();
    expect(m.careApiBase).toBe("http://172.16.1.139:8888");
  });

  it("preserves https:// and keeps empty clearable (reverts to default)", async () => {
    await updateSettings({ careApiBase: "https://caredeoghar.com" });
    expect((await getSettings()).careApiBase).toBe("https://caredeoghar.com");
    await updateSettings({ careApiBase: "" });
    expect((await getSettings()).careApiBase).toBe("http://172.16.1.139:8888");
  });

  it("normalizes scheme-less env overrides as well", async () => {
    process.env.ORTHANC_URL = "172.16.1.140:8042";
    const s = await getSettings();
    expect(s.orthancUrl).toBe("http://172.16.1.140:8042");
  });

  it("NEVER normalizes the API key — a key is not a URL (regression guard)", async () => {
    await updateSettings({ careApiKey: "e46eea8477770ee979324824ea4af992359eef50b29ed7c8" });
    expect((await getSettings()).careApiKey).toBe("e46eea8477770ee979324824ea4af992359eef50b29ed7c8");
    process.env.CARE_API_KEY = "env-key-no-scheme";
    await db.hospitalSettings.deleteMany();
    expect((await getSettings()).careApiKey).toBe("env-key-no-scheme");
  });

  it("is idempotent — an already-correct URL round-trips unchanged", async () => {
    await updateSettings({ orthancUrl: "http://172.16.1.139:8042" });
    await updateSettings({ orthancUrl: " http://172.16.1.139:8042 " });
    expect((await getSettings()).orthancUrl).toBe("http://172.16.1.139:8042");
  });
});
