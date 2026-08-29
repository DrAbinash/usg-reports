/**
 * R2-mini slot identity — the one behavior worth taking from CARE's
 * observation ledger: two findings occupying the same anatomic slot
 * replace each other instead of stacking into contradictions.
 *
 * Slot = region | concept | level | laterality
 */

export type SlotLike = {
  region: string;
  concept: string;
  level?: string | null;
  laterality?: string | null;
};

export function normalizeLevel(level: string | null | undefined): string {
  const raw = String(level ?? "").trim().toUpperCase();
  if (!raw) return "";
  // Map T→D (thoracic synonym), keep L/C/S/D single letters.
  let t = raw.replace(/\bT(\d)/g, "D$1").replace(/T(\d)/g, "D$1");
  // Normalize separators: "L4 L5" / "l4l5" / "L4_5" → "L4-L5"
  t = t.replace(/[\s_]+/g, "-");
  t = t.replace(/(\w)-+(\w)/g, "$1-$2");
  // Compact form "L45" → "L4-L5" for two-letter discs
  t = t.replace(/^([LCSD])(\d)(\d)$/, "$1$2-$1$3");
  return t;
}

export function normalizeLaterality(lat: string | null | undefined): string {
  const raw = String(lat ?? "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "l" || raw.startsWith("left")) return "left";
  if (raw === "r" || raw.startsWith("right")) return "right";
  if (raw.startsWith("bil") || raw === "both") return "bilateral";
  return raw;
}

export function normalizeConcept(concept: string | null | undefined): string {
  return String(concept ?? "").trim().toLowerCase().replace(/\s+/g, "_");
}

/** Free-text notes never replace anything. */
export function isNote(concept: string): boolean {
  return normalizeConcept(concept) === "note";
}

export function slotKey(row: SlotLike): string {
  if (isNote(row.concept)) return `note|${Math.random().toString(36).slice(2)}`; // notes are always distinct
  return [
    String(row.region ?? "").trim(),
    normalizeConcept(row.concept),
    normalizeLevel(row.level) || "*",
    normalizeLaterality(row.laterality) || "*",
  ].join("|");
}

/** Does `incoming` occupy the same slot as `existing`? */
export function sameSlot(a: SlotLike, b: SlotLike): boolean {
  return !isNote(a.concept) && !isNote(b.concept) && slotKey(a) === slotKey(b);
}

/** Severity ordering for the AP-vs-severity style sanity hint (client-side). */
export const SEVERITY_ORDER: Record<string, number> = {
  none: 0, trivial: 0, "no": 0,
  mild: 1, "grade i": 1, "i": 1,
  moderate: 2, "grade ii": 2, "ii": 2,
  severe: 3, "grade iii": 3, "iii": 3,
};
