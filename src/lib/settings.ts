import { db } from "@/lib/db";
import { normalizeBirthday } from "@/lib/usg/birthday";

export type HospitalSettingsRow = Awaited<ReturnType<typeof getSettings>>;

/**
 * USG Studio settings — the singleton personalisation row.
 *
 * v6 adds the CARE ERP bridge + Orthanc PACS + Form F fixed details to what
 * was a fully standalone studio. Integration secrets (careApiKey,
 * orthancPassword, geminiApiKey) live ONLY here on the server and are
 * masked out of every client payload.
 */

/**
 * v6 ship-with-defaults: the studio is an appliance on one clinic LAN, so
 * `git pull && docker compose up -d --build` on the Synology must come up
 * with working integrations — no manual Settings entry, even on a fresh
 * database. Resolution per integration field:
 *
 *   1. the value the doctor SAVED in Settings  (always wins)
 *   2. an override from the Synology .env      (docker-compose passes
 *      CARE_API_BASE / CARE_API_KEY / ORTHANC_* through)
 *   3. the clinic's built-in LAN default below
 *
 * Secrets are NEVER hardcoded — the API key arrives via CARE_API_KEY only.
 * Set INTEGRATION_DEFAULTS=off in .env to keep blanks blank.
 */
const LAN_DEFAULTS = {
  careApiBase: "http://172.16.1.139:8888", // CARE ERP  (care-api container)
  orthancUrl: "http://172.16.1.139:8042",  // Orthanc   (care-pacs compose)
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
    careApiKey: effective(row.careApiKey ?? "", "CARE_API_KEY"), // secret: env only, never a code default, NEVER normalized
    orthancUrl: effective(row.orthancUrl, "ORTHANC_URL", LAN_DEFAULTS.orthancUrl, true),
    orthancUsername: effective(row.orthancUsername, "ORTHANC_USERNAME"),
    // Passwords are stored verbatim — never trimmed.
    orthancPassword: row.orthancPassword || (defaultsOff() ? "" : envOverride("ORTHANC_PASSWORD")) || null,
    geminiApiKey: row.geminiApiKey || (defaultsOff() ? "" : envOverride("GEMINI_API_KEY")) || null,
  };
}

const SECRET_FIELDS = ["pinHash", "careApiKey", "orthancPassword", "geminiApiKey"] as const;

export type MaskedSettings = Omit<HospitalSettingsRow, (typeof SECRET_FIELDS)[number]> & {
  pinSet: boolean;
  careApiKeySet: boolean;
  orthancPasswordSet: boolean;
  geminiApiKeySet: boolean;
};

/** Client-safe view: secrets never leave the server, only their presence. */
export async function getMaskedSettings(): Promise<MaskedSettings> {
  const s = await getSettings();
  const { pinHash: _pinHash, careApiKey: _careApiKey, orthancPassword: _orthancPassword, geminiApiKey: _geminiApiKey, ...safe } = s;
  return {
    ...safe,
    pinSet: !!s.pinHash,
    careApiKeySet: !!s.careApiKey,
    orthancPasswordSet: !!s.orthancPassword,
    geminiApiKeySet: !!s.geminiApiKey,
  };
}

type SettingsUpdate = Partial<Record<string, string | boolean>>;

