/**
 * autoCompose.ts — deterministic Impression autopilot.
 *
 * Turns toggled chips + patient/OB data into impression lines. Pure functions
 * only — no AI. Critical registry, pathology catalog, LMP/Hadlock/growth-chart
 * calculators are imported, never re-implemented.
 */
import { scanForCriticalFindings } from "./criticalFindings";
import { getPathologyAny } from "./pathologies";
import { getStudy } from "./studies";
import { substitute } from "./composer";
import { hadlockEfw, meanGa, efwTolerance } from "./biometry";
import { buildGrowthChart } from "./growthChart";
import { isObStudyKey } from "./orderStudy";
import { lmpSummary, parseLmpInput } from "./lmp";

export type AutoComposeInput = {
  selectedChips: { organKey: string; chipKey: string }[];
  patient: { age?: number; sex?: "M" | "F"; lmp?: string };
  studyKey: string;
  /** Biometry in mm (same as the report slots); converted to cm for Hadlock. */
  biometry?: { bpd?: number; hc?: number; ac?: number; fl?: number };
};

export type AutoComposeResult = {
  lines: string[];
  criticalFirst: string[];
};

/** mm → cm for Hadlock inputs (matches UsgBiometryCalc). */
function mmToCm(mm: number | undefined): number | undefined {
  return typeof mm === "number" && Number.isFinite(mm) && mm > 0 ? mm / 10 : undefined;
}

/**
 * Compose an impression from chips + patient/OB context.
 *
 * Order: critical (bold) → abnormals (one line/organ) → OB auto-lines →
 * organ normal summaries. No chips + known study → study allNormalImpression
 * (clean normal). No chips + unknown study → empty.
 */
export function composeImpression(input: AutoComposeInput): AutoComposeResult {
  const study = getStudy(input.studyKey);

  // ── Empty / clean-normal ────────────────────────────────────────────────
  if (input.selectedChips.length === 0) {
    if (!study) return { lines: [], criticalFirst: [] };
    return {
      lines: [...(study.allNormalImpression ?? [])],
      criticalFirst: [],
    };
  }

  if (!study) return { lines: [], criticalFirst: [] };

  // ── 1. CRITICAL FIRST ───────────────────────────────────────────────────
  const selectedForScan = input.selectedChips.map((c) => {
    const p = getPathologyAny(c.chipKey);
    return {
      key: c.chipKey,
      label: p?.label ?? c.chipKey,
      organ: c.organKey,
    };
  });
  const alerts = scanForCriticalFindings(selectedForScan);
  const criticalFirst = alerts.map((a) => `**${a.message}**`);

  // ── 2. ABNORMALS — one line per organ with selected chips ───────────────
  const byOrgan = new Map<string, string[]>();
  for (const c of input.selectedChips) {
    const list = byOrgan.get(c.organKey) ?? [];
    list.push(c.chipKey);
    byOrgan.set(c.organKey, list);
  }

  const abnormalLines: string[] = [];
  for (const [organKey, chipKeys] of byOrgan) {
    const parts: string[] = [];
    for (const chipKey of chipKeys) {
      const p = getPathologyAny(chipKey);
      if (!p?.impression?.length) continue;
      for (const raw of p.impression) {
        const text = substitute(raw, {}, organKey).trim();
        if (text) parts.push(text);
      }
    }
    if (parts.length) abnormalLines.push(parts.join(" "));
  }

  // ── 3. OB AUTO-LINE ─────────────────────────────────────────────────────
  const obLines: string[] = [];
  if (isObStudyKey(input.studyKey)) {
    const lmpDate = input.patient.lmp ? parseLmpInput(input.patient.lmp) : null;
    if (lmpDate) {
      const sum = lmpSummary(lmpDate);
      obLines.push(`LMP GA: ${sum.weeks} weeks ${sum.days} days. EDD: ${sum.edd}.`);
    }

    if (input.biometry) {
      const cm = {
        bpd: mmToCm(input.biometry.bpd),
        hc: mmToCm(input.biometry.hc),
        ac: mmToCm(input.biometry.ac),
        fl: mmToCm(input.biometry.fl),
      };
      const best = hadlockEfw(cm).best;
      if (best) {
        const efwG = Math.round(best.efw);
        const ga = meanGa(cm);
        const gaWeeks = ga ? ga.weeks + ga.days / 7 : 0;
        const chart = buildGrowthChart("EFW", [{ gaWeeks, value: efwG }]);
        const pct = chart.plots[0]?.percentile;
        const tol = efwTolerance(best.efw);
        const pctLabel =
          pct != null ? `${pct}th percentile` : "percentile unavailable";
        obLines.push(`EFW (Hadlock): ${efwG} g (± ${tol} g), ${pctLabel}.`);
      }
    }
  }

  // ── 4. NORMALS — organs with no chips + study normalImpression ──────────
  const selectedOrgans = new Set(input.selectedChips.map((c) => c.organKey));
  const normalLines: string[] = [];
  for (const organ of study.organs) {
    if (selectedOrgans.has(organ.key)) continue;
    if (!organ.normalImpression?.trim()) continue;
    const text = substitute(organ.normalImpression, {}, organ.key).trim();
    if (text) normalLines.push(text);
  }
  if (
    study.upperGroupNormalLine &&
    !study.organs
      .filter((o) =>
        ["liver", "gb", "cbd", "pancreas", "spleen", "kidney_rt", "kidney_lt"].includes(o.key),
      )
      .some((o) => selectedOrgans.has(o.key))
  ) {
    // Upper abdomen all clear while a lower-organ chip is on — lead with the group line.
    const hasLower = study.organs.some(
      (o) =>
        !["liver", "gb", "cbd", "pancreas", "spleen", "kidney_rt", "kidney_lt"].includes(o.key) &&
        selectedOrgans.has(o.key),
    );
    if (hasLower && !normalLines.includes(study.upperGroupNormalLine)) {
      normalLines.unshift(study.upperGroupNormalLine);
    }
  }

  const lines = [...criticalFirst, ...abnormalLines, ...obLines, ...normalLines];
  return { lines, criticalFirst };
}
