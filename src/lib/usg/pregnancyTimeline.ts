/**
 * pregnancyTimeline.ts — pregnancy episode timeline for obstetric USG.
 *
 * When the sonologist opens an obstetric report, this module queries the
 * patient's past obstetric scans and builds a timeline showing GA + EFW +
 * key measurements across visits. This helps track fetal growth trajectory
 * and spot IUGR / macrosomia patterns.
 *
 * Ported from CARE ERP's usgPrior pregnancy timeline, simplified for the
 * standalone studio's SQLite data model.
 */

export type TimelinePoint = {
  reportId: number;
  scanDate: string;
  gaWeeks: number | null;
  gaDays: number | null;
  efw: number | null; // grams
  efwDisplay: string | null; // "1,250 g"
  bpd: number | null; // mm
  hc: number | null; // mm
  ac: number | null; // mm
  fl: number | null; // mm
  fetalPresentation: string | null;
  placentaPosition: string | null;
  liquorAfi: string | null;
  fhPresent: string | null;
  studyLabel: string;
  status: "draft" | "finalized";
};

export type PregnancyTimeline = {
  points: TimelinePoint[];
  totalVisits: number;
  earliestGa: number | null; // weeks
  latestGa: number | null; // weeks
  gaRangeDisplay: string | null; // "12 wk → 32 wk"
  efwTrend: "increasing" | "plateau" | "decreasing" | "insufficient";
  hasIugrRisk: boolean;
  hasMacrosomiaRisk: boolean;
};

/**
 * Build a pregnancy timeline from a patient's report history.
 *
 * @param reports — the patient's obstetric reports, oldest first
 * @returns the timeline with growth-trend analysis
 */
export function buildPregnancyTimeline(
  reports: Array<{
    id: number;
    scanDate: string | null;
    stateJson: string | null;
    studyKey: string | null;
    status: string;
  }>,
): PregnancyTimeline {
  const points: TimelinePoint[] = [];

  for (const r of reports) {
    if (!r.stateJson) continue;
    try {
      const state = JSON.parse(r.stateJson) as {
        studyKey?: string;
        organs?: Array<{
          organ: string;
          vars?: Record<string, string>;
          text?: string;
        }>;
      };

      // Only obstetric study profiles
      if (!state.studyKey || !state.studyKey.startsWith("ob-")) continue;

      const point = extractTimelinePoint(r, state);
      if (point) points.push(point);
    } catch {
      continue;
    }
  }

  // Sort by scan date ascending (oldest first)
  points.sort((a, b) => (a.scanDate ?? "").localeCompare(b.scanDate ?? ""));

  const totalVisits = points.length;
  const gaValues = points
    .map((p) => p.gaWeeks)
    .filter((g): g is number => g !== null);

  const earliestGa = gaValues.length > 0 ? Math.min(...gaValues) : null;
  const latestGa = gaValues.length > 0 ? Math.max(...gaValues) : null;

  const gaRangeDisplay = (earliestGa !== null && latestGa !== null && earliestGa !== latestGa)
    ? `${earliestGa} wk → ${latestGa} wk`
    : latestGa !== null ? `${latestGa} wk` : null;

  // EFW trend analysis
  const efwValues = points
    .map((p) => p.efw)
    .filter((e): e is number => e !== null);

  let efwTrend: PregnancyTimeline["efwTrend"] = "insufficient";
  if (efwValues.length >= 3) {
    const last3 = efwValues.slice(-3);
    const delta1 = last3[1]! - last3[0]!;
    const delta2 = last3[2]! - last3[1]!;
    if (delta2 > delta1 * 0.5) efwTrend = "increasing";
    else if (delta2 < delta1 * 0.2 && delta2 > 0) efwTrend = "plateau";
    else if (delta2 <= 0) efwTrend = "decreasing";
    else efwTrend = "increasing";
  }

  // IUGR risk: EFW below 10th percentile for GA (simplified Hadlock)
  const hasIugrRisk = points.some((p) => {
    if (!p.efw || !p.gaWeeks) return false;
    return p.efw < iugrThreshold(p.gaWeeks);
  });

  // Macrosomia risk: EFW above 4000g
  const hasMacrosomiaRisk = points.some((p) => p.efw !== null && p.efw >= 4000);

  return {
    points,
    totalVisits,
    earliestGa,
    latestGa,
    gaRangeDisplay,
    efwTrend,
    hasIugrRisk,
    hasMacrosomiaRisk,
  };
}

