/**
 * textExpansion.ts — auto-text expansion for common USG findings.
 *
 * Feature 6: Type `fatty1` → auto-expands to "Fatty liver Grade I" + selects
 * the pathology + fills any measurement slots. The doctor types 6 chars and
 * gets a complete finding with all slots filled.
 *
 * Snippet registry — each snippet maps to a pathology key + default values.
 */

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
 * Registry of text expansion snippets.
 * The trigger is matched case-insensitively at the start of what the
 * doctor types in any finding text box.
 */
const SNIPPETS: SnippetExpansion[] = [
  // Liver
  { trigger: "fatty1", pathologyKey: "liver-fatty-g1", label: "Fatty Liver Gr I", confirm: "Fatty Liver Grade I" },
  { trigger: "fatty2", pathologyKey: "liver-fatty-g2", label: "Fatty Liver Gr II", confirm: "Fatty Liver Grade II" },
  { trigger: "fatty3", pathologyKey: "liver-fatty-g3", label: "Fatty Liver Gr III", confirm: "Fatty Liver Grade III" },
  { trigger: "hepato", pathologyKey: "liver-hepatomegaly", label: "Hepatomegaly", confirm: "Hepatomegaly" },
  { trigger: "mass", pathologyKey: "liver-mass", label: "Liver Mass", confirm: "Liver mass — characterise with CECT" },
  { trigger: "haem", pathologyKey: "liver-haemangioma", label: "Haemangioma", confirm: "Haemangioma" },
  { trigger: "cirr", pathologyKey: "liver-cirrhosis", label: "Cirrhosis", confirm: "Cirrhosis — check portal HTN" },

  // Gallbladder
  { trigger: "stone", pathologyKey: "gb_cholelithiasis", label: "Cholelithiasis", confirm: "Gallstones — check CBD" },
  { trigger: "sludge", pathologyKey: "gb-sludge", label: "GB Sludge", confirm: "Gallbladder sludge" },
  { trigger: "wall", pathologyKey: "gb-wall-thickening", label: "GB Wall Thickening", confirm: "GB wall thickening" },
  { trigger: "polyp", pathologyKey: "gb-polyp", label: "GB Polyp", confirm: "GB polyp — measure size" },

  // Kidney
  { trigger: "calc", pathologyKey: "kidney-calculus", label: "Renal Calculus", confirm: "Renal calculus — pick calyx location" },
  { trigger: "hydro", pathologyKey: "kidney-hydronephrosis-mild", label: "Hydronephrosis Mild", confirm: "Mild hydronephrosis" },
  { trigger: "hydro2", pathologyKey: "kidney-hydronephrosis-moderate", label: "Hydronephrosis Moderate", confirm: "Moderate hydronephrosis" },
  { trigger: "hydro3", pathologyKey: "kidney-hydronephrosis-severe", label: "Hydronephrosis Severe", confirm: "Severe hydronephrosis" },
  { trigger: "cyst", pathologyKey: "kidney-cortical-cyst", label: "Simple Cortical Cyst", confirm: "Simple cortical cyst" },

  // Prostate
  { trigger: "pros", pathologyKey: "prostate-enlarged", label: "Prostatomegaly", confirm: "Prostatomegaly — calculate volume" },

  // Thyroid
  { trigger: "nodule", pathologyKey: "thyroid-nodule-rt", label: "Thyroid Nodule", confirm: "Thyroid nodule — apply TI-RADS" },
  { trigger: "goitre", pathologyKey: "thyroid-diffuse-goitre", label: "Diffuse Goitre", confirm: "Diffuse goitre — check TFTs" },
  { trigger: "thyroiditis", pathologyKey: "thyroid-itis", label: "Thyroiditis", confirm: "Thyroiditis — check antibodies" },

  // Uterus
  { trigger: "fibroid", pathologyKey: "uterine-fibroid", label: "Uterine Fibroid", confirm: "Fibroid — measure and locate" },
  { trigger: "endo", pathologyKey: "endometrial-thickening", label: "Endometrial Thickening", confirm: "Endometrial thickening — measure ET" },

  // Obstetric
  { trigger: "iugr", pathologyKey: "ob-iugr", label: "IUGR", confirm: "IUGR — Doppler assessment needed" },
  { trigger: "poly", pathologyKey: "ob-polyhydramnios", label: "Polyhydramnios", confirm: "Polyhydramnios — check GDM" },
  { trigger: "oligo", pathologyKey: "ob-oligohydramnios", label: "Oligohydramnios", confirm: "Oligohydramnios — check renal anatomy" },
  { trigger: "breech", pathologyKey: "ob-breech", label: "Breech", confirm: "Breech presentation" },
  { trigger: "placenta", pathologyKey: "ob-placenta-previa", label: "Placenta Praevia", confirm: "Placenta praevia — no vaginal delivery" },

  // Breast
  { trigger: "birmass", pathologyKey: "breast-mass-rt", label: "Breast Mass", confirm: "Breast mass — BI-RADS assessment" },
];

/**
 * Check if the typed text matches a snippet trigger.
 * Returns the expansion if matched, null otherwise.
 *
 * Matches are case-insensitive and match at the start of the text.
 */
export function matchSnippet(text: string): SnippetExpansion | null {
  const lower = text.trim().toLowerCase();
  if (!lower) return null;

  // Exact match first
  const exact = SNIPPETS.find((s) => s.trigger === lower);
  if (exact) return exact;

  // Prefix match — typed text is a prefix of a trigger
  const prefix = SNIPPETS.find((s) => s.trigger.startsWith(lower) && lower.length >= 3);
  if (prefix) return prefix;

  return null;
}

/**
 * Get all registered snippets (for the shortcut overlay).
 */
export function getAllSnippets(): SnippetExpansion[] {
  return [...SNIPPETS];
}

/**
 * Format snippet list for the keyboard shortcut overlay.
 */
export function formatSnippetsForDisplay(): Array<{ trigger: string; label: string }> {
  return SNIPPETS.map((s) => ({ trigger: s.trigger, label: s.label }));
}
