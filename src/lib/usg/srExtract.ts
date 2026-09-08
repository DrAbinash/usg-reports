/**
 * srExtract.ts — DICOM SR measurement extraction, ported from the CARE ERP's
 * usgExtractor.parseDicomSr (the same ContentSequence walker, the same tag
 * addresses) and re-mapped onto THIS studio's composer variable slots.
 *
 * The machine's Structured Report is the highest-fidelity source there is:
 * measurements come as typed numbers with units, not burned-in pixels. When
 * the USG machine stores an SR alongside its images in Orthanc, "Pull from
 * machine" fills the report's biometry slots with zero typing.
 *
 * Pure functions only — unit-tested against a trimmed GE-style SR fixture.
 */
import { getStudy } from "./studies";

export type SrMeasurement = {
  conceptName: string;
  value: string;
  unit: string;
  path?: string;
};

/** Parse DICOM Structured Report measurement sequences from DICOM-JSON. */
export function parseDicomSr(metadataJson: string): SrMeasurement[] {
  const measurements: SrMeasurement[] = [];
  try {
    const obj = JSON.parse(metadataJson) as Record<string, unknown>;

    function tag(o: Record<string, unknown>, t: string): string {
      const v = (o[t] as { Value?: unknown[] } | undefined)?.Value;
      return v && v.length ? String(v[0]) : "";
    }

    // Recursive walker over ContentSequence items
    function walk(node: Record<string, unknown>, currentPath = "ContentSequence"): void {
      const cs = node["0040A730"] as { Value?: unknown[] } | undefined;
      const items = cs?.Value ?? [];
      items.forEach((item, index) => {
        const seq = item as Record<string, unknown>;
        if (!seq || typeof seq !== "object") return;
        const path = `${currentPath}[${index}]`;
        const valueType = (seq["0040A040"] as { Value?: string[] })?.Value?.[0] ?? "";

        function conceptName(s: Record<string, unknown>): string {
          const cns = (s["0040A043"] as { Value?: unknown[] } | undefined)?.Value?.[0] as
            | Record<string, unknown>
            | undefined;
          if (!cns) return "";
          return (cns["00080104"] as { Value?: string[] })?.Value?.[0] ?? "";
        }

        function measuredValue(s: Record<string, unknown>): { value: string; unit: string } {
          const mvs = (s["0040A300"] as { Value?: unknown[] } | undefined)?.Value?.[0] as
            | Record<string, unknown>
            | undefined;
          if (!mvs) return { value: "", unit: "" };
          const numVal = (mvs["0040A30A"] as { Value?: number[] })?.Value?.[0];
          const unitSeq = (mvs["004008EA"] as { Value?: unknown[] } | undefined)?.Value?.[0] as
            | Record<string, unknown>
            | undefined;
          const unit = (unitSeq?.["00080100"] as { Value?: string[] })?.Value?.[0] ?? "";
          return { value: numVal !== undefined ? String(numVal) : "", unit };
        }

        if (valueType === "NUM") {
          const name = conceptName(seq);
          const { value, unit } = measuredValue(seq);
          if (name && value) {
            measurements.push({ conceptName: name, value, unit, path });
          }
        }
        walk(seq, path);
      });
    }

    walk(obj);
  } catch {
    // Non-fatal — malformed metadata simply yields no measurements.
  }
  return measurements;
}

// ── Mapping onto this studio's composer slots ──────────────────────────────

/** One mapping row: SR concept pattern → organ var slot + normalisation. */
type VarMap = {
  re: RegExp;
  organ: string;
  varKey: string;
  /** "mm" (convert cm→mm), "cm" (convert mm→cm at 1 decimal), "raw" (verbatim), "g", "bpm". */
  unit: "mm" | "cm" | "raw" | "g" | "bpm";
};

