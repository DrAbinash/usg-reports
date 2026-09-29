import { db } from "@/lib/db";
import { normalizeBirthday } from "@/lib/usg/birthday";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "@/lib/secretCrypto";
import { getActiveClinicId } from "@/lib/auth";
import { ensureDefaultClinic } from "@/lib/clinic";
import { normalizeWhatsappRouting } from "@/lib/usg/secureShare";

export type HospitalSettingsRow = Awaited<ReturnType<typeof getSettings>>;

function parseStringRecord(raw: unknown): Record<string, string> {
  if (!raw) return {};
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof k === "string" && k && typeof v === "string" && v.trim()) {
      out[k] = v.trim();
    }
  }
  return out;
}

function serializeStringRecord(map: Record<string, string> | undefined | null): string {
  if (!map || typeof map !== "object") return "{}";
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) {
    if (typeof k === "string" && k && typeof v === "string" && v.trim()) {
      clean[k] = v.trim();
    }
  }
  return JSON.stringify(clean);
}

export type UsgSettingsExtras = {
  studyTechniqueDefaults: Record<string, string>;
  machineLineByStudio: Record<string, string>;
  /** Settings key `usg_billing_procedure_map` — procedure name → study type. */
  usgBillingProcedureMap: Record<string, string>;
};

/** Parse the P2b JSON maps from a settings row (DB or masked client payload). */
export function readSettingsMaps(row: {
  studyTechniqueDefaultsJson?: string | null;
  machineLineByStudioJson?: string | null;
  usgBillingProcedureMapJson?: string | null;
  studyTechniqueDefaults?: Record<string, string> | null;
  machineLineByStudio?: Record<string, string> | null;
  usgBillingProcedureMap?: Record<string, string> | null;
}): UsgSettingsExtras {
  return {
    studyTechniqueDefaults:
      row.studyTechniqueDefaults && typeof row.studyTechniqueDefaults === "object"
        ? parseStringRecord(row.studyTechniqueDefaults)
        : parseStringRecord(row.studyTechniqueDefaultsJson),
    machineLineByStudio:
      row.machineLineByStudio && typeof row.machineLineByStudio === "object"
        ? parseStringRecord(row.machineLineByStudio)
        : parseStringRecord(row.machineLineByStudioJson),
    usgBillingProcedureMap:
      row.usgBillingProcedureMap && typeof row.usgBillingProcedureMap === "object"
        ? parseStringRecord(row.usgBillingProcedureMap)
        : parseStringRecord(row.usgBillingProcedureMapJson),
  };
}

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
 *
 * v6.8: the LAN host (was hardcoded `172.16.1.139`) is now read from
 * CLINIC_LAN_HOST so a redeploy to a different clinic doesn't silently
 * point at the wrong server. The default keeps the original clinic's IP
 * so existing deploys stay working.
 */
const CLINIC_LAN_HOST = (() => {
  const v = (process.env.CLINIC_LAN_HOST ?? "").trim();
  return v || "172.16.1.139";
})();

const LAN_DEFAULTS = {
  careApiBase: `http://${CLINIC_LAN_HOST}:8888`, // CARE ERP  (care-api container)
  orthancUrl: `http://${CLINIC_LAN_HOST}:8042`,  // Orthanc   (care-pacs compose)
  ohifLanUrl: `http://${CLINIC_LAN_HOST}:3010`,  // OHIF      (care-pacs compose)
} as const;

/** Bare LAN addresses like 172.16.1.139:8888 are how humans type — make
 * them valid URLs by assuming plain http (the clinic LAN has no TLS).
 * Idempotent; empty stays empty; https:// is preserved. */
export function normalizeUrl(v: string): string {
  const t = v.trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `http://${t}`;
}

// ── OHIF viewer endpoints ─────────────────────────────────────────────
// The OHIF resolver is the only thing in the app that decides where a study
// is opened, so these fields accept more than normalizeUrl() does:
// a SAME-ORIGIN path ("/ohif") is a legitimate endpoint — it is how an https
// studio reaches an http-only LAN viewer without the browser blocking the
// iframe as mixed active content. normalizeUrl() would mangle that into
// "http:///ohif", so OHIF gets its own normaliser.

export const OHIF_MODES = ["auto", "lan", "tailscale", "custom"] as const;
export type OhifMode = (typeof OHIF_MODES)[number];

