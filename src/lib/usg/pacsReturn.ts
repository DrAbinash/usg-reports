/**
 * pacsReturn.ts — push finalized USG report back to Orthanc PACS.
 *
 * After a report is finalized, this module creates a simplified DICOM
 * Structured Report (SR) instance and uploads it to Orthanc so the report
 * is visible alongside the images in the PACS viewer.
 *
 * The SR contains:
 *   - Patient demographics (from the report)
 *   - Study reference (StudyInstanceUID + AccessionNumber)
 *   - Findings text (as TEXT content items)
 *   - Impression (as CONCLUSION content items)
 *
 * This is a simplified DICOM SR — not a full DICOM SR document tree. It
 * uses the Minimal Enhanced SR template (TID 6105) which most PACS
 * viewers display as readable text.
 *
 * Ported from CARE ERP's usgPacsReturn pattern, simplified for the
 * standalone studio's direct-to-Orthanc architecture.
 */

import { getSettings } from "@/lib/settings";
import type { OrthancResult } from "./orthancClient";
import type { UsgResolved } from "./types";

export type PacsReturnPayload = {
  studyInstanceUid: string;
  accessionNumber: string | null;
  patientName: string;
  patientId: string | null;
  patientDob: string | null;
  patientSex: string | null;
  reportText: string;
  findings: string;
  impression: string;
  studyDate: string;
  studyDescription: string;
  reportId: number;
  reportSerial: string;
};

export type PacsReturnStatus = {
  eligible: boolean;
  reasons: string[];
  orthancConfigured: boolean;
};

export type PacsReturnResult = {
  ok: boolean;
  orthancInstanceId?: string;
  error?: string;
};

/**
 * Check eligibility for PACS return.
 * A report is eligible if:
 *   1. It is finalized
 *   2. It has a StudyInstanceUID (linked to Orthanc)
 *   3. The patient has a name (not anonymous)
 *   4. PCPNDT compliance is met (if obstetric)
 */
export function checkEligibility(opts: {
  status: string;
  studyInstanceUid: string | null;
  patientName: string;
  pcpndtCompliant: boolean;
}): PacsReturnStatus {
  const reasons: string[] = [];

  if (opts.status !== "finalized") {
    reasons.push("Report is not finalized");
  }
  if (!opts.studyInstanceUid) {
    reasons.push("No StudyInstanceUID — report is not linked to a PACS study");
  }
  if (!opts.patientName || !opts.patientName.trim()) {
    reasons.push("Patient name is empty");
  }
  if (!opts.pcpndtCompliant) {
    reasons.push("PCPNDT Form F compliance not met");
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    orthancConfigured: true, // checked at runtime
  };
}

/**
 * Build a minimal DICOM SR dataset as a JSON object (DICOM JSON format).
 * This is uploaded to Orthanc via POST /instances with the DICOM JSON.
 *
 * Uses the Minimal Enhanced SR (TID 6105) document type which most
 * PACS viewers display as readable text.
 */
