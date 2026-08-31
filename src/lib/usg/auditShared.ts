/**
 * USG Studio — audit action labels (client-safe: no db imports so the
 * Settings activity list can render them in the browser).
 */

/** Friendly labels for the Activity tab. */
export const AUDIT_LABELS: Record<string, string> = {
  "report.create": "Draft created",
  "report.update": "Draft saved",
  "report.finalize": "Report finalized",
  "report.duplicate": "Follow-up drafted",
  "report.delete": "Report deleted",
  "image.attach": "Still attached",
  "image.remove": "Still removed",
  "settings.save": "Settings saved",
  "pathology.add": "Custom finding added",
  "pathology.update": "Custom finding edited",
  "pathology.delete": "Custom finding removed",
  "backup.download": "Backup downloaded",
  "backup.restore": "Backup restored",
  "backup.nightly": "Nightly backup written",
  "auth.login": "Studio unlocked",
  "auth.fail": "Wrong PIN",
  "normals.override": "Normal wording customised",
  "normals.reset": "Normal wording reset",
};

export function auditLabel(action: string): string {
  return AUDIT_LABELS[action] ?? action;
}