/** auto | lan | tailscale | custom — anything unexpected falls back to auto. */
export function normalizeOhifMode(v: string): OhifMode {
  const t = v.trim().toLowerCase();
  return (OHIF_MODES as readonly string[]).includes(t) ? (t as OhifMode) : "auto";
}

/** Absolute http(s) URL kept; "/ohif" kept as a same-origin path; a bare
 * host[:port] healed to http://; protocol-relative "//host" refused (it
 * inherits whatever scheme the page happens to use, so it is never a safe
 * default) and blanked so the candidate is simply skipped. */
export function normalizeOhifEndpoint(v: string): string {
  const t = v.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith("//")) return "";
  if (t.startsWith("/")) return t;
  return `http://${t}`;
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

/** Same precedence as effective() (saved → env → built-in default) but with
 * the OHIF normaliser, which — unlike normalizeUrl() — accepts a same-origin
 * path like "/ohif" instead of mangling it into "http:///ohif". */
function effectiveOhif(saved: string, envName: string, fallback = ""): string {
  const fix = normalizeOhifEndpoint;
  if (saved.trim()) return fix(saved);
  if (defaultsOff()) return "";
  return fix(envOverride(envName) || fallback);
}

/** Settings for the OHIF launch resolver. ohifMode: saved → OHIF_MODE → auto. */
function effectiveOhifMode(saved: string): OhifMode {
  const v = saved.trim() || envOverride("OHIF_MODE") || (defaultsOff() ? "" : "auto");
  return normalizeOhifMode(v || "auto");
}

/** Get (or lazily create) the singleton settings row, defaults applied.
 *
 *  v6.8 — `orthancPassword` and `geminiApiKey` are now AES-256-GCM
 *  encrypted at rest (audit #5). On read we decrypt transparently; rows
 *  written before this code shipped (plaintext) are read verbatim and
 *  get re-encrypted on the next save. careApiKey and pinHash stay
 *  plaintext — careApiKey is env-only (never written from the client),
 *  pinHash is already a bcrypt digest (one-way). */
export async function getSettings() {
  // v6.10 — settings are per-clinic. The active clinic comes from the
  // clinic-switcher cookie (defaults to "default"). The original install's
  // "singleton" row stays as the default clinic's settings (id="default"
  // would also work — but we keep "singleton" as the id for backward
  // compat with existing DB rows; the clinicId column carries the link).
  const clinicId = await getActiveClinicId();
  // For the default clinic, use the legacy "singleton" row id (so
  // existing installs keep working without a data migration). For new
  // clinics, the row id = clinicId.
  const settingsId = clinicId === "default" ? "singleton" : clinicId;
  // Ensure the default clinic row exists (first boot).
  if (clinicId === "default") await ensureDefaultClinic().catch(() => {});
  let row = await db.hospitalSettings.findUnique({ where: { id: settingsId } });
  if (!row) {
    row = await db.hospitalSettings.create({ data: { id: settingsId, clinicId } });
  }
  // Transparent migration: if either secret is still legacy plaintext,
  // re-encrypt it now so the row is at-rest-encrypted within one read.
  // The decrypt below still returns the plaintext value either way.
  await migrateLegacySecrets(row).catch(() => {
    // Migration failure must NEVER break a read — the doctor still needs
    // to use the studio. The next save will retry.
  });
  return {
    ...row,
    careApiBase: effective(row.careApiBase, "CARE_API_BASE", LAN_DEFAULTS.careApiBase, true),
    careApiKey: effective(row.careApiKey ?? "", "CARE_API_KEY"), // secret: env only, never a code default, NEVER normalized
    orthancUrl: effective(row.orthancUrl, "ORTHANC_URL", LAN_DEFAULTS.orthancUrl, true),
    orthancUsername: effective(row.orthancUsername, "ORTHANC_USERNAME"),
    // Passwords decrypt on read; legacy plaintext falls through transparently.
    orthancPassword: decryptSecret(row.orthancPassword) || (defaultsOff() ? "" : envOverride("ORTHANC_PASSWORD")) || null,
    // OHIF viewer — the single configuration source for every viewer launch
    // (see src/lib/usg/ohifResolver.ts). LAN ships a default so the studio
    // works on a fresh DB; Tailscale/custom are NEVER guessed (custom may be
    // a same-origin path such as "/ohif").
    ohifMode: effectiveOhifMode(row.ohifMode ?? ""),
    ohifLanUrl: effectiveOhif(row.ohifLanUrl ?? "", "OHIF_LAN_URL", LAN_DEFAULTS.ohifLanUrl),
    ohifTailscaleUrl: effectiveOhif(row.ohifTailscaleUrl ?? "", "OHIF_TAILSCALE_URL"),
    ohifCustomUrl: effectiveOhif(row.ohifCustomUrl ?? "", "OHIF_CUSTOM_URL"),
    geminiApiKey: decryptSecret(row.geminiApiKey) || (defaultsOff() ? "" : envOverride("GEMINI_API_KEY")) || null,
    ...readSettingsMaps(row as {
      studyTechniqueDefaultsJson?: string | null;
      machineLineByStudioJson?: string | null;
      usgBillingProcedureMapJson?: string | null;
    }),
  };
}

