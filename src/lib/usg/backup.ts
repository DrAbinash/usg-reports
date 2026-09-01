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
  // v6.2 print fine-tuning dials (numbers are font size / line height)
  "usgPrintFontSize",
  "usgPrintLineHeight",
  "usgPrintSpacing",
  "usgPrintShowTechnique",
  "usgPrintShowThanks",
  // v6 — PC-PNDT Form F fixed details (personalisation, not clinical)
  "pcpndtCentreName",
  "pcpndtRegistrationNo",
  "pcpndtPlace",
] as const;

export type BackupSettings = Partial<Record<(typeof BACKUP_SETTINGS_KEYS)[number], string | boolean | number>>;

export type BackupCustomPathology = {
  organKey: string;
  label: string;
  findingText: string;
  impressionLines: string[];
  titleFragment: string;
  sortOrder: number;
};

export type BackupNormalOverride = {
  studyKey: string;
  organKey: string;
  text: string;
};

export type UsgBackupFile = {
  format: "usg-studio-backup";
  version: 1;
  exportedAt: string;
  settings: BackupSettings;
  customPathologies: BackupCustomPathology[];
  /** The doctor's normal-wording overrides (optional — older files lack it). */
  normalOverrides?: BackupNormalOverride[];
};

/** Build the backup payload from live values. */
export function buildBackup(
  settings: Record<string, unknown>,
  customs: BackupCustomPathology[],
  normalOverrides: BackupNormalOverride[] = [],
): UsgBackupFile {
  const picked: BackupSettings = {};
  for (const k of BACKUP_SETTINGS_KEYS) {
    const v = settings[k];
    if (typeof v === "string" || typeof v === "boolean" || typeof v === "number") picked[k] = v;
  }
  return {
    format: "usg-studio-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: picked,
    customPathologies: customs.map((c) => ({ ...c })),
    normalOverrides: normalOverrides.map((n) => ({ ...n })),
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
    if (typeof v === "string" || typeof v === "boolean" || typeof v === "number") settings[k] = v;
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
  const normalOverrides: BackupNormalOverride[] = Array.isArray(obj.normalOverrides)
    ? (obj.normalOverrides as Record<string, unknown>[])
        .filter((n) => n && typeof n.studyKey === "string" && typeof n.organKey === "string" && typeof n.text === "string" && n.text.trim())
        .map((n) => ({ studyKey: String(n.studyKey), organKey: String(n.organKey), text: String(n.text).trim() }))
    : [];
  return { format: "usg-studio-backup", version: 1, exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : new Date().toISOString(), settings, customPathologies, normalOverrides };
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
  normalOverrides?: BackupNormalOverride[];
  patients: BackupPatient[];
  reports: BackupReport[];
  /** v6: PC-PNDT Form F records (statutory — they travel with the clinic). */
  formFs?: BackupFormF[];
  /** v6: bill-desk order links (worklist history; clinical workflow state). */
  careOrders?: BackupCareOrder[];
};

export type BackupFormF = {
  id: string;
  accessionNumber: string;
  billNumber: string;
  patientName: string;
  patientAge: string;
  husbandFatherName: string;
  address: string;
  mobile: string;
  childrenDetails: string;
  referredBy: string;
  lmpWeeks: string;
  previousChildIssue: string;
  indicationOther: string;
  gestationalAgeWeeks: string;
  gestationalAgeDays: string;
  ultrasoundResult: string;
  abnormality: string;
  procedureDate: string;
  consentDate: string;
  idCardVerified: boolean;
  reportId: string | null;
  createdAt: string;
};

export type BackupCareOrder = {
  id: string;
  /** null = the ERP supplied no accession (v6.1 identity model). */
  accessionNumber: string | null;
  careWorklistId: string | null;
  patientName: string;
  patientAge: string;
  patientSex: string;
  patientPhone: string;
  patientAddress: string;
  billNumber: string;
  referringDoctor: string;
  testName: string;
  modality: string;
  studyDate: string | null;
  studyInstanceUid: string | null;
  billingStatus: string | null;
  status: string;
  ignored: boolean;
  reportId: string | null;
  formFId: string | null;
  careSyncedAt: string | null;
  createdAt: string;
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
  const formFs: BackupFormF[] = Array.isArray(obj.formFs)
    ? (obj.formFs as Record<string, unknown>[])
        .filter((f) => f && typeof f.id === "string" && typeof f.patientName === "string")
        .map((f) => ({
          id: String(f.id),
          accessionNumber: typeof f.accessionNumber === "string" ? f.accessionNumber : "",
          billNumber: typeof f.billNumber === "string" ? f.billNumber : "",
          patientName: String(f.patientName),
          patientAge: typeof f.patientAge === "string" ? f.patientAge : "",
          husbandFatherName: typeof f.husbandFatherName === "string" ? f.husbandFatherName : "",
          address: typeof f.address === "string" ? f.address : "",
          mobile: typeof f.mobile === "string" ? f.mobile : "",
          childrenDetails: typeof f.childrenDetails === "string" ? f.childrenDetails : "",
          referredBy: typeof f.referredBy === "string" ? f.referredBy : "Self",
          lmpWeeks: typeof f.lmpWeeks === "string" ? f.lmpWeeks : "",
          previousChildIssue: typeof f.previousChildIssue === "string" ? f.previousChildIssue : "",
          indicationOther: typeof f.indicationOther === "string" ? f.indicationOther : "",
          gestationalAgeWeeks: typeof f.gestationalAgeWeeks === "string" ? f.gestationalAgeWeeks : "",
          gestationalAgeDays: typeof f.gestationalAgeDays === "string" ? f.gestationalAgeDays : "",
          ultrasoundResult: typeof f.ultrasoundResult === "string" ? f.ultrasoundResult : "",
          abnormality: typeof f.abnormality === "string" ? f.abnormality : "",
          procedureDate: typeof f.procedureDate === "string" ? f.procedureDate : "",
          consentDate: typeof f.consentDate === "string" ? f.consentDate : "",
          idCardVerified: f.idCardVerified === true,
          reportId: typeof f.reportId === "string" ? f.reportId : null,
          createdAt: typeof f.createdAt === "string" ? f.createdAt : new Date().toISOString(),
        }))
    : [];
  const careOrders: BackupCareOrder[] = Array.isArray(obj.careOrders)
    ? (obj.careOrders as Record<string, unknown>[])
        .filter((o) => o && typeof o.id === "string" && (typeof o.accessionNumber === "string" || o.accessionNumber == null))
        .map((o) => ({
          id: String(o.id),
          // "" normalises to null — blank accessions are not a value (v6.1)
          accessionNumber: typeof o.accessionNumber === "string" && o.accessionNumber.trim() ? o.accessionNumber : null,
          careWorklistId: typeof o.careWorklistId === "string" ? o.careWorklistId : null,
          patientName: typeof o.patientName === "string" ? o.patientName : "",
          patientAge: typeof o.patientAge === "string" ? o.patientAge : "",
          patientSex: typeof o.patientSex === "string" ? o.patientSex : "F",
          patientPhone: typeof o.patientPhone === "string" ? o.patientPhone : "",
          patientAddress: typeof o.patientAddress === "string" ? o.patientAddress : "",
          billNumber: typeof o.billNumber === "string" ? o.billNumber : "",
          referringDoctor: typeof o.referringDoctor === "string" ? o.referringDoctor : "",
          testName: typeof o.testName === "string" ? o.testName : "",
          modality: typeof o.modality === "string" ? o.modality : "USG",
          studyDate: typeof o.studyDate === "string" ? o.studyDate : null,
          studyInstanceUid: typeof o.studyInstanceUid === "string" ? o.studyInstanceUid : null,
          billingStatus: typeof o.billingStatus === "string" ? o.billingStatus : null,
          status: typeof o.status === "string" ? o.status : "PENDING",
          ignored: o.ignored === true,
          reportId: typeof o.reportId === "string" ? o.reportId : null,
          formFId: typeof o.formFId === "string" ? o.formFId : null,
          careSyncedAt: typeof o.careSyncedAt === "string" ? o.careSyncedAt : null,
          createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString(),
        }))
    : [];
  return {
    format: "usg-clinic-backup",
    version: 1,
    exportedAt: base.exportedAt,
    settings: base.settings,
    customPathologies: base.customPathologies,
    normalOverrides: base.normalOverrides,
    patients,
    reports,
    formFs,
    careOrders,
  };
}
