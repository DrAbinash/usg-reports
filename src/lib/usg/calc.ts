/**
 * USG Studio — bedside clinical calculators (v5 phase 3).
 *
 * Small, pure, double-checked formulas the sonologist reaches for mid-report:
 *   • ellipsoid volume (0.523 × D1 × D2 × D3) — ovarian volumes, masses
 *   • bladder volume (0.52 × L × W × H) — post-void residual
 *   • prostate volume (0.52 × L × W × H) — TRUS, in cc
 *   • ACR TI-RADS 2017 thyroid nodule risk scoring (TR1–TR5 + FNA guidance)
 *   • AFI — amniotic fluid index quadrant sum
 */
/** Prolate ellipsoid: ovaries, masses, renal volumes (cc from cm). */
export function ellipsoidVolume(d1: number, d2: number, d3: number, coef = 0.523): number {
  return coef * d1 * d2 * d3;
}

/** Urinary bladder (pre- or post-void): 0.52 × L × W × H (cc from cm). */
export function bladderVolume(length: number, width: number, height: number): number {
  return 0.52 * length * width * height;
}

/** Post-void residual = post-void bladder volume (cc). */
export function postVoidResidual(postLength: number, postWidth: number, postHeight: number): number {
  return bladderVolume(postLength, postWidth, postHeight);
}

/** Prostate (TRUS, cc): the same prolate ellipsoid engine. */
export function prostateVolume(length: number, width: number, height: number): number {
  return 0.52 * length * width * height;
}

/** Amniotic fluid index — the four-quadrant sum (cm). */
export function afiTotal(q1: number, q2: number, q3: number, q4: number): number {
  return q1 + q2 + q3 + q4;
}

export function afiCategory(total: number): { label: string; abnormal: boolean } {
  if (total < 5) return { label: "Oligohydramnios", abnormal: true };
  if (total < 8) return { label: "Borderline low", abnormal: false };
  if (total <= 18) return { label: "Normal", abnormal: false };
  if (total <= 24) return { label: "Borderline high", abnormal: false };
  return { label: "Polyhydramnios", abnormal: true };
}

// ── ACR TI-RADS 2017 ───────────────────────────────────────────────────────

export type TiradsComposition = "cystic" | "spongiform" | "mixed" | "solid";
export type TiradsEchogenicity = "anechoic" | "hyperechoic_or_mixed" | "isoechoic" | "hypoechoic";
export type TiradsShape = "wider" | "taller";
export type TiradsMargin = "smooth_or_illdefined" | "lobulated_or_irregular" | "extra_thyroidal";
export type TiradsFocus = "none" | "comet_tail" | "macrocalcification" | "rim_calcification" | "punctate";

export type TiradsInput = {
  composition: TiradsComposition;
  echogenicity: TiradsEchogenicity;
  shape: TiradsShape;
  margin: TiradsMargin;
  foci: TiradsFocus[];
  /** Nodule size in mm — drives the FNA/follow-up size thresholds. */
  sizeMm?: number;
};

const COMPOSITION_POINTS: Record<TiradsComposition, number> = {
  cystic: 0,
  spongiform: 0,
  mixed: 1,
  solid: 2,
};

const ECHOGENICITY_POINTS: Record<TiradsEchogenicity, number> = {
  anechoic: 0,
  hyperechoic_or_mixed: 1,
  isoechoic: 2,
  hypoechoic: 3,
};

const MARGIN_POINTS: Record<TiradsMargin, number> = {
  smooth_or_illdefined: 0,
  lobulated_or_irregular: 2,
  extra_thyroidal: 3,
};

const FOCUS_POINTS: Record<TiradsFocus, number> = {
  none: 0,
  comet_tail: 0,
  macrocalcification: 1,
  rim_calcification: 2,
  punctate: 3,
};

export type TiradsResult = {
  points: number;
  category: "TR1" | "TR2" | "TR3" | "TR4" | "TR5";
  label: string;
  guidance: string;
};

/** ACR TI-RADS 2017 point scoring → TR category + size-based guidance. */
export function tiradsScore(input: TiradsInput): TiradsResult {
  // Special rules first: purely cystic nodules (no solid) and spongiform
  // nodules are TR1 benign — features are assessed in the solid component.
  if (input.composition === "cystic" || input.composition === "spongiform") {
    return {
      points: 0,
      category: "TR1",
      label: "Benign",
      guidance: "No FNA. Spongiform / purely cystic nodules — routine reassurance.",
    };
  }

  const points =
    COMPOSITION_POINTS[input.composition] +
    ECHOGENICITY_POINTS[input.echogenicity] +
    (input.shape === "taller" ? 3 : 0) +
    MARGIN_POINTS[input.margin] +
    input.foci.reduce((sum, f) => sum + FOCUS_POINTS[f], 0);

  let category: TiradsResult["category"];
  if (points === 0) category = "TR1";
  else if (points <= 2) category = "TR2";
  else if (points === 3) category = "TR3";
  else if (points <= 6) category = "TR4";
  else category = "TR5";

  const size = input.sizeMm;
  let guidance: string;
  switch (category) {
    case "TR1":
      guidance = "No FNA.";
      break;
    case "TR2":
      guidance = "No FNA.";
      break;
    case "TR3":
      guidance = size == null
        ? "FNA if ≥ 25 mm; follow-up if ≥ 15 mm."
        : size >= 25
          ? "FNA recommended (≥ 25 mm)."
          : size >= 15
            ? "Follow-up ultrasound recommended (≥ 15 mm, < 25 mm)."
            : "No FNA, no follow-up needed (< 15 mm).";
      break;
    case "TR4":
      guidance = size == null
        ? "FNA if ≥ 15 mm; follow-up if ≥ 10 mm."
        : size >= 15
          ? "FNA recommended (≥ 15 mm)."
          : size >= 10
            ? "Follow-up ultrasound recommended (≥ 10 mm, < 15 mm)."
            : "No FNA, no follow-up needed (< 10 mm).";
      break;
    case "TR5":
      guidance = size == null
        ? "FNA if ≥ 10 mm."
        : size >= 10
          ? "FNA recommended (≥ 10 mm)."
          : "Follow-up ultrasound recommended (< 10 mm).";
      break;
  }

  const labels: Record<TiradsResult["category"], string> = {
    TR1: "Benign",
    TR2: "Not suspicious",
    TR3: "Mildly suspicious",
    TR4: "Moderately suspicious",
    TR5: "Highly suspicious",
  };

  return { points, category, label: labels[category], guidance };
}

/** Nicely printable one-liner for the calculators panel / clipboard. */
export function formatVolume(label: string, cc: number): string {
  return `${label}: ${cc.toFixed(1)} cc`;
}
