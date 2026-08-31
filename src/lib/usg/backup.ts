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

// ── Full-clinic backup (v5 phase 6) ────────────────────────────────────────

export type BackupPatient = {
  id: string;
  name: string;
  phone: string;
  normName: string;
  normPhone: string;
  notes: string;
};

export type BackupImage = {
  id: string;
  dataUrl: string;
  caption: string;
  sortOrder: number;
};

export type BackupReport = {
  id: string;
  patientId: string | null;
  patientName: string;
  patientAge: string;
  patientSex: string;
  referredBy: string;
  studyKey: string;
  technique: string;
  stateJson: string;
  studyTitle: string;
  findings: string;
  impression: string;
  status: string;
  reportHtml: string | null;
  finalizedAt: string | null;
  serialNo: number | null;
  scanDate: string | null;
  createdAt: string;
  images: BackupImage[];
};

export type UsgFullBackupFile = {
  format: "usg-clinic-backup";
  version: 1;
  exportedAt: string;
  settings: BackupSettings;
  customPathologies: BackupCustomPathology[];
  patients: BackupPatient[];
  reports: BackupReport[];
};

/** Validate a full-clinic backup file; throws doctor-friendly errors. */
export function parseFullBackup(raw: unknown): UsgFullBackupFile {
  if (!raw || typeof raw !== "object") throw new Error("Not a USG clinic backup file");
  const obj = raw as Record<string, unknown>;
  if (obj.format !== "usg-clinic-backup") {
    if (obj.format === "usg-studio-backup") {
      throw new Error("That file is a personalisation backup — restore it as a personalisation backup");
    }
    throw new Error("Not a USG clinic backup file (wrong format marker)");
  }
  if (Number(obj.version) !== 1) throw new Error(`Unsupported backup version: ${String(obj.version)}`);

  const base = parseBackup({ ...obj, format: "usg-studio-backup" });

  if (!Array.isArray(obj.patients) || !Array.isArray(obj.reports)) {
    throw new Error("Backup file has no patient / report lists");
  }
  const patients: BackupPatient[] = [];
  for (const p of obj.patients) {
    if (!p || typeof p !== "object") continue;
    const e = p as Record<string, unknown>;
    if (typeof e.id !== "string" || typeof e.normName !== "string") continue;
    patients.push({
      id: e.id,
      name: typeof e.name === "string" ? e.name : "",
      phone: typeof e.phone === "string" ? e.phone : "",
      normName: e.normName,
      normPhone: typeof e.normPhone === "string" ? e.normPhone : "",
      notes: typeof e.notes === "string" ? e.notes : "",
    });
  }
  const reports: BackupReport[] = [];
  for (const r of obj.reports) {
    if (!r || typeof r !== "object") continue;
    const e = r as Record<string, unknown>;
    if (typeof e.id !== "string" || typeof e.patientName !== "string") continue;
    const images: BackupImage[] = Array.isArray(e.images)
      ? (e.images as Record<string, unknown>[])
          .filter((i) => i && typeof i.id === "string" && typeof i.dataUrl === "string")
          .map((i) => ({
            id: String(i.id),
            dataUrl: String(i.dataUrl),
            caption: typeof i.caption === "string" ? i.caption : "",
            sortOrder: typeof i.sortOrder === "number" ? i.sortOrder : 100,
          }))
      : [];
    reports.push({
      id: e.id,
      patientId: typeof e.patientId === "string" ? e.patientId : null,
      patientName: e.patientName,
      patientAge: typeof e.patientAge === "string" ? e.patientAge : "",
      patientSex: typeof e.patientSex === "string" ? e.patientSex : "F",
      referredBy: typeof e.referredBy === "string" ? e.referredBy : "",
      studyKey: typeof e.studyKey === "string" ? e.studyKey : "wa-female",
      technique: typeof e.technique === "string" ? e.technique : "",
      stateJson: typeof e.stateJson === "string" ? e.stateJson : "{}",
      studyTitle: typeof e.studyTitle === "string" ? e.studyTitle : "",
      findings: typeof e.findings === "string" ? e.findings : "",
      impression: typeof e.impression === "string" ? e.impression : "",
      status: e.status === "FINALIZED" ? "FINALIZED" : "DRAFT",
      reportHtml: typeof e.reportHtml === "string" ? e.reportHtml : null,
      finalizedAt: typeof e.finalizedAt === "string" ? e.finalizedAt : null,
      serialNo: typeof e.serialNo === "number" ? e.serialNo : null,
      scanDate: typeof e.scanDate === "string" ? e.scanDate : null,
      createdAt: typeof e.createdAt === "string" ? e.createdAt : new Date().toISOString(),
      images,
    });
  }
  return {
    format: "usg-clinic-backup",
    version: 1,
    exportedAt: base.exportedAt,
    settings: base.settings,
    customPathologies: base.customPathologies,
    patients,
    reports,
  };
}
