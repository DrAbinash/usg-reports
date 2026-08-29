import type { FindingRow } from "@prisma/client";

/**
 * Compilation: FindingRows → narrative text.
 * Deterministic, order-preserving, region-grouped for Findings;
 * numbered for Impression.
 *
 * Format-system rules:
 *  - impressionOnly rows never appear in Findings (they exist for the Impression)
 *  - newParagraph rows start a fresh paragraph inside their region group
 *  - the "normal_impression" line auto-yields the moment any real
 *    impression-worthy finding exists (and returns when it is gone)
 */

type CompileRow = Pick<
  FindingRow,
  "region" | "level" | "text" | "inImpression" | "sortOrder" | "severity" | "laterality" | "concept"
> &
  Partial<Pick<FindingRow, "newParagraph" | "impressionOnly">>;

const NORMAL_IMPRESSION_CONCEPT = "normal_impression";

function levelPrefix(row: CompileRow): string {
  // Text may already embed the level (seed phrases use {level}).
  if (row.level && !row.text.includes(row.level)) return `${row.level}: `;
  return "";
}

/** Findings narrative: sentences grouped by region, blank line between regions
 *  and between paragraphs flagged with newParagraph. */
export function compileFindingsText(rows: CompileRow[]): string {
  const sorted = [...rows]
    .filter((r) => !r.impressionOnly)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const groups: { region: string; lines: string[] }[] = [];
  for (const r of sorted) {
    let g = groups.find((x) => x.region === r.region);
    if (!g) {
      g = { region: r.region, lines: [] };
      groups.push(g);
    }
    const line = `${levelPrefix(r)}${r.text}`.trim();
    if (r.newParagraph && g.lines.length > 0) g.lines.push("\n\n" + line);
    else g.lines.push(line);
  }
  return groups
    .map((g) => `${g.region}\n${g.lines.join(" ")}`)
    .join("\n\n");
}

/** Impression: numbered lines from inImpression rows, in sortOrder.
 *  The seeded normal line ("No significant abnormality detected.") yields
 *  to any real impression line — and stands again when none remain. */
export function compileImpressionText(rows: CompileRow[]): string {
  const sorted = [...rows]
    .filter((r) => r.inImpression)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const hasReal = sorted.some((r) => r.concept !== NORMAL_IMPRESSION_CONCEPT);
  const effective = hasReal
    ? sorted.filter((r) => r.concept !== NORMAL_IMPRESSION_CONCEPT)
    : sorted;
  return effective.map((r, i) => `${i + 1}. ${levelPrefix(r)}${r.text}`.trim()).join("\n");
}

/**
 * Guard for "Impression edited manually — recompile?" — true when the stored
 * impression differs from the compiled one (ignoring trailing whitespace).
 */
export function impressionDiverges(stored: string, rows: CompileRow[]): boolean {
  const compiled = compileImpressionText(rows);
  return stored.trim() !== compiled.trim() && stored.trim() !== "";
}

/** Recompute sortOrder to append at the end. */
export function nextSortOrder(rows: { sortOrder: number }[]): number {
  return rows.reduce((m, r) => Math.max(m, r.sortOrder), 0) + 1;
}

/**
 * Findings opening line composition (the study heading stays SHORT):
 *   "MRI BRAIN" + " WITH " + [format suffix, …finding fragments] — uppercased.
 *   → "MRI BRAIN WITH FAZEKAS GRADE 1 CHANGES, SENILE CHANGES AND CHRONIC INFARCT"
 * Printed bold at the top of the FINDINGS section. Fragments arrive in
 * sortOrder; duplicates (case-insensitive) collapse.
 */
export function composeFindingsOpening(
  base: string,
  suffix: string | null | undefined,
  fragments: (string | null | undefined)[],
): string {
  const parts = [String(suffix ?? "").trim(), ...fragments.map((f) => String(f ?? "").trim())]
    .filter(Boolean);
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const p of parts) {
    const k = p.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      uniq.push(p);
    }
  }
  if (uniq.length === 0) return "";
  const joined =
    uniq.length === 1
      ? uniq[0]
      : uniq.length === 2
        ? `${uniq[0]} and ${uniq[1]}`
        : `${uniq.slice(0, -1).join(", ")} and ${uniq[uniq.length - 1]}`;
  return `${base} WITH ${joined.toUpperCase()}`;
}