export function buildDicomSrDocument(payload: PacsReturnPayload): Record<string, unknown> {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "");

  // DICOM SR content sequence — findings + impression as TEXT items
  const contentSequence: unknown[] = [];

  // Findings section
  const findingLines = payload.findings.split("\n").filter((l) => l.trim());
  for (const line of findingLines) {
    contentSequence.push(buildTextItem("FINDING", line.trim()));
  }

  // Impression section
  const impressionLines = payload.impression.split("\n").filter((l) => l.trim());
  for (const line of impressionLines) {
    contentSequence.push(buildTextItem("CONCLUSION", line.trim()));
  }

  // Report serial number
  contentSequence.push(buildTextItem("REPORT_ID", payload.reportSerial));

  return {
    // ── File Meta Information ────────────────────────────────────────────
    "00020001": { vr: "OB", Value: [1] }, // File Meta Information Version
    "00020002": { vr: "UI", Value: ["1.2.840.10008.5.1.4.1.1.88.11"] }, // SOP Class UID (Basic Text SR)
    "00020003": { vr: "UI", Value: [generateSopInstanceUid()] }, // SOP Instance UID
    "00020010": { vr: "UI", Value: ["1.2.840.10008.1.2.1"] }, // Transfer Syntax UID (Explicit VR Little Endian)

    // ── Patient Module ────────────────────────────────────────────────────
    "00100010": { vr: "PN", Value: [{ Alphabetic: payload.patientName }] }, // Patient Name
    "00100020": { vr: "LO", Value: [payload.patientId ?? ""] }, // Patient ID
    "00100030": { vr: "DA", Value: [payload.patientDob ?? ""] }, // Patient Birth Date
    "00100040": { vr: "CS", Value: [payload.patientSex ?? ""] }, // Patient Sex

    // ── Study Module ──────────────────────────────────────────────────────
    "0020000D": { vr: "UI", Value: [payload.studyInstanceUid] }, // Study Instance UID
    "00080050": { vr: "SH", Value: [payload.accessionNumber ?? ""] }, // Accession Number
    "00080020": { vr: "DA", Value: [dateStr] }, // Study Date
    "00080030": { vr: "TM", Value: [timeStr] }, // Study Time
    "00080061": { vr: "CS", Value: ["SR"] }, // Modalities in Study
    "00080090": { vr: "PN", Value: [{ Alphabetic: "CARE USG Studio" }] }, // Referring Physician
    "00200010": { vr: "SH", Value: ["USG"] }, // Study ID
    "00081030": { vr: "LO", Value: [payload.studyDescription || "Ultrasound Report"] }, // Study Description

    // ── Series Module ─────────────────────────────────────────────────────
    "0020000E": { vr: "UI", Value: [generateSeriesInstanceUid(payload.studyInstanceUid)] }, // Series Instance UID
    "00080060": { vr: "CS", Value: ["SR"] }, // Modality
    "00400253": { vr: "SH", Value: ["USG REPORT"] }, // Series Number

    // ── SR Document Module ────────────────────────────────────────────────
    "0040A040": { vr: "CS", Value: ["DOCUMENT"] }, // Value Type
    "0040A043": { vr: "SQ", Value: [{ // Concept Name Code Sequence
      "00080100": { vr: "SH", Value: ["USG_REPORT"] },
      "00080104": { vr: "LO", Value: ["Ultrasound Report"] },
      "00080102": { vr: "SH", Value: ["99CARE"] },
    }] },
    "0040A730": { vr: "SQ", Value: [contentSequence] }, // Content Sequence

    // ── Instance Module ──────────────────────────────────────────────────
    "00080018": { vr: "UI", Value: [generateSopInstanceUid()] }, // SOP Instance UID
    "00080016": { vr: "UI", Value: ["1.2.840.10008.5.1.4.1.1.88.11"] }, // SOP Class UID
    "00080012": { vr: "DT", Value: [now.toISOString().replace(/[-:]/g, "").split(".")[0]] }, // Instance Creation Date-Time
  };
}

function buildTextItem(name: string, text: string): Record<string, unknown> {
  return {
    "0040A040": { vr: "CS", Value: ["TEXT"] },
    "0040A043": { vr: "SQ", Value: [{
      "00080100": { vr: "SH", Value: [name] },
      "00080104": { vr: "LO", Value: [name.charAt(0) + name.slice(1).toLowerCase().replace(/_/g, " ")] },
      "00080102": { vr: "SH", Value: ["99CARE"] },
    }] },
    "0040A160": { vr: "UT", Value: [text] },
  };
}

function generateSopInstanceUid(): string {
  // CARE USG Studio root: 1.2.826.0.1.3680043.10.543.{random}
  const rand = Math.floor(Math.random() * 1e12);
  return `1.2.826.0.1.3680043.10.543.${Date.now()}.${rand}`;
}

