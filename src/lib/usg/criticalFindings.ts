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
 *
 * Stale keys removed (no catalog counterpart):
 *   ob-abruption, ob-molar, ob-iugr, liver-budd-chiari, gb-emphysematous,
 *   gb-perforation, aorta-aneurysm, kidney-mass, uterus-mass, ovary-torsion
 *   — no matching chip exists; do not invent pathologies for them.
 */
const CRITICAL_REGISTRY: Record<string, { severity: CriticalSeverity; message: string; recommendation: string }> = {
  // ── Obstetric / early-pregnancy critical ───────────────────────────────
  "adnexa-ectopic": {
    severity: "critical",
    message: "Ectopic pregnancy detected — immediate clinical correlation required.",
    recommendation: "Notify referring doctor immediately. Advise urgent clinical evaluation.",
  },
  "fetus-iud": {
    severity: "critical",
    message: "No fetal cardiac activity — suspected fetal demise / IUD.",
    recommendation: "Confirm with second opinion / repeat scan. Notify referring doctor.",
  },
  "gravid-missed-abortion": {
    severity: "critical",
    message: "Missed abortion — no embryonic cardiac activity.",
    recommendation: "Confirm with second opinion / repeat scan. Notify referring doctor.",
  },
  "gravid-blighted-ovum": {
    severity: "urgent",
    message: "Blighted ovum / anembryonic gestation suspected.",
    recommendation: "Serial β-hCG. Gynaecology referral for management.",
  },
  "liquor-oligohydramnios": {
    severity: "critical",
    message: "Oligohydramnios / severe liquor reduction — high-risk pregnancy.",
    recommendation: "Refer to fetal medicine specialist. Assess renal function.",
  },
  "placenta-previa-complete": {
    severity: "critical",
    message: "Complete placenta previa — risk of antepartum haemorrhage.",
    recommendation: "Advise against vaginal delivery. Refer to obstetrician.",
  },
  "placenta-previa-partial": {
    severity: "critical",
    message: "Partial placenta previa — risk of antepartum haemorrhage.",
    recommendation: "Advise against vaginal delivery. Refer to obstetrician.",
  },
  "anatomy-anencephaly": {
    severity: "critical",
    message: "Anencephaly / lethal neural-tube defect detected.",
    recommendation: "Urgent fetal medicine / obstetric counselling.",
  },

  // ── Abdomen critical ───────────────────────────────────────────────────
  "liver-sol-mets": {
    severity: "critical",
    message: "Liver mass / metastasis pattern — needs urgent characterisation.",
    recommendation: "CECT / MRI liver with contrast. Tumour markers (AFP, CEA).",
  },
  "liver-abscess": {
    severity: "urgent",
    message: "Liver abscess — needs urgent clinical management.",
    recommendation: "CECT abdomen. Clinico-pathological correlation. Surgical / ID opinion.",
  },
  "pancreatitis-acute": {
    severity: "critical",
    message: "Acute pancreatitis features — urgent management required.",
    recommendation: "Serum amylase / lipase. NPO. Surgical / GI consultation.",
  },
  "rif-appendicitis": {
    severity: "critical",
    message: "Acute appendicitis — surgical emergency.",
    recommendation: "Immediate surgical consultation.",
  },
  "others-intestinal-obstruction": {
    severity: "critical",
    message: "Intestinal obstruction features — urgent management required.",
    recommendation: "Immediate surgical consultation. Erect X-ray abdomen.",
  },

  // ── Renal critical ─────────────────────────────────────────────────────
  "kidney-hydro-gross": {
    severity: "urgent",
    message: "Gross hydronephrosis — obstructive uropathy likely.",
    recommendation: "Renal function tests. Urology referral. Consider CT urography.",
  },

  // ── Breast / soft tissue / vascular / orbit ────────────────────────────
  "breast-carcinoma": {
    severity: "critical",
    message: "Breast mass highly suspicious for carcinoma.",
    recommendation: "Urgent FNAC / biopsy. Surgical oncology referral.",
  },
  "breast-mass-malignant": {
    severity: "critical",
    message: "Large ulcerating breast mass — malignant features.",
    recommendation: "Urgent FNAC / biopsy. Surgical oncology referral.",
  },
  "carotid-ica-occlusion": {
    severity: "critical",
    message: "ICA occlusion — high stroke risk.",
    recommendation: "Urgent neurology / vascular referral.",
  },
  "orbit-retinoblastoma": {
    severity: "critical",
    message: "Intraocular mass — ? Retinoblastoma.",
    recommendation: "Urgent paediatric ophthalmology / oncology referral.",
  },
  "swelling-hernia-irreducible": {
    severity: "critical",
    message: "Irreducible / obstructed hernia — surgical emergency.",
    recommendation: "Immediate surgical consultation.",
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
