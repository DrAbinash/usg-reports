/**
 * USG Studio — audit trail writer (v5 phase 6).
 *
 * Fire-and-forget: an audit failure must NEVER break the clinical action
 * it records (a report must save even if the audit insert fails).
 */
import { db } from "@/lib/db";

export type AuditEvent = {
  action: string;
  reportId?: string | null;
  serialNo?: number | null;
  patientName?: string | null;
  detail?: string;
};

/** Record one audit event (best effort, never throws). */
export async function audit(ev: AuditEvent): Promise<void> {
  try {
    await db.usgAudit.create({
      data: {
        action: ev.action,
        reportId: ev.reportId ?? null,
        serialNo: ev.serialNo ?? null,
        patientName: (ev.patientName ?? null)?.slice(0, 120) ?? null,
        detail: (ev.detail ?? "").slice(0, 500),
      },
    });
  } catch {
    // The register table may not exist yet on first boot — auditing is
    // best-effort by design.
  }
}

export { auditLabel, AUDIT_LABELS } from "./auditShared";