function extractTimelinePoint(
  report: { id: number; scanDate: string | null; studyKey: string | null; status: string },
  state: { studyKey?: string; organs?: Array<{ organ: string; vars?: Record<string, string>; text?: string }> },
): TimelinePoint | null {
  const organs = state.organs ?? [];
  const gaWeeks = extractInt(organs, "ob_ga", "weeks") ?? extractIntFromText(organs, "ob_ga", "wk");
  const gaDays = extractInt(organs, "ob_ga", "days") ?? extractIntFromText(organs, "ob_ga", "day");
  const efw = extractNumber(organs, "ob_efw", "efw", "g");
  const bpd = extractNumber(organs, "ob_bpd", "bpd", "mm");
  const hc = extractNumber(organs, "ob_hc", "hc", "mm");
  const ac = extractNumber(organs, "ob_ac", "ac", "mm");
  const fl = extractNumber(organs, "ob_fl", "fl", "mm");

  // Parse from text as fallback
  const fetalPresentation = extractFromText(organs, /presentation[:\s]+([^\n.]+)/i);
  const placentaPosition = extractFromText(organs, /placenta[:\s]+([^\n.]+)/i);
  const liquorAfi = extractFromText(organs, /afi[:\s]+([^\n.]+)/i);
  const fhPresent = extractFromText(organs, /fetal (heart|cardiac)[:\s]+([^\n.]+)/i);

  return {
    reportId: report.id,
    scanDate: report.scanDate ?? "",
    gaWeeks,
    gaDays,
    efw: efw,
    efwDisplay: efw !== null ? `${efw.toLocaleString("en-IN")} g` : null,
    bpd,
    hc,
    ac,
    fl,
    fetalPresentation: fetalPresentation,
    placentaPosition: placentaPosition,
    liquorAfi: liquorAfi,
    fhPresent: fhPresent,
    studyLabel: report.studyKey ?? "Obstetric",
    status: report.status === "finalized" ? "finalized" : "draft",
  };
}

function extractInt(organs: Array<{ organ: string; vars?: Record<string, string> }>, organ: string, varKey: string): number | null {
  const o = organs.find((o) => o.organ === organ);
  const v = o?.vars?.[varKey];
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function extractIntFromText(organs: Array<{ text?: string }>, _organ: string, pattern: string): number | null {
  const text = organs.map((o) => o.text ?? "").join(" ");
  const re = new RegExp(`(\\d+)\\s*${pattern}`, "i");
  const m = text.match(re);
  if (!m) return null;
  return parseInt(m[1]!, 10);
}

function extractNumber(organs: Array<{ organ: string; vars?: Record<string, string> }>, organ: string, varKey: string, _unit: string): number | null {
  const o = organs.find((o) => o.organ === organ);
  const v = o?.vars?.[varKey];
  if (!v) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function extractFromText(organs: Array<{ text?: string }>, re: RegExp): string | null {
  const text = organs.map((o) => o.text ?? "").join(" ");
  const m = text.match(re);
  return m ? m[1] ?? m[2] ?? null : null;
}

/**
 * Simplified IUGR threshold (EFW 10th percentile, Hadlock approximated).
 * If EFW is below this for the given GA, flag IUGR risk.
 */
function iugrThreshold(gaWeeks: number): number {
  // Rough 10th percentile EFW by GA (grams)
  const table: Record<number, number> = {
    20: 270, 22: 400, 24: 560, 26: 760, 28: 1000,
    30: 1300, 32: 1650, 34: 2050, 36: 2500, 38: 2950,
    40: 3350, 42: 3650,
  };
  // Interpolate
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  const lower = keys.filter((k) => k <= gaWeeks).pop() ?? keys[0]!;
  const upper = keys.filter((k) => k >= gaWeeks)[0] ?? keys[keys.length - 1]!;
  if (lower === upper) return table[lower]!;
  const ratio = (gaWeeks - lower) / (upper - lower);
  return Math.round(table[lower]! + ratio * (table[upper]! - table[lower]!));
}

/** Format GA as "28 wk 05 days". */
export function formatGa(weeks: number | null, days: number | null): string {
  if (weeks === null) return "—";
  const d = days ?? 0;
  return `${weeks} wk ${String(d).padStart(2, "0")} days`;
}
