/**
 * Finding search for the composer — typing instead of scanning.
 *
 * The study catalog is 258 findings across a dozen organs, and the only way to
 * one was the chip row: six visible, the rest behind "+N more", per organ. A
 * doctor who knows what he saw ("a small calculus in the upper pole") but not
 * which card the chip lives on spends the visit looking for a button. This is
 * the search that replaces that: one box, every finding of the organs this study
 * actually has, ranked, and pressing a result toggles the chip on that organ.
 *
 * Which findings a study "has" is decided by `pathologiesForOrgan` — the app's
 * own rule, not a re-derivation of it. That matters more than it sounds: the
 * female abdomen's cards are `kidney_rt` and `kidney_lt` while the catalog's
 * kidney chips are authored on `kidney`, and paired structures in general share
 * one side-agnostic organ. A search that compared those keys directly would
 * find nothing for a kidney, on every study that has two of them.
 *
 * Matching is deliberately forgiving, because the query is typed from memory
 * while a patient is on the table:
 *
 *   1. every word of the query is a PREFIX of a word of the finding —
 *      "fatty gr ii" finds "Fatty Liver — Gr II";
 *   2. or every word appears somewhere inside it — "gr ii" reaches it too;
 *   3. or a word is one typo away — "calclus" finds "Renal Calculus".
 *
 * A `ChipHit.score` counts these down (3, 2, 1), and the better score wins; the
 * organ he is writing on beats one he is not; then the catalog's own chip order
 * settles the rest, so the findings this clinic reaches for most come up first.
 *
 * Pure and client-safe — no database, no React.
 */
import type { UsgPathologyDef } from "./types";
import { pathologiesForOrgan } from "./composer";

export type ChipSearchOrgan = { key: string; label: string };

export type ChipHit = {
  pathology: UsgPathologyDef;
  organKey: string;
  organLabel: string;
  /** 3 = every word fits, 2 = every word is inside, 1 = the letters survive. */
  score: number;
};

const WORDS = /[^a-z0-9]+/g;

/**
 * Words the catalog spells differently from how anybody says them out loud.
 *
 * Deliberately tiny: each pair is a word a sonologist types while the patient is
 * still on the table while the chip is named the other way — the finding is
 * "GB Calculus", and nobody reaches for it by that name at 2 pm.
 */
const SYNONYMS: Record<string, string[]> = {
  stone: ["calculus", "calculi"],
  stones: ["calculus", "calculi"],
  calculus: ["stone", "stones"],
  calculi: ["stone", "stones"],
  kidney: ["renal"],
  renal: ["kidney"],
  gall: ["gallbladder", "gb"],
  gallbladder: ["gall", "gb"],
  liver: ["hepatic"],
  hepatic: ["liver"],
};

function words(s: string): string[] {
  return s.toLowerCase().replace(WORDS, " ").trim().split(" ").filter(Boolean);
}

/** A query word, plus whatever the catalog would have called it. */
function alternatives(token: string): string[] {
  const syn = SYNONYMS[token];
  return syn ? [token, ...syn] : [token];
}

/** The letters of a string, punctuation gone — what rank 3 compares. */
function letters(s: string): string {
  return s.toLowerCase().replace(WORDS, "");
}

/** Every query word (or a synonym of it) is a prefix of some haystack word. */
function allPrefixes(needle: string[][], hay: string[]): boolean {
  return needle.every((alts) => alts.some((n) => hay.some((h) => h.startsWith(n))));
}

/** Every query word (or a synonym) appears somewhere inside the haystack. */
function allSubstrings(needle: string[][], hayLetters: string): boolean {
  return needle.every((alts) => alts.some((n) => hayLetters.includes(n)));
}

/**
 * One edit away — a missing letter, a doubled letter, or a wrong one.
 *
 * This is the rank that catches "calclus" for "Calculus". It is deliberately
 * word-to-word: an earlier version let the whole query's letters scatter anywhere
 * in the finding, and "prostate" answered with "CHPS (Pyloric Stenosis)". A typo
 * is a local thing; a letter salad is not a query.
 */
function withinOneEdit(a: string, b: string): boolean {
  if (a.length < 4 || b.length < 4) return false;
  if (Math.abs(a.length - b.length) > 1) return false;
  let diffs = 0;
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++diffs > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  diffs += a.length - i + b.length - j;
  return diffs <= 1;
}

/** Some query word (or a synonym) is one edit from some haystack word. */
function nearMiss(needle: string[][], hay: string[]): boolean {
  return needle.every((alts) => alts.some((n) => hay.some((h) => withinOneEdit(n, h))));
}

/**
 * Findings this query could mean, best first.
 *
 * `organs` is the study's organ list; a result is always one of the chips that
 * organ's own row would have shown, so pressing it does something. A chip
 * shared by two cards (either kidney) is offered once, on the card the doctor
 * is writing if that is one of them.
 */
export function searchChips(
  query: string,
  pathologies: UsgPathologyDef[],
  organs: ChipSearchOrgan[],
  opts: { limit?: number; order?: string[]; preferredOrganKey?: string } = {},
): ChipHit[] {
  const needle = words(query).map(alternatives);
  if (needle.length === 0) return [];
  const limit = opts.limit ?? 12;
  const rank = new Map((opts.order ?? []).map((key, i) => [key, i]));

  const byPathology = new Map<string, ChipHit>();
  for (const organ of organs) {
    // The app's own organ mapping, which is also what keeps a clinic's
    // impression/advice snippets (authored on `_impression`, `_advice`) out of
    // the results: no organ card of any study includes them.
    for (const p of pathologiesForOrgan(pathologies, organ.key)) {
      if (!p?.key || !p?.label) continue;

      // The organ's own name is part of the finding: "gall stone" has to reach
      // the chip called "GB Calculus" sitting on the card labelled "G. B".
      const hayWords = [
        ...words(p.label),
        ...words(organ.label),
        ...words(p.category ?? ""),
        ...words(p.key.replace(/[-_]/g, " ")),
      ];
      const hayLetters = letters(`${p.label} ${organ.label} ${p.category ?? ""} ${p.key}`);

      let score = 0;
      if (allPrefixes(needle, hayWords)) score = 3;
      else if (allSubstrings(needle, hayLetters)) score = 2;
      else if (nearMiss(needle, hayWords)) score = 1;
      if (!score) continue;

      const seen = byPathology.get(p.key);
      const preferred = organ.key === opts.preferredOrganKey;
      if (!seen || (preferred && seen.organKey !== opts.preferredOrganKey)) {
        byPathology.set(p.key, { pathology: p, organKey: organ.key, organLabel: organ.label, score });
      } else if (score > seen.score) {
        seen.score = score;
      }
    }
  }

  const hits = [...byPathology.values()];
  const weight = (h: ChipHit) => rank.get(h.pathology.key) ?? Number.MAX_SAFE_INTEGER;
  const isPreferred = (h: ChipHit) => (h.organKey === opts.preferredOrganKey ? 0 : 1);
  return hits
    .sort(
      (a, b) =>
        b.score - a.score ||
        isPreferred(a) - isPreferred(b) ||
        weight(a) - weight(b) ||
        a.pathology.label.localeCompare(b.pathology.label),
    )
    .slice(0, limit);
}