/** Apply a settings update. */
export async function updateSettings(patch: SettingsUpdate) {
  const allowed = [
    "appTitle", "hospitalName", "addressLine", "phone", "email", "footerMessage",
    "logoUrl", "loginTheme", "loginBgUrl",
    "usgDoctorName", "usgDoctorQual", "usgDoctorRegNo", "usgMachineLine",
    "usgDoctorBirthday",
    "usgFooterLine", "usgDeclarationLine", "usgPrintStyle",
    "usgPrintPaper", "usgSignatureUrl",
    // v6 integrations (URLs only — keys go through SECRET_FIELDS below)
    "careApiBase", "orthancUrl", "orthancUsername",
    // v6 PC-PNDT Form F fixed details
    "pcpndtCentreName", "pcpndtRegistrationNo", "pcpndtPlace",
  ];
  const data: Record<string, string | boolean> = {};
  // URL-valued integration fields are normalized on save so "172.16.1.139:8888"
  // is stored as "http://172.16.1.139:8888" (the doctor never types a scheme).
  const URL_FIELDS = new Set(["careApiBase", "orthancUrl"]);
  // v6.1 — the birthday is canonicalised at write time: "7/9", "07-09" and
  // "07.09" all store as "09-01"-style "MM-DD"; anything unparseable stores
  // as "" (greeting off) instead of a value that silently never matches.
  const BIRTHDAY_FIELD = "usgDoctorBirthday";
  for (const k of allowed) {
    const v = patch[k];
    if (typeof v !== "string") continue;
    // Ordinary fields: trim so a pasted trailing space or newline can never
    // corrupt a stored value. An empty string IS a valid update (clearing).
    // Exception: the centre address keeps its interior line structure.
    const t = k === "pcpndtCentreName" ? v.replace(/^\s+|\s+$/g, "") : v.trim();
    if (k === BIRTHDAY_FIELD) {
      data[k] = normalizeBirthday(t);
      continue;
    }
    data[k] = URL_FIELDS.has(k) ? normalizeUrl(t) : t;
  }
  // USG machine banner toggle arrives as a string checkbox value.
  if (typeof patch.usgShowMachine === "string") {
    data.usgShowMachine = !/^(0|false|off|no)$/i.test(patch.usgShowMachine.trim());
  } else if (typeof patch.usgShowMachine === "boolean") {
    data.usgShowMachine = patch.usgShowMachine;
  }
  // Print style: anything other than "classic" means the premium letterhead.
  if (typeof patch.usgPrintStyle === "string") {
    data.usgPrintStyle = patch.usgPrintStyle.trim() === "classic" ? "classic" : "premium";
  }
  // Paper size: anything other than "a5" means A4.
  if (typeof patch.usgPrintPaper === "string") {
    data.usgPrintPaper = patch.usgPrintPaper.trim() === "a5" ? "a5" : "a4";
  }
  // Compact print density toggle (same string-checkbox contract).
  if (typeof patch.usgPrintCompact === "string") {
    data.usgPrintCompact = !/^(0|false|off|no)$/i.test(patch.usgPrintCompact.trim());
  } else if (typeof patch.usgPrintCompact === "boolean") {
    data.usgPrintCompact = patch.usgPrintCompact;
  }
  // Nightly full-clinic backup toggle (v5).
  if (typeof patch.usgAutoBackup === "string") {
    data.usgAutoBackup = !/^(0|false|off|no)$/i.test(patch.usgAutoBackup.trim());
  } else if (typeof patch.usgAutoBackup === "boolean") {
    data.usgAutoBackup = patch.usgAutoBackup;
  }
  // v6 integration secrets — write-only from the client. An empty string is
  // IGNORED (never clears an existing key by accident); the literal "__clear__"
  // marker removes it so Settings can offer a reset.
  for (const k of SECRET_FIELDS) {
    if (k === "pinHash") continue; // PIN has its own dedicated flow
    const v = patch[k];
    if (typeof v !== "string") continue;
    const trimmed = v.trim();
    if (trimmed === "") continue;
    if (trimmed === "__clear__") { (data as Record<string, string | boolean>)[k] = ""; continue; }
    (data as Record<string, string | boolean>)[k] = trimmed;
  }
  await getSettings(); // ensure row exists
  await db.hospitalSettings.update({ where: { id: "singleton" }, data });
}

export async function setPinHash(hash: string) {
  await getSettings();
  await db.hospitalSettings.update({ where: { id: "singleton" }, data: { pinHash: hash } });
}
