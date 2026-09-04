/**
 * criticalFindings.ts — critical findings alerting for the USG Studio.
 *
 * When a critical pathology is selected (ectopic, fetal demise, etc.), the
 * studio shows a banner and optionally triggers a notification.
 *
 * Ported from CARE ERP's usgCriticalAlerts pattern, simplified for a
 * single-sonologist studio: no escalation timer, no email — just a visible
 * banner + an entry in the audit trail so the critical finding is never
 * silently printed without the sonologist seeing it.
 *
 * The critical flag lives on the pathology definition, not on the finding
 * text — so it survives text edits and is visible in the chip before the
 * report is even composed.
 */

export type CriticalSeverity = "critical" | "urgent" | "significant";

export type CriticalFindingAlert = {
  pathologyKey: string;
  pathologyLabel: string;
  organ: string;
  severity: CriticalSeverity;
  message: string;
  recommendation: string;
};

/**
 * Registry of critical pathology keys → alert metadata.
 *
 * These keys MUST match the pathology `key` field in pathologies.ts /
 * pathologies-extra.ts. Only pathologies that are genuinely critical
 * (require immediate clinical action) are listed here.
 */
const CRITICAL_REGISTRY: Record<string, { severity: CriticalSeverity; message: string; recommendation: string }> = {
  // ── Obstetric critical ─────────────────────────────────────────────────
  "ob-ectopic": {
    severity: "critical",
    message: "Ectopic pregnancy detected — immediate clinical correlation required.",
    recommendation: "Notify referring doctor immediately. Advise urgent clinical evaluation.",
  },
  "ob-no-fh": {
    severity: "critical",
    message: "No fetal cardiac activity — suspected fetal demise / missed abortion.",
    recommendation: "Confirm with second opinion / repeat scan. Notify referring doctor.",
  },
  "ob-anhydramnios": {
    severity: "critical",
    message: "Anhydramnios / severe oligohydramnios — high-risk pregnancy.",
    recommendation: "Refer to fetal medicine specialist. Assess renal function.",
  },
  "ob-placenta-previa": {
    severity: "critical",
    message: "Placenta previa detected — risk of antepartum haemorrhage.",
    recommendation: "Advise against vaginal delivery. Refer to obstetrician.",
  },
  "ob-abruption": {
    severity: "critical",
    message: "Features suggestive of placental abruption — emergency.",
    recommendation: "Immediate obstetric consultation. Assess maternal vitals.",
  },
  "ob-molar": {
    severity: "critical",
    message: "Molar pregnancy suspected — requires urgent management.",
    recommendation: "Serial β-hCG. Refer to gynaecologist for management.",
  },
  "ob-iugr": {
    severity: "urgent",
    message: "Intrauterine growth restriction detected — needs Doppler correlation.",
    recommendation: "Doppler assessment (UA PI, MCA PI, DV). Follow-up scan in 2 weeks.",
  },

  // ── Abdomen critical ───────────────────────────────────────────────────
  "liver-mass": {
    severity: "critical",
    message: "Liver mass detected — needs urgent characterisation.",
    recommendation: "CECT / MRI liver with contrast. Tumour markers (AFP, CEA).",
  },
  "liver-budd-chiari": {
    severity: "critical",
    message: "Budd-Chiari syndrome features — urgent management required.",
    recommendation: "Hepatology referral. Coagulation profile.",
  },
  "gb-emphysematous": {
    severity: "critical",
    message: "Emphysematous cholecystitis — surgical emergency.",
    recommendation: "Immediate surgical consultation. IV antibiotics.",
  },
  "gb-perforation": {
    severity: "critical",
    message: "Gallbladder perforation suspected — surgical emergency.",
    recommendation: "Immediate surgical consultation.",
  },
  "pancreatitis": {
    severity: "critical",
    message: "Acute pancreatitis features — urgent management required.",
    recommendation: "Serum amylase / lipase. NPO. Surgical / GI consultation.",
  },
  "aorta-aneurysm": {
    severity: "critical",
    message: "Abdominal aortic aneurysm > 5 cm — high rupture risk.",
    recommendation: "Urgent vascular surgery referral. BP control.",
  },

  // ── Renal critical ─────────────────────────────────────────────────────
  "kidney-hydronephrosis-severe": {
    severity: "urgent",
    message: "Severe hydronephrosis — obstructive uropathy likely.",
    recommendation: "Renal function tests. Urology referral.",
  },
  "kidney-mass": {
    severity: "critical",
    message: "Renal mass detected — needs urgent characterisation.",
    recommendation: "CECT abdomen. Urology referral.",
  },

  // ── Pelvic critical ───────────────────────────────────────────────────
  "uterus-mass": {
    severity: "urgent",
    message: "Uterine mass detected — needs characterisation.",
    recommendation: "Gynaecology referral. Consider biopsy.",
  },
  "ovary-torsion": {
    severity: "critical",
    message: "Ovarian torsion suspected — surgical emergency.",
    recommendation: "Immediate gynaecology consultation. Emergency laparoscopy.",
  },
};

/** Check if a pathology key is critical. */
export function isCriticalPathology(pathologyKey: string): boolean {
  return pathologyKey in CRITICAL_REGISTRY;
}

/** Get the severity of a critical pathology. Returns null if not critical. */
export function getCriticalSeverity(pathologyKey: string): CriticalSeverity | null {
  return CRITICAL_REGISTRY[pathologyKey]?.severity ?? null;
}

/**
 * Scan the current composer state for any selected critical pathologies.
 * Returns an alert for each one found.
 */
export function scanForCriticalFindings(
  selectedPathologies: Array<{ key: string; label: string; organ: string }>,
): CriticalFindingAlert[] {
  const alerts: CriticalFindingAlert[] = [];
  for (const p of selectedPathologies) {
    const reg = CRITICAL_REGISTRY[p.key];
    if (reg) {
      alerts.push({
        pathologyKey: p.key,
        pathologyLabel: p.label,
        organ: p.organ,
        severity: reg.severity,
        message: reg.message,
        recommendation: reg.recommendation,
      });
    }
  }
  return alerts;
}

/** Severity → display colour (Tailwind classes). */
export function severityColour(severity: CriticalSeverity): string {
  switch (severity) {
    case "critical":
      return "bg-red-600 text-white border-red-700";
    case "urgent":
      return "bg-orange-500 text-white border-orange-600";
    case "significant":
      return "bg-amber-400 text-amber-950 border-amber-500";
  }
}

/** Severity → icon name (lucide). */
export function severityIcon(severity: CriticalSeverity): string {
  switch (severity) {
    case "critical":
      return "AlertOctagon";
    case "urgent":
      return "AlertTriangle";
    case "significant":
      return "Info";
  }
}

/**
 * Audit payload for a critical finding — appended to the audit trail so the
 * critical event is permanently recorded.
 */
export function criticalAuditPayload(alerts: CriticalFindingAlert[]): {
  action: string;
  details: Record<string, unknown>;
} {
  return {
    action: "critical_finding_detected",
    details: {
      count: alerts.length,
      findings: alerts.map((a) => ({
        key: a.pathologyKey,
        label: a.pathologyLabel,
        organ: a.organ,
        severity: a.severity,
        message: a.message,
      })),
    },
  };
}
