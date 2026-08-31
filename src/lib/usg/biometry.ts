/**
 * USG Studio — obstetric biometry engine (v5 phase 3).
 *
 * Hadlock equations, exactly as published (inputs in cm, EFW in grams):
 *   • EFW — Hadlock et al., Radiology 1985;154:501 (log10-weight equations)
 *   • GA  — Hadlock et al., J Ultrasound Med 1984 (Table 1 regressions;
 *     "Menstrual Age" in weeks). Parameter-combination equations as
 *     tabulated by perinatology.com's Hadlock calculator.
 *
 * "Best" picks the equation using the most entered parameters — the more
 * parameters, the lower the standard error of the estimate.
 */

export type BiometryCm = { bpd?: number; hc?: number; ac?: number; fl?: number };

export type EfwFormula = {
  key: "H1" | "H2" | "H3" | "H4";
  name: string;
  params: (keyof BiometryCm)[];
  efw: number; // grams
};

const num = (v: number | undefined): number | undefined =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined;

function log10efw(x: number): number {
  return Math.pow(10, x);
}

/** All Hadlock EFW equations computable from the entered biometry (cm). */
export function hadlockEfw(input: BiometryCm): { formulas: EfwFormula[]; best: EfwFormula | null } {
  const bpd = num(input.bpd);
  const hc = num(input.hc);
  const ac = num(input.ac);
  const fl = num(input.fl);
  const formulas: EfwFormula[] = [];

  if (ac && fl) {
    formulas.push({
      key: "H1",
      name: "Hadlock (AC + FL)",
      params: ["ac", "fl"],
      efw: log10efw(1.304 + 0.05281 * ac + 0.1938 * fl - 0.004 * ac * fl),
    });
  }
  if (bpd && ac && fl) {
    formulas.push({
      key: "H2",
      name: "Hadlock (BPD + AC + FL)",
      params: ["bpd", "ac", "fl"],
      efw: log10efw(1.335 - 0.0034 * ac * fl + 0.0316 * bpd + 0.0457 * ac + 0.1623 * fl),
    });
  }
  if (hc && ac && fl) {
    formulas.push({
      key: "H3",
      name: "Hadlock (HC + AC + FL)",
      params: ["hc", "ac", "fl"],
      efw: log10efw(1.326 - 0.00326 * ac * fl + 0.0107 * hc + 0.0438 * ac + 0.158 * fl),
    });
  }
  if (bpd && hc && ac && fl) {
    formulas.push({
      key: "H4",
      name: "Hadlock (BPD + HC + AC + FL)",
      params: ["bpd", "hc", "ac", "fl"],
      efw: log10efw(1.3596 - 0.00386 * ac * fl + 0.0064 * hc + 0.00061 * bpd * ac + 0.0424 * ac + 0.174 * fl),
    });
  }

  const best = formulas.length
    ? formulas.reduce((a, b) => (b.params.length > a.params.length ? b : a))
    : null;
  return { formulas, best };
}

export type GaEstimate = { weeks: number; days: number; formula: string };

/** weeks → { whole weeks, leftover days } (Hadlock rounding). */
export function weeksDays(ma: number): { weeks: number; days: number } {
  const totalDays = Math.round(ma * 7);
  return { weeks: Math.floor(totalDays / 7), days: totalDays % 7 };
}

/** Single-parameter GA regressions — one estimate per entered parameter. */
export function perParameterGa(input: BiometryCm): Partial<Record<keyof BiometryCm, { weeks: number; days: number }>> {
  const out: Partial<Record<keyof BiometryCm, { weeks: number; days: number }>> = {};
  const bpd = num(input.bpd);
  const hc = num(input.hc);
  const ac = num(input.ac);
  const fl = num(input.fl);
  if (bpd) out.bpd = weeksDays(9.54 + 1.482 * bpd + 0.1676 * bpd * bpd);
  if (hc) out.hc = weeksDays(8.96 + 0.54 * hc + 0.0003 * hc * hc * hc);
  if (ac) out.ac = weeksDays(8.14 + 0.753 * ac + 0.0036 * ac * ac);
  if (fl) out.fl = weeksDays(10.35 + 2.46 * fl + 0.17 * fl * fl);
  return out;
}

