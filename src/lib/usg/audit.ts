/**
 * USG Studio — audit trail writer (v5 phase 6).
 *
 * Fire-and-forget: an audit failure must NEVER break the clinical action
 * it records (a report must save even if the audit insert fails).
 *
 * v6.10 — audit rows carry the active clinicId so the audit log in
 * Settings is scoped per-clinic. The clinicId is read from the cookie
 * via getActiveClinicId() at write time.
 */
import { db } from "@/lib/db";
import { getActiveClinicId } from "@/lib/auth";

export type AuditEvent = {
  action: string;
  reportId?: string | null;
  serialNo?: number | null;
  patientName?: string | null;
  detail?: string;
  /** Override the clinicId (rare — used by background sync jobs that
   *  don't have a request cookie). Defaults to the active clinic. */
  clinicId?: string;
};

/** Record one audit event (best effort, never throws). */
export async function audit(ev: AuditEvent): Promise<void> {
  try {
    const clinicId = ev.clinicId ?? (await getActiveClinicId().catch(() => "default"));
    await db.usgAudit.create({
      data: {
        clinicId,
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
