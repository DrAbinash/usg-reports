/**
 * USG Studio — one-file backup & restore of the studio personalisation.
 *
 * Everything that makes the studio HERS travels in a single JSON file:
 * the letterhead/identity settings plus every custom quick-select finding
 * she added to the pathology library. Patient reports are clinical records,
 * not personalisation, and secrets (PIN, integration credentials) never
 * leave the server — they are structurally excluded from the payload.
 */

/** Settings fields included in a backup (printable identity + USG studio). */
export const BACKUP_SETTINGS_KEYS = [
  "appTitle",
  "hospitalName",
  "addressLine",
  "phone",
  "email",
  "footerMessage",
  "logoUrl",
  "usgDoctorName",
  "usgDoctorQual",
  "usgDoctorRegNo",
  "usgMachineLine",
  "usgShowMachine",
  "usgFooterLine",
  "usgDeclarationLine",
  "usgPrintStyle",
  "usgPrintCompact",
  "usgPrintPaper",
  "usgSignatureUrl",
] as const;

export type BackupSettings = Partial<Record<(typeof BACKUP_SETTINGS_KEYS)[number], string | boolean>>;

export type BackupCustomPathology = {
  organKey: string;
  label: string;
  findingText: string;
  impressionLines: string[];
  titleFragment: string;
  sortOrder: number;
};

export type UsgBackupFile = {
  format: "usg-studio-backup";
  version: 1;
  exportedAt: string;
  settings: BackupSettings;
  customPathologies: BackupCustomPathology[];
};

/** Build the backup payload from live values. */
export function buildBackup(
  settings: Record<string, unknown>,
  customs: BackupCustomPathology[],
): UsgBackupFile {
  const picked: BackupSettings = {};
  for (const k of BACKUP_SETTINGS_KEYS) {
    const v = settings[k];
    if (typeof v === "string" || typeof v === "boolean") picked[k] = v;
  }
  return {
    format: "usg-studio-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: picked,
    customPathologies: customs.map((c) => ({ ...c })),
  };
}

/** Validate an uploaded backup file; throws with a doctor-friendly message. */
export function parseBackup(raw: unknown): UsgBackupFile {
  if (!raw || typeof raw !== "object") throw new Error("Not a USG Studio backup file");
  const obj = raw as Record<string, unknown>;
  if (obj.format !== "usg-studio-backup") {
    throw new Error("Not a USG Studio backup file (wrong format marker)");
  }
  if (Number(obj.version) !== 1) throw new Error(`Unsupported backup version: ${String(obj.version)}`);

  const settingsRaw = (obj.settings ?? {}) as Record<string, unknown>;
  const settings: BackupSettings = {};
  for (const k of BACKUP_SETTINGS_KEYS) {
    const v = settingsRaw[k];
    if (typeof v === "string" || typeof v === "boolean") settings[k] = v;
  }

  if (!Array.isArray(obj.customPathologies)) {
    throw new Error("Backup file has no customPathologies list");
  }
  const customPathologies: BackupCustomPathology[] = [];
  for (const entry of obj.customPathologies) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.organKey !== "string" || typeof e.label !== "string" || !e.label.trim()) continue;
    customPathologies.push({
      organKey: e.organKey,
      label: e.label,
      findingText: typeof e.findingText === "string" ? e.findingText : "",
      impressionLines: Array.isArray(e.impressionLines)
        ? e.impressionLines.filter((l): l is string => typeof l === "string")
        : [],
      titleFragment: typeof e.titleFragment === "string" ? e.titleFragment : "",
      sortOrder: typeof e.sortOrder === "number" ? e.sortOrder : 100,
    });
  }
  return { format: "usg-studio-backup", version: 1, exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : new Date().toISOString(), settings, customPathologies };
}