const VAR_MAP: VarMap[] = [
  // Obstetric biometry — the ANTENATAL_SCAN format's slots (mm)
  { re: /^biparietal diameter$|(^|\b)bpd(\b|$)/i, organ: "biometry", varKey: "bpd", unit: "mm" },
  { re: /head circumference|(^|\b)hc(\b|$)/i, organ: "biometry", varKey: "hc", unit: "mm" },
  { re: /abdominal circumference|(^|\b)ac(\b|$)/i, organ: "biometry", varKey: "ac", unit: "mm" },
  { re: /femur (length|diaphysis)|(^|\b)fl(\b|$)/i, organ: "biometry", varKey: "fl", unit: "mm" },
  { re: /crown.?rump|(^|\b)crl(\b|$)/i, organ: "gravid-uterus", varKey: "crl", unit: "mm" },
  { re: /fetal heart rate|(^|\b)fhr(\b|$)/i, organ: "biometry", varKey: "fhr", unit: "bpm" },
  { re: /estimated fetal weight|(^|\b)efw(\b|$)/i, organ: "biometry", varKey: "ewt", unit: "g" },
  { re: /amniotic fluid|(^|\b)afi(\b|$)|liquor/i, organ: "liquor", varKey: "afi", unit: "cm" },

  // Early pregnancy also prints CRL on the gravid-uterus format
  { re: /crown.?rump|(^|\b)crl(\b|$)/i, organ: "biometry", varKey: "crl", unit: "mm" },

  // General organs — every measured study's slots
  { re: /(right|rt\.?) (kidney|renal)/i, organ: "kidney_rt", varKey: "span", unit: "cm" },
  { re: /(left|lt\.?) (kidney|renal)/i, organ: "kidney_lt", varKey: "span", unit: "cm" },
  { re: /kidney|renal length/i, organ: "kidney_rt", varKey: "span", unit: "cm" },
  { re: /liver (span|length)/i, organ: "liver", varKey: "span", unit: "cm" },
  { re: /spleen (span|length)/i, organ: "spleen", varKey: "span", unit: "cm" },
  { re: /endometri/i, organ: "uterus", varKey: "et", unit: "cm" },
  { re: /uterine length|uterus length/i, organ: "uterus", varKey: "u1", unit: "cm" },
  { re: /(right|rt\.?) ovary/i, organ: "adnexa", varKey: "rov1", unit: "cm" },
  { re: /(left|lt\.?) ovary/i, organ: "adnexa", varKey: "lov1", unit: "cm" },

  // Thyroid lobe AP diameters
  { re: /(right|rt\.?) (thyroid )?lobe.*(ap|anterior.?posterior)/i, organ: "thyroid_rt", varKey: "r1", unit: "mm" },
  { re: /(left|lt\.?) (thyroid )?lobe.*(ap|anterior.?posterior)/i, organ: "thyroid_lt", varKey: "l1", unit: "mm" },
  { re: /isthmus/i, organ: "isthmus", varKey: "isth", unit: "mm" },

  // Prostate
  { re: /prostate.*(length|height)/i, organ: "prostate", varKey: "p1", unit: "cm" },
  { re: /prostate.*width/i, organ: "prostate", varKey: "p2", unit: "cm" },

  // Scrotum
  { re: /(right|rt\.?) test/i, organ: "testis_rt", varKey: "t1", unit: "mm" },
  { re: /(left|lt\.?) test/i, organ: "testis_lt", varKey: "t1", unit: "mm" },

  // v6.13: Obstetric qualitative values — placenta position/grade, fetal lie
  // These are coded text values in DICOM SR (not numeric measurements).
  { re: /placenta.*location|placental.*site|site of placenta/i, organ: "placenta", varKey: "position", unit: "raw" },
  { re: /placenta.*grade|placental.*maturity/i, organ: "placenta", varKey: "grade", unit: "raw" },
  { re: /fetal (presentation|lie)|fetal.*position/i, organ: "fetus", varKey: "lie", unit: "raw" },

  // v6.13: Machine-computed GA and EDD — some machines send these as
  // text/code values in the SR. If present, they override the Hadlock
  // derivation (the machine may have used a different formula or LMP).
  { re: /gestational age|menstrual age|mean gestational age/i, organ: "biometry", varKey: "gaw", unit: "raw" },
  { re: /EDD|expected date of (confinement|delivery)/i, organ: "biometry", varKey: "edd", unit: "raw" },
];