/** Re-encrypt the two at-rest secrets if they are still stored as legacy
 *  plaintext. Idempotent — already-encrypted rows are left alone. */
async function migrateLegacySecrets(row: { id: string; orthancPassword: string | null; geminiApiKey: string | null }) {
  const data: Record<string, string | null> = {};
  if (row.orthancPassword && !isEncryptedSecret(row.orthancPassword)) {
    data.orthancPassword = encryptSecret(row.orthancPassword);
  }
  if (row.geminiApiKey && !isEncryptedSecret(row.geminiApiKey)) {
    data.geminiApiKey = encryptSecret(row.geminiApiKey);
  }
  if (Object.keys(data).length === 0) return;
  await db.hospitalSettings.update({ where: { id: row.id }, data });
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

type SettingsUpdate = Partial<Record<string, string | boolean | number | Record<string, string>>>;

/** Apply a settings update. */
export async function updateSettings(patch: SettingsUpdate) {
  const allowed = [
    "appTitle", "hospitalName", "addressLine", "phone", "email", "footerMessage",
    "logoUrl", "registrationNo", "loginTheme", "loginBgUrl",
    "usgDoctorName", "usgDoctorQual", "usgDoctorRegNo", "usgMachineLine",
    "usgDoctorBirthday",
    "usgFooterLine", "usgDeclarationLine", "usgPrintStyle",
    "usgPrintPaper", "usgPrintBodyFit", "usgSignatureUrl", "usgPrintSpacing",
    "usgSidebarPosition", "usgLogoPosition", "usgAddressPosition", "usgPrintFontFamily",
    // v6 integrations (URLs only — keys go through SECRET_FIELDS below)
    "careApiBase", "orthancUrl", "orthancUsername",
    // OHIF viewer integration (routing mode + endpoints; no secrets)
    "ohifMode", "ohifLanUrl", "ohifTailscaleUrl", "ohifCustomUrl",
    // v6 PC-PNDT Form F fixed details
    "pcpndtCentreName", "pcpndtRegistrationNo", "pcpndtPlace",
    "usgFormFEnabled",
    // v6.10 feature toggles (per-clinic) — handled as string-checkboxes below.
    "enableCriticalComm", "enableFollowUps", "enableAiDraft", "enableBirads", "enableDicomSr",
    "whatsappRouting",
  ];
  const data: Record<string, string | number | boolean> = {};
  // URL-valued integration fields are normalized on save so "172.16.1.139:8888"
  // is stored as "http://172.16.1.139:8888" (the doctor never types a scheme).
  const URL_FIELDS = new Set(["careApiBase", "orthancUrl"]);
  // OHIF endpoint fields heal a bare "host:port" the same way, but a
  // same-origin path ("/ohif") must be stored verbatim — normalizeUrl() would
  // turn it into the unusable "http:///ohif".
  const OHIF_ENDPOINT_FIELDS = new Set(["ohifLanUrl", "ohifTailscaleUrl", "ohifCustomUrl"]);
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
    data[k] = URL_FIELDS.has(k)
      ? normalizeUrl(t)
      : OHIF_ENDPOINT_FIELDS.has(k)
        ? normalizeOhifEndpoint(t)
        : t;
  }
  // OHIF routing mode is an enum — an unexpected value stores as "auto"
  // rather than a string the resolver would never match.
  if (typeof patch.ohifMode === "string") {
    data.ohifMode = normalizeOhifMode(patch.ohifMode);
  }
  // USG machine banner toggle arrives as a string checkbox value.
  if (typeof patch.usgShowMachine === "string") {
    data.usgShowMachine = !/^(0|false|off|no)$/i.test(patch.usgShowMachine.trim());
  } else if (typeof patch.usgShowMachine === "boolean") {
    data.usgShowMachine = patch.usgShowMachine;
  }
  // Print style: "classic" | "premium" | "premium_sidebar" | "preprinted"
  if (typeof patch.usgPrintStyle === "string") {
    const style = patch.usgPrintStyle.trim();
    data.usgPrintStyle = (["classic", "premium_sidebar", "couture", "preprinted"].includes(style))
      ? style
      : "premium";
  }
  // v6.7 sidebar layout settings
  if (typeof patch.usgSidebarPosition === "string") {
    data.usgSidebarPosition = patch.usgSidebarPosition.trim() === "left" ? "left" : "right";
  }
  if (typeof patch.usgLogoPosition === "string") {
    const pos = patch.usgLogoPosition.trim();
    data.usgLogoPosition = (pos === "right" || pos === "center") ? pos : "left";
  }
  if (typeof patch.usgAddressPosition === "string") {
    const pos = patch.usgAddressPosition.trim();
    data.usgAddressPosition = (pos === "left" || pos === "center") ? pos : "right";
  }
  if (typeof patch.usgPrintFontFamily === "string") {
    const fam = patch.usgPrintFontFamily.trim();
    data.usgPrintFontFamily = (fam === "serif" || fam === "system") ? fam : "sans-serif";
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
  // Clinical-body fit: one_page (default) | multi.
  if (typeof patch.usgPrintBodyFit === "string") {
    data.usgPrintBodyFit = patch.usgPrintBodyFit.trim() === "multi" ? "multi" : "one_page";
  }
  // v6.2 print fine-tuning — the numeric dials arrive as strings from the
  // sliders and are clamped so a stray value can never wreck the letterhead.
  // Garbage falls back to the shipped defaults (10pt · 1.4).
  if (patch.usgPrintFontSize != null) {
    const n = Number(patch.usgPrintFontSize);
    data.usgPrintFontSize = Number.isFinite(n) ? Math.min(13, Math.max(8.5, n)) : 10;
  }
  if (patch.usgPrintLineHeight != null) {
    const n = Number(patch.usgPrintLineHeight);
    data.usgPrintLineHeight = Number.isFinite(n) ? Math.min(1.9, Math.max(1.15, n)) : 1.4;
  }
  // v6.20 Print Layout Studio size dials
  if (patch.usgLogoSizeMm != null) {
    const n = Number(patch.usgLogoSizeMm);
    data.usgLogoSizeMm = Number.isFinite(n) ? Math.min(30, Math.max(8, n)) : 14;
  }
  if (patch.usgNameSizePt != null) {
    const n = Number(patch.usgNameSizePt);
    data.usgNameSizePt = Number.isFinite(n) ? Math.min(22, Math.max(10, n)) : 15;
  }
  if (patch.usgAddressSizePt != null) {
    const n = Number(patch.usgAddressSizePt);
    data.usgAddressSizePt = Number.isFinite(n) ? Math.min(12, Math.max(6, n)) : 8.5;
  }
  if (patch.usgSignatureSizeMm != null) {
    const n = Number(patch.usgSignatureSizeMm);
    data.usgSignatureSizeMm = Number.isFinite(n) ? Math.min(40, Math.max(12, n)) : 26;
  }
  // Section spacing preset: anything unexpected falls back to "normal".
  if (typeof patch.usgPrintSpacing === "string") {
    data.usgPrintSpacing = ["tight", "normal", "relaxed"].includes(patch.usgPrintSpacing.trim())
      ? patch.usgPrintSpacing.trim()
      : "normal";
  }
  // Technique band + referral tagline toggles (string-checkbox contract).
  for (const k of ["usgPrintShowTechnique", "usgPrintShowThanks"] as const) {
    const v = patch[k];
    if (typeof v === "string") {
      data[k] = !/^(0|false|off|no)$/i.test(v.trim());
    } else if (typeof v === "boolean") {
      data[k] = v;
    }
  }
  // Nightly full-clinic backup toggle (v5).
  if (typeof patch.usgAutoBackup === "string") {
    data.usgAutoBackup = !/^(0|false|off|no)$/i.test(patch.usgAutoBackup.trim());
  } else if (typeof patch.usgAutoBackup === "boolean") {
    data.usgAutoBackup = patch.usgAutoBackup;
  }
  // v6.10 feature toggles — per-clinic, all default to true (opt-out).
  // Same string-checkbox contract as the other toggles.
  for (const k of ["enableCriticalComm", "enableFollowUps", "enableAiDraft", "enableBirads", "enableDicomSr", "usgFormFEnabled"] as const) {
    const v = patch[k];
    if (typeof v === "string") {
      data[k] = !/^(0|false|off|no)$/i.test(v.trim());
    } else if (typeof v === "boolean") {
      data[k] = v;
    }
  }
  // WhatsApp secure-share routing preference.
  if (typeof patch.whatsappRouting === "string") {
    data.whatsappRouting = normalizeWhatsappRouting(patch.whatsappRouting.trim());
  }
  // v6 integration secrets — write-only from the client. An empty string is
  // IGNORED (never clears an existing key by accident); the literal "__clear__"
  // marker removes it so Settings can offer a reset.
  // careApiKey + pinHash: stored verbatim (careApiKey is env-only, pinHash is a
  //   one-way bcrypt digest). orthancPassword + geminiApiKey: AES-256-GCM
  //   encrypted at rest (audit #5).
  for (const k of SECRET_FIELDS) {
    if (k === "pinHash") continue; // PIN has its own dedicated flow
    const v = patch[k];
    if (typeof v !== "string") continue;
    const trimmed = v.trim();
    if (trimmed === "") continue;
    if (trimmed === "__clear__") { data[k] = ""; continue; }
    if (k === "orthancPassword" || k === "geminiApiKey") {
      data[k] = encryptSecret(trimmed);
    } else {
      data[k] = trimmed;
    }
  }
  // P2b — study technique defaults + per-studio machine lines (JSON maps).
  if (patch.studyTechniqueDefaults != null) {
    const raw = patch.studyTechniqueDefaults;
    if (typeof raw === "string") {
      data.studyTechniqueDefaultsJson = serializeStringRecord(parseStringRecord(raw));
    } else if (typeof raw === "object") {
      data.studyTechniqueDefaultsJson = serializeStringRecord(raw as Record<string, string>);
    }
  }
  if (patch.machineLineByStudio != null) {
    const raw = patch.machineLineByStudio;
    if (typeof raw === "string") {
      data.machineLineByStudioJson = serializeStringRecord(parseStringRecord(raw));
    } else if (typeof raw === "object") {
      data.machineLineByStudioJson = serializeStringRecord(raw as Record<string, string>);
    }
  }
  if (typeof patch.studyTechniqueDefaultsJson === "string") {
    data.studyTechniqueDefaultsJson = serializeStringRecord(parseStringRecord(patch.studyTechniqueDefaultsJson));
  }
  if (typeof patch.machineLineByStudioJson === "string") {
    data.machineLineByStudioJson = serializeStringRecord(parseStringRecord(patch.machineLineByStudioJson));
  }
  // Billing procedure → study-type map (`usg_billing_procedure_map`).
  if (patch.usgBillingProcedureMap != null || patch.usg_billing_procedure_map != null) {
    const raw = patch.usgBillingProcedureMap ?? patch.usg_billing_procedure_map;
    if (typeof raw === "string") {
      data.usgBillingProcedureMapJson = serializeStringRecord(parseStringRecord(raw));
    } else if (typeof raw === "object") {
      data.usgBillingProcedureMapJson = serializeStringRecord(raw as Record<string, string>);
    }
  }
  if (typeof patch.usgBillingProcedureMapJson === "string") {
    data.usgBillingProcedureMapJson = serializeStringRecord(parseStringRecord(patch.usgBillingProcedureMapJson));
  }

  await getSettings(); // ensure row exists (creates if missing)
  const clinicId = await getActiveClinicId();
  const settingsId = clinicId === "default" ? "singleton" : clinicId;
  await db.hospitalSettings.update({ where: { id: settingsId }, data });
}

export async function setPinHash(hash: string) {
  await getSettings();
  const clinicId = await getActiveClinicId();
  const settingsId = clinicId === "default" ? "singleton" : clinicId;
  await db.hospitalSettings.update({ where: { id: settingsId }, data: { pinHash: hash } });
}
