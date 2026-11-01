/**
 * Searching for a finding, not for a word.
 *
 * The register's search box has always been a text filter over the columns a
 * report row carries. That answers "which patient" and "which referring doctor"
 * and, since the impression is stored, roughly "what did it say" — but it cannot
 * answer the question a sonologist actually asks when the medicant leaves:
 * "show me every report with a grade-II fatty liver". Two reasons it could not:
 *
 *   - the printed `findings` body was never searched at all, so a sentence that
 *     only appears in the body was invisible;
 *   - and the finding itself — the chip that was clicked, which is the structured
 *     fact behind the sentence — was only ever reachable as free text inside
 *     `stateJson`, which nothing matched against.
 *
 * That second one matters more than it looks: the wording a chip prints is
 * editable (normal overrides, per-clinic wording, custom findings). So searching
 * the prose can miss a report the doctor tagged with the very finding he is
 * asking for. The chip key is the stable thing.
 *
 * Matching is deliberately a quoted-substring test against `stateJson` rather
 * than SQLite's JSON1 (`json_each`): a malformed state row makes `json_each`
 * throw and take the whole search down with it, and the analytics module already
 * defends against exactly that by parsing each row inside a try/catch.
 *
 * The quotes around the key are the word boundary: searching for
 * `"liver-fatty-g1"` cannot answer with the report that carries
 * `"liver-fatty-g1-nosize"`, because the closing quote never lands on the `-`.
 * That is right for a key typed or linked in straight — the bar he pressed on
 * Insights counts exactly that key. Reached instead through a label ("fatty gr
 * i"), both DO answer, and should: two chips print the same grade, and the
 * doctor asking for grade I means either.
 *
 * Client-safe: no database imports, so the register and the Insights screen can
 * both use it.
 */

export type FindingCatalogEntry = { key: string; label: string; organ?: string; category?: string };

/** Lowercase words of a label or a key, punctuation dropped. */
function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[—–·•,;:/()\[\]]+/g, " ")
    .split(/[\s\-_]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * Which catalogue findings this query could mean.
 *
 * Every token has to land, so "fatty gr ii" finds `liver-fatty-g2`
 * ("Fatty Liver — Gr II") and "gr ii" alone finds every grade-two entry, while
 * "fatty stone" finds nothing rather than the union of the two words.
 */
export function findingKeysForQuery(q: string, catalog: FindingCatalogEntry[]): string[] {
  const needle = tokens(q);
  if (needle.length < 2) return [];
  const out: string[] = [];
  for (const p of catalog) {
    const hay = new Set([...tokens(p.label), ...tokens(p.key), ...(p.category ? tokens(p.category) : [])]);
    if (needle.every((t) => hay.has(t))) out.push(p.key);
  }
  return out;
}

/**
 * The `stateJson` substrings that prove a report carries one of these findings.
 * `pathologies: ["a","b"]` and the legacy `pathology: "a"` both store the key as
 * a quoted JSON string, so the quotes are the boundary — and an exact key search
 * is what makes a wording override unable to hide a report from its own finding.
 */
export function findingStateTokens(keys: string[]): string[] {
  return keys.map((k) => `"${k}"`);
}

/** A query that is plainly one of the keys typed out (a link from Insights). */
export function exactKeyOf(q: string, catalog: FindingCatalogEntry[]): string | null {
  const want = q.trim().toLowerCase();
  if (!want) return null;
  const hit = catalog.find((p) => p.key.toLowerCase() === want);
  return hit?.key ?? null;
}
