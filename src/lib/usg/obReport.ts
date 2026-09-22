/**
 * v6.19 — Antenatal OB report builder.
 * Computes Hadlock-derived GA/EFW/EDD from composer state, builds the
 * impression sentence in Dr. Sugandha's grammar, and formats the print body.
 * Dr. Sugandha's AFI rule: default "Adequate" before 20w; number in cm after.
 */
import { hadlockEfw, perParameterGa, meanGa, eddFromGa, efwTolerance, weeksDays, type BiometryCm } from "./biometry";

export type ObState = {
  presentation?: string;
  bpdMm?: number; hcMm?: number; acMm?: number; flMm?: number;
  efwMachine?: number; gaMachine?: string; eddMachine?: string;
  fhr?: number; fhrRhythm?: "Regular" | "Irregular";
  anomaliesDetected?: boolean; anomaliesNote?: string;
  placentaPosition?: string; placentaGrade?: string;
  placentaLowerSegment?: string; internalOs?: string;
  liquorAfi?: string; // "Adequate" or numeric string (cm)
  scanDate?: Date;
};

export type ObSummary = {
  biometry: BiometryCm;
  perParamGa: Partial<Record<keyof BiometryCm, { weeks: number; days: number }>>;
  meanGa: { weeks: number; days: number } | null;
  efw: { grams: number; tolerance: number } | null;
  edd: Date | null;
  afiLabel: string;
  impression: string;
};

export function afiLabel(rawAfi: string | undefined, gaWeeks: number | undefined): string {
  if (!rawAfi || rawAfi.trim() === "" || rawAfi === "Adequate") return "Adequate";
  const n = Number(rawAfi);
  if (!Number.isFinite(n)) return rawAfi;
  return `${n} cm`;
}

const PRESENTATIONS = ["cephalic", "breech", "transverse", "oblique"];
const PLACENTA_POSITIONS = ["Anterior", "Posterior", "Fundal", "Right lateral", "Left lateral", "Low-lying"];
const PLACENTA_GRADES = ["0", "I", "II", "III"];
const LOWER_SEG_EXT = ["Not extending to lower segment", "Extending to lower segment", "Covering internal os"];
const INTERNAL_OS = ["Closed", "Open"];

export function computeObSummary(ob: ObState): ObSummary {
  const biometry: BiometryCm = {
    bpd: ob.bpdMm ? ob.bpdMm / 10 : undefined,
    hc: ob.hcMm ? ob.hcMm / 10 : undefined,
    ac: ob.acMm ? ob.acMm / 10 : undefined,
    fl: ob.flMm ? ob.flMm / 10 : undefined,
  };
  const perParamGa = perParameterGa(biometry);
  const mean = meanGa(biometry);
  const efwResult = hadlockEfw(biometry).best;
  const efw = efwResult ? { grams: efwResult.value, tolerance: efwTolerance(efwResult.value) } : null;
  const gaWeeks = mean ? mean.weeks : undefined;
  const edd = mean ? eddFromGa(mean.weeks, mean.days, ob.scanDate ?? new Date()) : null;
  const afi = afiLabel(ob.liquorAfi, gaWeeks);
  const impression = buildObImpression(ob, mean, gaWeeks);
  return { biometry, perParamGa, meanGa: mean, efw, edd, afiLabel: afi, impression };
}

function buildObImpression(ob: ObState, mean: { weeks: number; days: number } | null, gaWeeks: number | undefined): string {
  const pres = (ob.presentation ?? "cephalic").toLowerCase();
  if (!mean) return `A single live intrauterine fetus in ${pres} presentation.`;
  return `A single live intrauterine fetus at ${mean.weeks} weeks ${String(mean.days).padStart(2, "0")} days of average gestational age in ${pres} presentation.`;
}

/** Print body — the bullet list that follows "ANTENATAL SCAN" heading. */
export function buildObFindingsHtml(ob: ObState, summary: ObSummary): string {
  const pres = (ob.presentation ?? "cephalic").toLowerCase();
  const row = (label: string, mm: number | undefined, ga: { weeks: number; days: number } | undefined) => {
    if (!mm) return "";
    const gaText = ga ? `${ga.weeks} Weeks ${String(ga.days).padStart(2, "0")} Days` : "—";
    return `<tr><td>${label}</td><td>${mm} mm</td><td>${gaText}</td></tr>`;
  };
  const biometryTable = `
<table class="ob-bio">
  <thead><tr><th>Parameter</th><th>Value</th><th>Gestational Age</th></tr></thead>
  <tbody>
    ${row("B.P.D", ob.bpdMm, summary.perParamGa.bpd)}
    ${row("H.C", ob.hcMm, summary.perParamGa.hc)}
    ${row("A.C", ob.acMm, summary.perParamGa.ac)}
    ${row("F.L", ob.flMm, summary.perParamGa.fl)}
  </tbody>
</table>`;
  const meanLine = summary.meanGa
    ? `Mean GA: <b>${summary.meanGa.weeks} weeks ${String(summary.meanGa.days).padStart(2, "0")} days</b> (± 2 weeks)`
    : "";
  const eddLine = summary.edd
    ? `E.D.D. as per scan: <b>${summary.edd.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })}</b>`
    : (ob.eddMachine ? `E.D.D. as per machine: <b>${ob.eddMachine}</b>` : "");
  const weightLine = summary.efw
    ? `Fetal weight: <b>${summary.efw.grams} (± ${summary.efw.tolerance}) g</b>`
    : (ob.efwMachine ? `Fetal weight (machine): <b>${ob.efwMachine} g</b>` : "");
  const fhrLine = ob.fhr ? `FHR: <b>${ob.fhr} b/min</b>${ob.fhrRhythm ? `, ${ob.fhrRhythm}` : ""}` : "";
  const anomaliesLine = ob.anomaliesDetected
    ? `Fetal anomalies: <b>${ob.anomaliesNote || "Detected — see findings"}</b>`
    : "No gross fetal congenital anomalies detected.";
  const placentaLine = [ob.placentaPosition, ob.placentaGrade ? `Grade ${ob.placentaGrade}` : null]
    .filter(Boolean).join(", ") || "Placenta visualised";
  const placentaFull = `Placenta: ${placentaLine}. ${ob.placentaLowerSegment ?? ""}${ob.internalOs ? ` Internal os is ${ob.internalOs.toLowerCase()}.` : ""}`.trim();
  const liquorLine = `Liquor AFI: <b>${summary.afiLabel}</b>`;
  return `
<p>There is a single live intrauterine fetus in <b>${pres}</b> presentation at the time of examination.</p>
<p><b>Fetal parameters:</b></p>
${biometryTable}
<ul class="ob-bullets">
  ${meanLine ? `<li>${meanLine}</li>` : ""}
  ${eddLine ? `<li>${eddLine}</li>` : ""}
  ${weightLine ? `<li>${weightLine}</li>` : ""}
  ${fhrLine ? `<li>${fhrLine}</li>` : ""}
  <li>${anomaliesLine}</li>
  <li>${placentaFull}</li>
  <li>${liquorLine}</li>
</ul>`;
}

export { PRESENTATIONS, PLACENTA_POSITIONS, PLACENTA_GRADES, LOWER_SEG_EXT, INTERNAL_OS };