/** Normalise a SR value to the slot's unit kind. */
export function normaliseUnit(value: string, unit: string, kind: VarMap["unit"]): string {
  if (kind === "raw") {
    // v6.13: normalise DICOM SR coded text values to the select-token values.
    // DICOM CID 7454 placenta location uses capitalised text; our select-tokens
    // use lowercase. Also map common synonyms.
    return normaliseRawValue(value.trim().toLowerCase());
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return value.trim();
  const u = (unit ?? "").toLowerCase();
  switch (kind) {
    case "mm":
      if (u.startsWith("cm") || (!u && n < 15)) return String(Math.round(n * 10));
      return String(Math.round(n));
    case "cm":
      if (u.startsWith("mm") || (!u && n > 15)) return (n / 10).toFixed(1);
      return String(n);
    case "g":
      if (u.startsWith("kg")) return String(Math.round(n * 1000));
      return String(Math.round(n));
    case "bpm":
      return String(Math.round(n));
    default:
      return value.trim();
  }
}

/** v6.13: Normalise DICOM SR coded text values to the select-token values
 *  the composer expects. Handles common synonyms and capitalisations. */
function normaliseRawValue(v: string): string {
  // Placenta position
  if (/anterior/.test(v)) return "anterior";
  if (/posterior/.test(v)) return "posterior";
  if (/fundal|fundus/.test(v)) return "fundal";
  if (/lateral.*right|right.*lateral/.test(v)) return "lateral (right)";
  if (/lateral.*left|left.*lateral/.test(v)) return "lateral (left)";
  if (/low.?lying/.test(v)) return "low-lying";
  if (/praevia|previa/.test(v)) return "praevia";
  // Placenta grade
  if (/grade\s*0|grade\s*zero|^0$/.test(v)) return "0";
  if (/grade\s*i\b|^i$/.test(v)) return "I";
  if (/grade\s*ii\b|^ii$/.test(v)) return "II";
  if (/grade\s*iii\b|^iii$/.test(v)) return "III";
  // Fetal lie / presentation
  if (/cephalic|vertex|head (down|presentation)/.test(v)) return "cephalic";
  if (/breech/.test(v)) return "breech";
  if (/transverse/.test(v)) return "transverse";
  if (/oblique/.test(v)) return "oblique";
  if (/variable|unstable|longitudinal/.test(v)) return "variable";
  // GA — extract weeks number from "32 weeks 5 days" or "32w5d" patterns
  const gaMatch = v.match(/(\d+)\s*(?:weeks?\s*)?(?:and\s*)?(\d+)?\s*(?:days?|d)\b/i);
  if (gaMatch) return gaMatch[1]; // just the weeks part — days come separately
  return v;
}

export type SrExtractResult = {
  /** organ key → { varKey: value } for the composer's setOrganVar. */
  vars: Record<string, Record<string, string>>;
  /** Unmatched concepts, shown so nothing the machine said is silently lost. */
  extras: Record<string, string>;
  matchedCount: number;
};

/** Which organs exist in a study (so we never fill a slot the study lacks). */
function organsOfStudy(studyKey: string): Set<string> {
  const s = getStudy(studyKey);
  return new Set(s ? s.organs.map((o) => o.key) : []);
}

/** Map SR measurements onto composer slots for one study. */
export function mapSrToStudy(sr: SrMeasurement[], studyKey: string): SrExtractResult {
  const organs = organsOfStudy(studyKey);
  const vars: Record<string, Record<string, string>> = {};
  const extras: Record<string, string> = {};
  let matchedCount = 0;

  for (const m of sr) {
    let mapped = false;
    for (const row of VAR_MAP) {
      if (!row.re.test(m.conceptName)) continue;
      if (!organs.has(row.organ)) continue;
      const val = normaliseUnit(m.value, m.unit, row.unit);
      if (!val) continue;
      vars[row.organ] = vars[row.organ] ?? {};
      // First match wins per slot (repeat measurements keep the machine's
      // primary value — same rule the ERP extractor applies).
      if (vars[row.organ][row.varKey] === undefined) {
        vars[row.organ][row.varKey] = val;
        matchedCount++;
      }
      mapped = true;
      break;
    }
    if (!mapped) {
      const display = m.value + (m.unit ? ` ${m.unit}` : "");
      if (extras[m.conceptName] === undefined) extras[m.conceptName] = display;
    }
  }
  return { vars, extras, matchedCount };
}

/** True when a study's SR carry meaningful biometry (ob/ep families). */
export function srIsObstetric(sr: SrMeasurement[]): boolean {
  return sr.some((m) => /bpd|biparietal|crown.?rump|femur|head circ|abdominal circ/i.test(m.conceptName));
}