function generateSeriesInstanceUid(studyUid: string): string {
  const rand = Math.floor(Math.random() * 1e8);
  return `${studyUid}.1.${rand}`;
}

/**
 * Upload a DICOM SR document to Orthanc.
 * Uses the /instances endpoint which accepts a DICOM file.
 *
 * Since we're building a DICOM JSON (not a .dcm file), we need to use
 * Orthanc's /tools/create-dicom endpoint which accepts a JSON definition
 * and creates a DICOM instance server-side.
 */
export async function uploadToOrthanc(
  payload: PacsReturnPayload,
): Promise<PacsReturnResult> {
  const s = await getSettings();
  if (!s.orthancUrl) {
    return { ok: false, error: "Orthanc not configured (Settings → Integrations)" };
  }

  const base = s.orthancUrl.trim().replace(/\/+$/, "");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (s.orthancUsername) {
    headers.Authorization = `Basic ${Buffer.from(`${s.orthancUsername}:${s.orthancPassword ?? ""}`).toString("base64")}`;
  }

  try {
    // Use Orthanc's /tools/create-dicom to create a DICOM instance from JSON
    const createBody = {
      Tags: {
        PatientName: payload.patientName,
        PatientID: payload.patientId ?? "",
        PatientBirthDate: payload.patientDob ?? "",
        PatientSex: payload.patientSex ?? "",
        StudyInstanceUID: payload.studyInstanceUid,
        AccessionNumber: payload.accessionNumber ?? "",
        StudyDate: payload.studyDate.replace(/-/g, ""),
        StudyDescription: payload.studyDescription || "Ultrasound Report",
        Modality: "SR",
        SeriesDescription: "USG Report",
        Manufacturer: "CARE USG Studio",
        InstitutionName: "CARE Diagnostics",
      },
      Content: payload.reportText,
      PrivateCreator: "CARE_USG_STUDIO",
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);

    try {
      const res = await fetch(`${base}/tools/create-dicom`, {
        method: "POST",
        headers,
        body: JSON.stringify(createBody),
        signal: controller.signal,
        cache: "no-store",
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { ok: false, error: `Orthanc responded ${res.status}: ${text.slice(0, 200)}` };
      }

      const data = await res.json() as { ID?: string; ParentSeries?: string; Path?: string };
      return {
        ok: true,
        orthancInstanceId: data.ID ?? data.Path ?? "unknown",
      };
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { ok: false, error: "Orthanc timed out (30s)" };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

/**
 * Check PACS return status for a finalized report.
 * Returns the current Orthanc status.
 */
export async function checkPacsStatus(
  studyInstanceUid: string,
): Promise<{ returned: boolean; instanceId?: string }> {
  const s = await getSettings();
  if (!s.orthancUrl) return { returned: false };

  const base = s.orthancUrl.trim().replace(/\/+$/, "");
  const headers: Record<string, string> = {};
  if (s.orthancUsername) {
    headers.Authorization = `Basic ${Buffer.from(`${s.orthancUsername}:${s.orthancPassword ?? ""}`).toString("base64")}`;
  }

  try {
    // Look for SR instances in the study
    const res = await fetch(
      `${base}/studies/${studyInstanceUid}/instances`,
      { headers, cache: "no-store", signal: AbortSignal.timeout(10_000) },
    );

    if (!res.ok) return { returned: false };

    const instances = await res.json() as Array<{
      ID: string;
      MainDicomTags: { Modality?: string; SOPClassUID?: string };
    }>;

    // Check if any instance is an SR
    const srInstance = instances.find(
      (inst) =>
        inst.MainDicomTags?.Modality === "SR" ||
        inst.MainDicomTags?.SOPClassUID === "1.2.840.10008.5.1.4.1.1.88.11",
    );

    if (srInstance) {
      return { returned: true, instanceId: srInstance.ID };
    }

    return { returned: false };
  } catch {
    return { returned: false };
  }
}
