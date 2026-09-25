/**
 * textExpansion.ts — auto-text expansion for common USG findings.
 *
 * Feature 6: Type `fatty1` → expands to the matching pathology chip.
 * Triggers map ONLY to keys that exist in pathologies.ts.
 */
import { USG_PATHOLOGIES } from "./pathologies";

export type SnippetExpansion = {
  trigger: string;
  pathologyKey: string;
  label: string;
  /** Default variable values to pre-fill. */
  vars?: Record<string, string>;
  /** Message shown after expansion. */
  confirm: string;
};

/**
 * Registry of text expansion snippets — keys must exist in USG_PATHOLOGIES.
 */
const SNIPPETS: SnippetExpansion[] = [
  // Liver (peak-time · no size first)
  { trigger: "fatty1n", pathologyKey: "liver-fatty-g1-nosize", label: "Fatty Gr I · no size", confirm: "Fatty Liver Grade I (no size)" },
  { trigger: "fatty1", pathologyKey: "liver-fatty-g1", label: "Fatty Liver Gr I", confirm: "Fatty Liver Grade I" },
  { trigger: "fatty2n", pathologyKey: "liver-fatty-g2-nosize", label: "Fatty Gr II · no size", confirm: "Fatty Liver Grade II (no size)" },
  { trigger: "fatty2", pathologyKey: "liver-fatty-g2", label: "Fatty Liver Gr II", confirm: "Fatty Liver Grade II" },
  { trigger: "hepato", pathologyKey: "liver-hepatomegaly-fatty-g1-nosize", label: "Hepatomegaly + Fatty Gr I · no size", confirm: "Hepatomegaly with Fatty Gr I" },
  { trigger: "haem", pathologyKey: "liver-hemangioma", label: "Haemangioma", confirm: "Haemangioma" },

  // Gallbladder
  { trigger: "stonen", pathologyKey: "gb-calculus-nosize", label: "GB Calculus · no size", confirm: "Cholelithiasis (no size)" },
  { trigger: "stone", pathologyKey: "gb-calculus", label: "Cholelithiasis", confirm: "Gallstones — check CBD" },
  { trigger: "polyp", pathologyKey: "gb-polyp", label: "GB Polyp", confirm: "GB polyp — measure size" },

  // Spleen / kidney / prostate
  { trigger: "splen", pathologyKey: "spleen-splenomegaly-nosize", label: "Splenomegaly · no size", confirm: "Splenomegaly" },
  { trigger: "calc", pathologyKey: "kidney-calculus", label: "Renal Calculus", confirm: "Renal calculus — pick calyx location" },
  { trigger: "hydro", pathologyKey: "kidney-hydro-mild", label: "Hydronephrosis Mild", confirm: "Mild hydronephrosis" },
  { trigger: "cystn", pathologyKey: "kidney-cyst-nosize", label: "Simple Cyst · no size", confirm: "Simple cortical cyst" },
  { trigger: "cyst", pathologyKey: "kidney-cyst", label: "Simple Cortical Cyst", confirm: "Simple cortical cyst" },
  { trigger: "prosn", pathologyKey: "prostate-enlarged-nosize", label: "Prostatomegaly · no size", confirm: "Prostatomegaly" },
  { trigger: "pros", pathologyKey: "prostate-enlarged", label: "Prostatomegaly", confirm: "Prostatomegaly — calculate volume" },

  // Uterus / adnexa
  { trigger: "bulky", pathologyKey: "uterus-bulky-nosize", label: "Bulky Uterus · no size", confirm: "Bulky uterus" },
  { trigger: "fibroid", pathologyKey: "uterus-fibroid-intramural", label: "Fibroid — Intramural", confirm: "Fibroid — measure and locate" },
  { trigger: "endo", pathologyKey: "uterus-et-thick", label: "Thickened Endometrium", confirm: "Endometrial thickening — measure ET" },
  { trigger: "ovcystn", pathologyKey: "adnexa-cyst-simple-nosize", label: "Simple Cyst · no size", confirm: "Simple ovarian cyst" },
  { trigger: "ovcyst", pathologyKey: "adnexa-cyst-simple", label: "Simple Ovarian Cyst", confirm: "Simple ovarian cyst" },
];

/** Drop any snippet whose pathology key is missing (defense in depth). */
function liveSnippets(): SnippetExpansion[] {
  const keys = new Set(USG_PATHOLOGIES.map((p) => p.key));
  return SNIPPETS.filter((s) => keys.has(s.pathologyKey));
}

/**
 * Check if the typed text matches a snippet trigger.
 * Exact match preferred; prefix match when ≥3 chars typed.
 */
export function matchSnippet(text: string): SnippetExpansion | null {
  const lower = text.trim().toLowerCase().replace(/^:/, "");
  if (!lower) return null;
  const list = liveSnippets();

  const exact = list.find((s) => s.trigger === lower);
  if (exact) return exact;

  // Prefer longest trigger so fatty1n wins over fatty1 when typing fatty1n
  const prefix = list
    .filter((s) => s.trigger.startsWith(lower) && lower.length >= 3)
    .sort((a, b) => b.trigger.length - a.trigger.length)[0];
  return prefix ?? null;
}

/** Exact-only match used when the doctor finishes a trigger (Tab / blur). */
export function matchSnippetExact(text: string): SnippetExpansion | null {
  const lower = text.trim().toLowerCase().replace(/^:/, "");
  if (!lower) return null;
  return liveSnippets().find((s) => s.trigger === lower) ?? null;
}

export function getAllSnippets(): SnippetExpansion[] {
  return liveSnippets();
}

export function formatSnippetsForDisplay(): Array<{ trigger: string; label: string }> {
  return liveSnippets().map((s) => ({ trigger: s.trigger, label: s.label }));
}
