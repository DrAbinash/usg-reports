/**
 * growthChart.ts — Hadlock growth chart percentile data for obstetric USG.
 *
 * Feature 4: Plot the patient's EFW/BPD/HC/AC/FL on standard growth curves.
 * The doctor sees at a glance whether growth is on track, IUGR, or macrosomia.
 *
 * Data is approximated from published Hadlock equations (1984/1985) —
 * the same equations used by the biometry engine. Percentile curves are
 * pre-computed at 2-week intervals from 14 to 42 weeks.
 */

export type GrowthCurve = {
  gaWeeks: number;
  p3: number;
  p10: number;
  p50: number;
  p90: number;
  p97: number;
};

export type GrowthPlot = {
  gaWeeks: number;
  value: number;
  percentile: number | null;
  label: string;
};

export type GrowthChart = {
  parameter: "EFW" | "BPD" | "HC" | "AC" | "FL";
  unit: string;
  curves: GrowthCurve[];
  plots: GrowthPlot[];
  below_10: boolean;
  above_90: boolean;
};

// ── EFW (g) — Hadlock 1985 ──────────────────────────────────────────────────
const EFW_CURVES: GrowthCurve[] = [
  { gaWeeks: 14, p3: 50, p10: 65, p50: 110, p90: 170, p97: 210 },
  { gaWeeks: 16, p3: 100, p10: 130, p50: 200, p90: 290, p97: 350 },
  { gaWeeks: 18, p3: 180, p10: 220, p50: 330, p90: 460, p97: 540 },
  { gaWeeks: 20, p3: 270, p10: 330, p50: 460, p90: 630, p97: 730 },
  { gaWeeks: 22, p3: 400, p10: 480, p50: 660, p90: 880, p97: 1020 },
  { gaWeeks: 24, p3: 560, p10: 670, p50: 900, p90: 1180, p97: 1360 },
  { gaWeeks: 26, p3: 760, p10: 900, p50: 1200, p90: 1560, p97: 1790 },
  { gaWeeks: 28, p3: 1000, p10: 1180, p50: 1550, p90: 2010, p97: 2300 },
  { gaWeeks: 30, p3: 1300, p10: 1520, p50: 1980, p90: 2550, p97: 2920 },
  { gaWeeks: 32, p3: 1650, p10: 1910, p50: 2470, p90: 3170, p97: 3630 },
  { gaWeeks: 34, p3: 2050, p10: 2360, p50: 3030, p90: 3870, p97: 4430 },
  { gaWeeks: 36, p3: 2500, p10: 2860, p50: 3650, p90: 4640, p97: 5310 },
  { gaWeeks: 38, p3: 2950, p10: 3350, p50: 4250, p90: 5380, p97: 6160 },
  { gaWeeks: 40, p3: 3350, p10: 3780, p50: 4780, p90: 6040, p97: 6920 },
  { gaWeeks: 42, p3: 3650, p10: 4120, p50: 5210, p90: 6580, p97: 7550 },
];

// ── BPD (mm) — Hadlock 1984 ────────────────────────────────────────────────
const BPD_CURVES: GrowthCurve[] = [
  { gaWeeks: 14, p3: 22, p10: 24, p50: 28, p90: 32, p97: 34 },
  { gaWeeks: 16, p3: 30, p10: 32, p50: 36, p90: 40, p97: 42 },
  { gaWeeks: 18, p3: 38, p10: 40, p50: 44, p90: 48, p97: 50 },
  { gaWeeks: 20, p3: 44, p10: 46, p50: 50, p90: 54, p97: 56 },
  { gaWeeks: 22, p3: 50, p10: 52, p50: 56, p90: 60, p97: 62 },
  { gaWeeks: 24, p3: 56, p10: 58, p50: 62, p90: 66, p97: 68 },
  { gaWeeks: 26, p3: 62, p10: 64, p50: 68, p90: 72, p97: 74 },
  { gaWeeks: 28, p3: 67, p10: 69, p50: 73, p90: 77, p97: 79 },
  { gaWeeks: 30, p3: 72, p10: 74, p50: 78, p90: 82, p97: 84 },
  { gaWeeks: 32, p3: 76, p10: 78, p50: 82, p90: 86, p97: 88 },
  { gaWeeks: 34, p3: 80, p10: 82, p50: 86, p90: 90, p97: 92 },
  { gaWeeks: 36, p3: 83, p10: 85, p50: 89, p90: 93, p97: 95 },
  { gaWeeks: 38, p3: 86, p10: 88, p50: 92, p90: 96, p97: 98 },
  { gaWeeks: 40, p3: 88, p10: 90, p50: 94, p90: 98, p97: 100 },
  { gaWeeks: 42, p3: 89, p10: 91, p50: 95, p90: 99, p97: 101 },
];