/** GA multi-parameter combination equations, ranked by parameter count. */
const GA_COMBOS: { params: (keyof BiometryCm)[]; formula: (v: Required<BiometryCm>) => number; label: string }[] = [
  { params: ["bpd", "hc", "ac", "fl"], label: "BPD+HC+AC+FL", formula: (v) => 10.85 + 0.06 * v.hc * v.fl + 0.67 * v.bpd + 0.168 * v.ac },
  { params: ["hc", "ac", "bpd"], label: "HC+AC+BPD", formula: (v) => 10.58 + 0.005 * v.hc * v.hc + 0.3635 * v.ac + 0.02864 * v.bpd * v.ac },
  { params: ["hc", "ac", "fl"], label: "HC+AC+FL", formula: (v) => 10.33 + 0.031 * v.hc * v.fl + 0.361 * v.hc + 0.0298 * v.ac * v.fl },
  { params: ["bpd", "ac", "fl"], label: "BPD+AC+FL", formula: (v) => 10.61 + 0.175 * v.bpd * v.fl + 0.297 * v.ac + 0.71 * v.fl },
  { params: ["bpd", "hc", "fl"], label: "BPD+HC+FL", formula: (v) => 11.38 + 0.07 * v.hc * v.fl + 0.98 * v.bpd },
  { params: ["bpd", "hc"], label: "BPD+HC", formula: (v) => 10.32 + 0.009 * v.hc * v.hc + 1.32 * v.bpd + 0.00012 * v.hc * v.hc * v.hc },
  { params: ["bpd", "fl"], label: "BPD+FL", formula: (v) => 10.5 + 0.197 * v.bpd * v.fl + 0.95 * v.fl + 0.73 * v.bpd },
  { params: ["hc", "ac"], label: "HC+AC", formula: (v) => 10.31 + 0.012 * v.hc * v.hc + 0.385 * v.ac },
  { params: ["hc", "fl"], label: "HC+FL", formula: (v) => 11.19 + 0.07 * v.hc * v.fl + 0.263 * v.hc },
  { params: ["ac", "fl"], label: "AC+FL", formula: (v) => 10.47 + 0.442 * v.ac + 0.314 * v.fl * v.fl - 0.0121 * v.fl * v.fl * v.fl },
  { params: ["bpd", "ac"], label: "BPD+AC", formula: (v) => 9.57 + 0.524 * v.ac + 0.122 * v.bpd * v.bpd },
  { params: ["bpd"], label: "BPD", formula: (v) => 9.54 + 1.482 * v.bpd + 0.1676 * v.bpd * v.bpd },
  { params: ["hc"], label: "HC", formula: (v) => 8.96 + 0.54 * v.hc + 0.0003 * v.hc * v.hc * v.hc },
  { params: ["ac"], label: "AC", formula: (v) => 8.14 + 0.753 * v.ac + 0.0036 * v.ac * v.ac },
  { params: ["fl"], label: "FL", formula: (v) => 10.35 + 2.46 * v.fl + 0.17 * v.fl * v.fl },
];

/** Mean GA from the best available parameter combination (weeks + days). */
export function meanGa(input: BiometryCm): GaEstimate | null {
  const v: Required<BiometryCm> = { bpd: 0, hc: 0, ac: 0, fl: 0 };
  const have: (keyof BiometryCm)[] = [];
  for (const k of ["bpd", "hc", "ac", "fl"] as const) {
    const x = num(input[k]);
    if (x) {
      v[k] = x;
      have.push(k);
    }
  }
  if (!have.length) return null;
  for (const combo of GA_COMBOS) {
    if (combo.params.every((p) => have.includes(p))) {
      const ma = combo.formula(v);
      return { ...weeksDays(ma), formula: `Hadlock ${combo.label}` };
    }
  }
  return null;
}

/** EDD implied by a GA measured on a scan date: EDD = scan + (280 − GA days). */
export function eddFromGa(gaWeeks: number, gaDays: number, scanDate: Date): Date {
  const gaTotalDays = Math.round(gaWeeks * 7 + gaDays);
  const edd = new Date(scanDate.getFullYear(), scanDate.getMonth(), scanDate.getDate());
  edd.setDate(edd.getDate() + (280 - gaTotalDays));
  return edd;
}

/** ± range printed with EFW — 15% of the estimate, rounded to 10 g. */
export function efwTolerance(efw: number): number {
  return Math.round((efw * 0.15) / 10) * 10;
}
