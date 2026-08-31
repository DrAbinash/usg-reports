/**
 * USG Studio — practice analytics (v5 phase 8).
 *
 * Pure aggregation over finalized reports: monthly volume, study mix, most
 * frequent pathologies (from the composer state selections) and top referral
 * sources. No patient names — counts only, safe to eyeball on screen.
 */
import { selectedPathologies } from "./composer";
import type { UsgComposerState } from "./types";

export type AnalyticsReport = {
  studyKey: string;
  status: string;
  scanDate: string | null;
  createdAt: string;
  referredBy: string;
  stateJson: string;
};

export type MonthPoint = { ym: string; label: string; count: number };
export type CountedEntry = { key: string; label: string; count: number };

export type UsgAnalytics = {
  totalFinalized: number;
  totalDrafts: number;
  patients: number;
  perMonth: MonthPoint[];
  byStudy: CountedEntry[];
  topPathologies: CountedEntry[];
  topReferrers: CountedEntry[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Aggregate. `labels` maps study keys → display labels; `pathologyLabels`
 * maps pathology keys → chip labels (both resolved by the caller so this
 * stays a pure function with no catalog imports).
 */
export function computeAnalytics(
  reports: AnalyticsReport[],
  patientCount: number,
  months = 12,
  labels: Record<string, string> = {},
  pathologyLabels: Record<string, string> = {},
): UsgAnalytics {
  const finalized = reports.filter((r) => r.status === "FINALIZED");
  const drafts = reports.length - finalized.length;

  // Month buckets — the last N months including the current one.
  const now = new Date();
  const buckets = new Map<string, number>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.set(monthKey(d.toISOString()), 0);
  }
  for (const r of finalized) {
    const key = monthKey(r.scanDate ?? r.createdAt);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  const perMonth: MonthPoint[] = [...buckets.entries()].map(([ym, count]) => {
    const [y, m] = ym.split("-");
    return { ym, label: `${MONTHS[Number(m) - 1]} ${y.slice(2)}`, count };
  });

  const byStudy = countBy(
    finalized.map((r) => r.studyKey),
    (k) => labels[k] ?? k,
  );

  // Pathology frequency — every selection on every finalized report.
  const pathologyKeys: string[] = [];
  for (const r of finalized) {
    try {
      const state = JSON.parse(r.stateJson) as UsgComposerState;
      if (state && Array.isArray(state.organs)) {
        for (const o of state.organs) pathologyKeys.push(...selectedPathologies(o));
      }
    } catch {
      // corrupt state row — skip
    }
  }
  const topPathologies = countBy(
    pathologyKeys,
    (k) => pathologyLabels[k] ?? k,
  ).filter((e) => e.count > 0);

  const topReferrers = countBy(
    finalized.map((r) => r.referredBy.trim()).filter(Boolean),
    (k) => k,
  );

  return {
    totalFinalized: finalized.length,
    totalDrafts: drafts,
    patients: patientCount,
    perMonth,
    byStudy,
    topPathologies: topPathologies.slice(0, 12),
    topReferrers: topReferrers.slice(0, 8),
  };
}

function countBy(keys: string[], label: (k: string) => string): CountedEntry[] {
  const counts = new Map<string, number>();
  for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, label: label(key), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