// ── HC (mm) — Hadlock 1984 ────────────────────────────────────────────────
const HC_CURVES: GrowthCurve[] = [
  { gaWeeks: 14, p3: 85, p10: 92, p50: 110, p90: 128, p97: 135 },
  { gaWeeks: 16, p3: 110, p10: 120, p50: 140, p90: 160, p97: 170 },
  { gaWeeks: 18, p3: 135, p10: 145, p50: 170, p90: 195, p97: 205 },
  { gaWeeks: 20, p3: 160, p10: 170, p50: 195, p90: 220, p97: 230 },
  { gaWeeks: 22, p3: 180, p10: 195, p50: 220, p90: 245, p97: 260 },
  { gaWeeks: 24, p3: 200, p10: 215, p50: 245, p90: 270, p97: 285 },
  { gaWeeks: 26, p3: 220, p10: 235, p50: 265, p90: 295, p97: 310 },
  { gaWeeks: 28, p3: 240, p10: 255, p50: 290, p90: 320, p97: 335 },
  { gaWeeks: 30, p3: 255, p10: 275, p50: 310, p90: 345, p97: 360 },
  { gaWeeks: 32, p3: 270, p10: 290, p50: 330, p90: 365, p97: 380 },
  { gaWeeks: 34, p3: 285, p10: 305, p50: 345, p90: 385, p97: 400 },
  { gaWeeks: 36, p3: 295, p10: 315, p50: 360, p90: 400, p97: 415 },
  { gaWeeks: 38, p3: 305, p10: 325, p50: 370, p90: 410, p97: 425 },
  { gaWeeks: 40, p3: 310, p10: 330, p50: 375, p90: 420, p97: 435 },
  { gaWeeks: 42, p3: 315, p10: 335, p50: 380, p90: 425, p97: 440 },
];

// ── AC (mm) — Hadlock 1984 ────────────────────────────────────────────────
const AC_CURVES: GrowthCurve[] = [
  { gaWeeks: 14, p3: 55, p10: 62, p50: 78, p90: 94, p97: 101 },
  { gaWeeks: 16, p3: 75, p10: 85, p50: 105, p90: 125, p97: 135 },
  { gaWeeks: 18, p3: 95, p10: 108, p50: 132, p90: 156, p97: 168 },
  { gaWeeks: 20, p3: 115, p10: 130, p50: 158, p90: 186, p97: 200 },
  { gaWeeks: 22, p3: 135, p10: 152, p50: 185, p90: 218, p97: 234 },
  { gaWeeks: 24, p3: 155, p10: 175, p50: 213, p90: 250, p97: 268 },
  { gaWeeks: 26, p3: 175, p10: 197, p50: 240, p90: 283, p97: 304 },
  { gaWeeks: 28, p3: 195, p10: 218, p50: 265, p90: 313, p97: 336 },
  { gaWeeks: 30, p3: 215, p10: 240, p50: 290, p90: 340, p97: 365 },
  { gaWeeks: 32, p3: 235, p10: 260, p50: 315, p90: 370, p97: 395 },
  { gaWeeks: 34, p3: 255, p10: 280, p50: 340, p90: 400, p97: 425 },
  { gaWeeks: 36, p3: 275, p10: 300, p50: 365, p90: 430, p97: 455 },
  { gaWeeks: 38, p3: 290, p10: 315, p50: 385, p90: 455, p97: 480 },
  { gaWeeks: 40, p3: 300, p10: 325, p50: 400, p90: 475, p97: 500 },
  { gaWeeks: 42, p3: 305, p10: 330, p50: 410, p90: 490, p97: 515 },
];

