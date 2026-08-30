import { db } from "@/lib/db";

export type HospitalSettingsRow = Awaited<ReturnType<typeof getSettings>>;

/**
 * Ship-with-defaults: the studio is an appliance for one clinic LAN, so
 * `git pull && docker compose up -d --build` on the Synology must come up
 * with working integrations — no manual Settings entry, even on a fresh
 * database. Resolution per integration field:
 *
 *   1. the value the doctor SAVED in Settings  (always wins)
 *   2. an override from the Synology .env      (docker-compose passes
 *      CARE_API_BASE / CARE_API_KEY / ORTHANC_* / OHIF_*_URL through)
 *   3. the clinic's built-in LAN default below
 *
 * Secrets are NEVER hardcoded — the API key arrives via CARE_API_KEY only.
 * Clearing a URL in the UI means "back to the default" (appliance
 * semantics); set INTEGRATION_DEFAULTS=off in .env to keep blanks blank.
 */
const LAN_DEFAULTS = {
  careApiBase: "http://172.16.1.139:8888", // CARE ERP  (care-api container)
  orthancUrl: "http://172.16.1.139:8042",  // Orthanc   (care-pacs compose)
  ohifLanUrl: "http://172.16.1.139:3010",  // OHIF      (care-pacs compose)
} as const;

/** Bare LAN addresses like 172.16.1.139:8888 are how humans type — make
 * them valid URLs by assuming plain http (the clinic LAN has no TLS).
 * Idempotent; empty stays empty; https:// is preserved. */
export function normalizeUrl(v: string): string {
  const t = v.trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `http://${t}`;
}

function envOverride(name: string): string {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : "";
}

/** Evaluated per call so tests (and .env edits) can flip it at runtime. */
function defaultsOff(): boolean {
  return /^(0|false|off|no)$/i.test(process.env.INTEGRATION_DEFAULTS ?? "");
}

/** saved value → env override → built-in LAN default. URL fields are
 * normalized (bare host:port healed); secrets never are — an API key like
 * "live-key-42" must NEVER become "http://live-key-42". */
function effective(saved: string, envName: string, fallback = "", isUrl = false): string {
  const fix = (v: string): string => (isUrl ? normalizeUrl(v) : v);
  // A saved bare host:port ("172.16.1.139:8888") is healed at READ time so
  // rows written by earlier versions keep working with no re-typing.
  if (saved.trim()) return fix(saved);
  if (defaultsOff()) return saved;
  return fix(envOverride(envName) || fallback);
}

/** Get (or lazily create) the singleton settings row, defaults applied. */
export async function getSettings() {
  let row = await db.hospitalSettings.findUnique({ where: { id: "singleton" } });
  if (!row) {
    row = await db.hospitalSettings.create({ data: { id: "singleton" } });
  }
  return {
    ...row,
    careApiBase: effective(row.careApiBase, "CARE_API_BASE", LAN_DEFAULTS.careApiBase, true),
    careApiKey: effective(row.careApiKey, "CARE_API_KEY"), // secret: env only, never a code default, NEVER normalized
    orthancUrl: effective(row.orthancUrl, "ORTHANC_URL", LAN_DEFAULTS.orthancUrl, true),
    orthancUsername: effective(row.orthancUsername, "ORTHANC_USERNAME"),
    // Passwords are stored verbatim — never trimmed, so keep the verbatim check.
    orthancPassword: row.orthancPassword || (defaultsOff() ? "" : envOverride("ORTHANC_PASSWORD")),
    ohifLanUrl: effective(row.ohifLanUrl, "OHIF_LAN_URL", LAN_DEFAULTS.ohifLanUrl, true),
    ohifTailscaleUrl: effective(row.ohifTailscaleUrl, "OHIF_TAILSCALE_URL", "", true), // optional — never guessed
  };
}

const SECRET_FIELDS = ["careApiKey", "orthancPassword", "pinHash"] as const;

export type MaskedSettings = Omit<HospitalSettingsRow, (typeof SECRET_FIELDS)[number]> & {
  careApiKeySet: boolean;
  orthancPasswordSet: boolean;
  pinSet: boolean;
};

/** Client-safe view: secrets never leave the server, only their presence. */
export async function getMaskedSettings(): Promise<MaskedSettings> {
  const s = await getSettings();
  const {
    careApiKey: _careApiKey, orthancPassword: _orthancPassword, pinHash: _pinHash,
    ...safe
  } = s;
  return {
    ...safe,
    careApiKeySet: !!s.careApiKey,
    orthancPasswordSet: !!s.orthancPassword,
    pinSet: !!s.pinHash,
  };
}

type SettingsUpdate = Partial<Record<string, string>>;

/** URL-valued settings fields — normalized on save so "172.16.1.139:8888"
 * is stored as "http://172.16.1.139:8888" (the doctor never types a scheme). */
const URL_FIELDS = new Set(["careApiBase", "orthancUrl", "ohifLanUrl", "ohifTailscaleUrl"]);

/** Apply a settings update. Empty-string secret fields = "keep existing". */
export async function updateSettings(patch: SettingsUpdate) {
  const allowed = [
    "appTitle", "hospitalName", "addressLine", "phone", "email", "footerMessage",
    "logoUrl", "radiologistName", "radiologistQual", "radiologistRegNo",
    "careApiBase", "careApiKey", "orthancUrl", "orthancUsername", "orthancPassword",
    "ohifLanUrl", "ohifTailscaleUrl", "loginTheme", "loginBgUrl",
    "usgDoctorName", "usgDoctorQual", "usgDoctorRegNo", "usgMachineLine",
    "usgFooterLine", "usgDeclarationLine",
  ];
  const data: Record<string, string | boolean> = {};
  for (const k of allowed) {
    const v = patch[k];
    if (typeof v !== "string") continue;
    if (k === "careApiKey") {
      // API keys are pasted from chat/notes — strip paste whitespace.
      if (v.trim() === "") continue; // blank = keep existing key
      data[k] = v.trim();
      continue;
    }
    if (k === "orthancPassword") {
      if (v === "") continue; // blank = keep existing password
      data[k] = v; // passwords stored verbatim (spaces may be intentional)
      continue;
    }
    // Ordinary fields (URLs, names…): trim so a pasted trailing space or
    // newline can never corrupt a URL, and empty string IS a valid update
    // (clearing a URL is allowed). URL fields additionally get http://
    // prepended when the scheme is missing.
    data[k] = URL_FIELDS.has(k) ? normalizeUrl(v) : v.trim();
  }
  // USG machine banner toggle arrives as a string checkbox value.
  if (typeof patch.usgShowMachine === "string") {
    data.usgShowMachine = !/^(0|false|off|no)$/i.test(patch.usgShowMachine.trim());
  } else if (typeof patch.usgShowMachine === "boolean") {
    data.usgShowMachine = patch.usgShowMachine;
  }
  await getSettings(); // ensure row exists
  await db.hospitalSettings.update({ where: { id: "singleton" }, data });
}

export async function setPinHash(hash: string) {
  await getSettings();
  await db.hospitalSettings.update({ where: { id: "singleton" }, data: { pinHash: hash } });
}
