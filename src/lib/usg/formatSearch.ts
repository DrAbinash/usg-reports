/**
 * formatSearch.ts — partial (substring) search over hydrated report formats.
 *
 * Aliases are seeded with the format catalog (npTemplates / ensureBuiltin*),
 * not hardcoded in the Formats Library UI.
 */

export type SearchableFormat = {
  id: string;
  name: string;
  studyKey: string;
  /** Study-type family for grouping / search (e.g. whole-abdomen, echo). */
  studyType: string;
  /** Category bucket for empty-query grouping. */
  category: string;
  searchAliases: string[];
  /** Optional organ keywords (liver, kidney, …) for token match. */
  organKeywords?: string[];
};

/** Normalize for search: lowercase, strip punctuation, collapse whitespace. */
export function normalizeFormatQuery(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Match when EVERY whitespace-separated token (AND) is a substring of
 * format.name, any searchAlias, studyType, or organ keywords.
 */
export function matchFormatQuery(format: SearchableFormat, query: string): boolean {
  const q = normalizeFormatQuery(query);
  if (!q) return true;
  const tokens = q.split(" ").filter(Boolean);
  if (!tokens.length) return true;

  const haystack = normalizeFormatQuery(
    [
      format.name,
      format.studyType,
      format.studyKey,
      format.category,
      ...(format.searchAliases ?? []),
      ...(format.organKeywords ?? []),
    ].join(" "),
  );

  return tokens.every((tok) => haystack.includes(tok));
}

/** Filter a list with matchFormatQuery. */
export function filterFormatsByQuery<T extends SearchableFormat>(
  formats: T[],
  query: string,
): T[] {
  const q = normalizeFormatQuery(query);
  if (!q) return formats;
  return formats.filter((f) => matchFormatQuery(f, q));
}

/** Group formats by category (stable category order). */
export function groupFormatsByCategory<T extends SearchableFormat>(
  formats: T[],
): Array<{ category: string; formats: T[] }> {
  const order = [
    "abdomen",
    "ob",
    "cardiac",
    "doppler",
    "thyroid",
    "breast",
    "scrotum",
    "chest",
    "cranium",
    "orbit",
    "other",
  ];
  const map = new Map<string, T[]>();
  for (const f of formats) {
    const cat = f.category || "other";
    const list = map.get(cat) ?? [];
    list.push(f);
    map.set(cat, list);
  }
  const out: Array<{ category: string; formats: T[] }> = [];
  for (const cat of order) {
    const list = map.get(cat);
    if (list?.length) out.push({ category: cat, formats: list });
    map.delete(cat);
  }
  for (const [cat, list] of map) {
    if (list.length) out.push({ category: cat, formats: list });
  }
  return out;
}

/** Derive category + studyType from a composer studyKey. */
export function formatMetaForStudyKey(studyKey: string): {
  studyType: string;
  category: string;
  organKeywords: string[];
} {
  const k = studyKey || "";
  if (k === "echo" || k.startsWith("echo-")) {
    return { studyType: "echo", category: "cardiac", organKeywords: ["heart", "cardiac", "valve", "lvef"] };
  }
  if (k === "fetal-echo") {
    return { studyType: "fetal-echo", category: "cardiac", organKeywords: ["fetal", "heart", "four chamber", "ductus", "situs"] };
  }
  if (k.startsWith("doppler") || k === "carotid") {
    return { studyType: k, category: "doppler", organKeywords: ["arterial", "venous", "vessel"] };
  }
  if (k === "ob" || k === "ep" || k.startsWith("ob-") || k === "tvs" || k === "tvs-ob" || k === "wa-ob") {
    return {
      studyType: k === "tvs" ? "tvs" : "ob",
      category: "ob",
      organKeywords: ["fetus", "uterus", "placenta", "pregnancy"],
    };
  }
  if (k === "thyroid") return { studyType: "thyroid", category: "thyroid", organKeywords: ["thyroid", "neck"] };
  if (k === "breast") return { studyType: "breast", category: "breast", organKeywords: ["breast", "mammo"] };
  if (k === "scrotum") return { studyType: "scrotum", category: "scrotum", organKeywords: ["scrotum", "testis"] };
  if (k === "chest") return { studyType: "chest", category: "chest", organKeywords: ["pleura", "chest"] };
  if (k === "cranium") return { studyType: "cranium", category: "cranium", organKeywords: ["brain", "fontanelle"] };
  if (k === "orbit") return { studyType: "orbit", category: "orbit", organKeywords: ["eye", "orbit"] };
  if (k === "kub") {
    return { studyType: "kub", category: "abdomen", organKeywords: ["kidney", "ureter", "bladder", "renal"] };
  }
  if (k === "ua") {
    return { studyType: "upper-abdomen", category: "abdomen", organKeywords: ["liver", "gb", "pancreas", "spleen"] };
  }
  if (k.startsWith("la-")) {
    return { studyType: "lower-abdomen", category: "abdomen", organKeywords: ["uterus", "adnexa", "pelvis", "prostate"] };
  }
  if (k.startsWith("wa-")) {
    return {
      studyType: "whole-abdomen",
      category: "abdomen",
      organKeywords: ["liver", "gb", "kidney", "uterus", "abdomen"],
    };
  }
  return { studyType: k || "other", category: "other", organKeywords: [] };
}