// ── FL (mm) — Hadlock 1984 ────────────────────────────────────────────────
const FL_CURVES: GrowthCurve[] = [
  { gaWeeks: 14, p3: 8, p10: 10, p50: 14, p90: 18, p97: 20 },
  { gaWeeks: 16, p3: 14, p10: 16, p50: 20, p90: 24, p97: 26 },
  { gaWeeks: 18, p3: 20, p10: 22, p50: 26, p90: 30, p97: 32 },
  { gaWeeks: 20, p3: 26, p10: 28, p50: 32, p90: 36, p97: 38 },
  { gaWeeks: 22, p3: 32, p10: 34, p50: 38, p90: 42, p97: 44 },
  { gaWeeks: 24, p3: 37, p10: 39, p50: 43, p90: 47, p97: 49 },
  { gaWeeks: 26, p3: 42, p10: 44, p50: 48, p90: 52, p97: 54 },
  { gaWeeks: 28, p3: 47, p10: 49, p50: 53, p90: 57, p97: 59 },
  { gaWeeks: 30, p3: 51, p10: 53, p50: 57, p90: 61, p97: 63 },
  { gaWeeks: 32, p3: 55, p10: 57, p50: 61, p90: 65, p97: 67 },
  { gaWeeks: 34, p3: 58, p10: 60, p50: 64, p90: 68, p97: 70 },
  { gaWeeks: 36, p3: 61, p10: 63, p50: 67, p90: 71, p97: 73 },
  { gaWeeks: 38, p3: 63, p10: 65, p50: 69, p90: 73, p97: 75 },
  { gaWeeks: 40, p3: 65, p10: 67, p50: 71, p90: 75, p97: 77 },
  { gaWeeks: 42, p3: 66, p10: 68, p50: 72, p90: 76, p97: 78 },
];

const CURVES: Record<GrowthChart["parameter"], GrowthCurve[]> = {
  EFW: EFW_CURVES,
  BPD: BPD_CURVES,
  HC: HC_CURVES,
  AC: AC_CURVES,
  FL: FL_CURVES,
};

const UNITS: Record<GrowthChart["parameter"], string> = {
  EFW: "g",
  BPD: "mm",
  HC: "mm",
  AC: "mm",
  FL: "mm",
};

/**
 * Interpolate percentile at a given GA.
 */
function interpolate(curves: GrowthCurve[], gaWeeks: number): GrowthCurve | null {
  if (curves.length === 0) return null;
  if (gaWeeks <= curves[0]!.gaWeeks) return curves[0];
  if (gaWeeks >= curves[curves.length - 1]!.gaWeeks) return curves[curves.length - 1]!;

  for (let i = 0; i < curves.length - 1; i++) {
    const a = curves[i]!;
    const b = curves[i + 1]!;
    if (gaWeeks >= a.gaWeeks && gaWeeks <= b.gaWeeks) {
      const ratio = (gaWeeks - a.gaWeeks) / (b.gaWeeks - a.gaWeeks);
      return {
        gaWeeks,
        p3: Math.round(a.p3 + ratio * (b.p3 - a.p3)),
        p10: Math.round(a.p10 + ratio * (b.p10 - a.p10)),
        p50: Math.round(a.p50 + ratio * (b.p50 - a.p50)),
        p90: Math.round(a.p90 + ratio * (b.p90 - a.p90)),
        p97: Math.round(a.p97 + ratio * (b.p97 - a.p97)),
      };
    }
  }
  return curves[curves.length - 1]!;
}

/**
 * Estimate percentile from a value and the curve at that GA.
 */
function estimatePercentile(value: number, curve: GrowthCurve): number | null {
  if (value <= curve.p3) return 3;
  if (value >= curve.p97) return 97;
  if (value <= curve.p10) return Math.round(3 + (value - curve.p3) / (curve.p10 - curve.p3) * 7);
  if (value <= curve.p50) return Math.round(10 + (value - curve.p10) / (curve.p50 - curve.p10) * 40);
  if (value <= curve.p90) return Math.round(50 + (value - curve.p50) / (curve.p90 - curve.p50) * 40);
  return Math.round(90 + (value - curve.p90) / (curve.p97 - curve.p90) * 7);
}

/**
 * Build a growth chart for a parameter from a list of (GA, value) points.
 */
export function buildGrowthChart(
  parameter: GrowthChart["parameter"],
  points: Array<{ gaWeeks: number; value: number }>,
): GrowthChart {
  const curves = CURVES[parameter];
  const unit = UNITS[parameter];
  const plots: GrowthPlot[] = points
    .filter((p) => p.gaWeeks > 0 && p.value > 0)
    .map((p) => {
      const curve = interpolate(curves, p.gaWeeks);
      const percentile = curve ? estimatePercentile(p.value, curve) : null;
      return {
        gaWeeks: p.gaWeeks,
        value: p.value,
        percentile,
        label: `${parameter} ${p.value} ${unit} @ ${p.gaWeeks}wk`,
      };
    });

  const below_10 = plots.some((p) => p.percentile !== null && p.percentile < 10);
  const above_90 = plots.some((p) => p.percentile !== null && p.percentile > 90);

  return { parameter, unit, curves, plots, below_10, above_90 };
}
