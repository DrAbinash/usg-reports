/**
 * criticalComm.ts — Critical Findings Communication Log (v6.9).
 *
 * Indian PCPNDT/NMC and ACR guidance: when a critical finding is detected
 * (ectopic pregnancy with hemoperitoneum, suspicious breast mass, fetal
 * demise, etc.), the radiologist MUST document that they communicated it
 * to the referring physician — who, when, by what method, and whether the
 * referring physician acknowledged receipt. This is the legal record.
 *
 * This module is the pure data layer (no React, no Prisma import) so it
 * can be unit-tested without a database.
 */

export const COMMUNICATION_METHODS = [
  "phone",
  "whatsapp",
  "sms",
  "in-person",
  "email",
] as const;
export type CommunicationMethod = (typeof COMMUNICATION_METHODS)[number];

export type CriticalCommunicationInput = {
  reportId: string;
  findingText: string;
  communicatedTo: string;
  communicatedAt: string; // ISO datetime
  method: string;
  communicatedBy?: string;
  notes?: string;
};

export type CriticalCommunicationAckInput = {
  acknowledged: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
};

export type CriticalCommunication = {
  id: string;
  reportId: string;
  findingText: string;
  communicatedTo: string;
  communicatedAt: string;
  method: string;
  communicatedBy: string;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ValidationError = { field: string; message: string };

/** Validate a new communication entry. Returns [] on success. */
export function validateCommunicationInput(
  input: Partial<CriticalCommunicationInput>,
): ValidationError[] {
  const errs: ValidationError[] = [];
  if (!input.reportId || !input.reportId.trim()) {
    errs.push({ field: "reportId", message: "Report ID is required" });
  }
  if (!input.findingText || !input.findingText.trim()) {
    errs.push({ field: "findingText", message: "Finding text is required" });
  } else if (input.findingText.length > 1000) {
    errs.push({ field: "findingText", message: "Finding text must be ≤ 1000 chars" });
  }
  if (!input.communicatedTo || !input.communicatedTo.trim()) {
    errs.push({ field: "communicatedTo", message: "Communicated-to is required" });
  }
  if (!input.communicatedAt) {
    errs.push({ field: "communicatedAt", message: "Communication time is required" });
  } else if (Number.isNaN(Date.parse(input.communicatedAt))) {
    errs.push({ field: "communicatedAt", message: "Communication time is not a valid date" });
  }
  if (!input.method || !COMMUNICATION_METHODS.includes(input.method as CommunicationMethod)) {
    errs.push({ field: "method", message: `Method must be one of: ${COMMUNICATION_METHODS.join(", ")}` });
  }
  if (input.notes && input.notes.length > 1000) {
    errs.push({ field: "notes", message: "Notes must be ≤ 1000 chars" });
  }
  return errs;
}

/** Human-readable label for the method (capitalised). */
export function methodLabel(method: string): string {
  const map: Record<string, string> = {
    "phone": "Phone call",
    "whatsapp": "WhatsApp",
    "sms": "SMS",
    "in-person": "In person",
    "email": "Email",
  };
  return map[method] ?? method;
}

/** Format a DateTime for display in the log (e.g. "06 Sep 2026, 14:30"). */
export function formatCommDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
