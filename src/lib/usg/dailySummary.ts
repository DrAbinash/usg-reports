/**
 * dailySummary.ts — end-of-day summary + revenue tracker.
 *
 * Feature 10: At day's end, the studio shows:
 *   - Scans finalized today
 *   - Critical findings detected
 *   - Follow-ups due
 *   - Most common study types
 *   - Revenue estimate (if pricing is configured)
 */

export type DailySummary = {
  date: string;
  finalizedCount: number;
  draftCount: number;
  criticalFindingsCount: number;
  followUpsDue: number;
  studyBreakdown: Array<{ studyKey: string; studyTitle: string; count: number }>;
  topFindings: Array<{ label: string; count: number }>;
  revenueEstimate: number | null;
  avgTurnaroundMin: number | null;
};

export type ReportSummary = {
  id: number;
  scanDate: string | null;
  finalizedAt: string | null;
  status: string;
  studyKey: string;
  studyTitle: string;
  impression: string;
  patientName: string;
  serialNo: number | null;
};

/**
 * Build a daily summary from the day's reports.
 */
export function buildDailySummary(
  reports: ReportSummary[],
  studyPricing?: Record<string, number>,
): DailySummary {
  const today = new Date().toISOString().slice(0, 10);

  const todayReports = reports.filter(
    (r) => r.finalizedAt?.slice(0, 10) === today || r.scanDate?.slice(0, 10) === today,
  );

  const finalized = todayReports.filter((r) => r.status === "FINALIZED");
  const drafts = todayReports.filter((r) => r.status === "DRAFT");

  // Study breakdown
  const studyCounts = new Map<string, { studyKey: string; studyTitle: string; count: number }>();
  for (const r of finalized) {
    const existing = studyCounts.get(r.studyKey);
    if (existing) {
      existing.count++;
    } else {
      studyCounts.set(r.studyKey, { studyKey: r.studyKey, studyTitle: r.studyTitle || r.studyKey, count: 1 });
    }
  }
  const studyBreakdown = Array.from(studyCounts.values()).sort((a, b) => b.count - a.count);

  // Top findings (from impression lines)
  const findingCounts = new Map<string, number>();
  for (const r of finalized) {
    const lines = r.impression.split("\n").filter((l) => l.trim());
    for (const line of lines) {
      const key = line.trim().slice(0, 60);
      findingCounts.set(key, (findingCounts.get(key) ?? 0) + 1);
    }
  }
  const topFindings = Array.from(findingCounts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Revenue estimate
  let revenueEstimate: number | null = null;
  if (studyPricing) {
    revenueEstimate = finalized.reduce((sum, r) => sum + (studyPricing[r.studyKey] ?? 0), 0);
  }

  // Average turnaround (from scan date to finalize)
  const turnarounds: number[] = [];
  for (const r of finalized) {
    if (!r.scanDate || !r.finalizedAt) continue;
    const scan = new Date(r.scanDate).getTime();
    const fin = new Date(r.finalizedAt).getTime();
    if (Number.isFinite(scan) && Number.isFinite(fin) && fin >= scan) {
      turnarounds.push((fin - scan) / 60000); // minutes
    }
  }
  const avgTurnaroundMin = turnarounds.length > 0
    ? Math.round(turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length)
    : null;

  return {
    date: today,
    finalizedCount: finalized.length,
    draftCount: drafts.length,
    criticalFindingsCount: 0, // would come from the critical findings audit trail
    followUpsDue: 0, // would come from the patient registry (patients with no follow-up scan)
    studyBreakdown,
    topFindings,
    revenueEstimate,
    avgTurnaroundMin,
  };
}
