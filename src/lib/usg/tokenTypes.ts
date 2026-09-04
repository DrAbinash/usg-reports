/**
 * tokenTypes.ts — typed variable slots for USG finding tokens.
 *
 * Instead of every {token} being a free-text input, this module lets a
 * pathology definition declare a token as a "select" type with predefined
 * options. The organ card renders a dropdown instead of a text input.
 *
 * Example: a kidney calculus finding has "{loc} of the kidney" — instead of
 * the radiologist typing "upper calyx", she picks from:
 *   Upper calyx | Middle calyx | Lower calyx | Renal pelvis | PUJ | VUJ
 *
 * The selection replaces the {token} in the finding text exactly like a
 * free-text value would — the composer's substitute() function doesn't
 * care whether the value came from a dropdown or a keyboard.
 */

export type TokenType = "text" | "select" | "number";

export type TokenOption = {
  value: string;
  label: string;
};

export type TokenTypeDef = {
  type: TokenType;
  options?: TokenOption[];
  unit?: string;
  placeholder?: string;
};

/**
 * Registry of token types — keyed by token name.
 *
 * If a token is NOT in this registry, it renders as a free-text input
 * (the existing behaviour). If it IS in this registry with type "select",
 * the organ card renders a dropdown with the defined options.
 *
 * To add a new selectable token: add an entry here. The pathology definition
 * in pathologies.ts doesn't need to change — the token name is enough.
 */
const TOKEN_TYPE_REGISTRY: Record<string, TokenTypeDef> = {
  // ── Kidney calyx / pole location ───────────────────────────────────────
  loc: {
    type: "select",
    options: [
      { value: "upper calyx", label: "Upper calyx" },
      { value: "middle calyx", label: "Middle calyx" },
      { value: "lower calyx", label: "Lower calyx" },
      { value: "renal pelvis", label: "Renal pelvis" },
      { value: "PUJ", label: "PUJ (pelvi-ureteric junction)" },
      { value: "VUJ", label: "VUJ (vesico-ureteric junction)" },
      { value: "upper pole", label: "Upper pole" },
      { value: "lower pole", label: "Lower pole" },
      { value: "inter-polar region", label: "Inter-polar region" },
    ],
  },

  // ── Kidney cortex appearance ───────────────────────────────────────────
  cortex: {
    type: "select",
    options: [
      { value: "normal", label: "Normal thickness" },
      { value: "mildly thinned", label: "Mildly thinned" },
      { value: "markedly thinned", label: "Markedly thinned" },
      { value: "increased echogenicity", label: "↑ Echogenicity" },
      { value: "loss of cortico-medullary differentiation", label: "Loss of CMD" },
    ],
  },

  // ── Hydronephrosis grade ───────────────────────────────────────────────
  hydro_grade: {
    type: "select",
    options: [
      { value: "mild", label: "Mild (Grade I)" },
      { value: "moderate", label: "Moderate (Grade II)" },
      { value: "severe", label: "Severe (Grade III)" },
      { value: "gross", label: "Gross (Grade IV)" },
    ],
  },

  // ── Gallbladder wall ──────────────────────────────────────────────────
  gb_wall: {
    type: "select",
    options: [
      { value: "normal", label: "Normal (≤3 mm)" },
      { value: "thickened", label: "Thickened (>3 mm)" },
      { value: "markedly thickened", label: "Markedly thickened (>5 mm)" },
    ],
  },

  // ── Liver echotexture ─────────────────────────────────────────────────
  echotexture: {
    type: "select",
    options: [
      { value: "normal", label: "Normal" },
      { value: "mildly increased", label: "Mildly ↑" },
      { value: "moderately increased", label: "Moderately ↑" },
      { value: "markedly increased", label: "Markedly ↑" },
    ],
  },

  // ── Placenta position (obstetric) ─────────────────────────────────────
  placenta: {
    type: "select",
    options: [
      { value: "anterior", label: "Anterior" },
      { value: "posterior", label: "Posterior" },
      { value: "fundal", label: "Fundal" },
      { value: "lateral", label: "Lateral (right)" },
      { value: "lateral", label: "Lateral (left)" },
      { value: "low-lying", label: "Low-lying" },
      { value: "praevia", label: "Praevia" },
    ],
  },

  // ── Fetal presentation ─────────────────────────────────────────────────
  presentation: {
    type: "select",
    options: [
      { value: "cephalic", label: "Cephalic (vertex)" },
      { value: "breech", label: "Breech" },
      { value: "transverse", label: "Transverse" },
      { value: "oblique", label: "Oblique" },
    ],
  },

  // ── Liquor / amniotic fluid ────────────────────────────────────────────
  liquor: {
    type: "select",
    options: [
      { value: "normal", label: "Normal" },
      { value: "reduced", label: "Reduced (oligohydramnios)" },
      { value: "increased", label: "Increased (polyhydramnios)" },
      { value: "absent", label: "Absent (anhydramnios)" },
    ],
  },

  // ── Thyroid nodule composition ─────────────────────────────────────────
  nodule_comp: {
    type: "select",
    options: [
      { value: "solid", label: "Solid" },
      { value: "predominantly solid", label: "Predominantly solid" },
      { value: "mixed", label: "Mixed (spongiform)" },
      { value: "predominantly cystic", label: "Predominantly cystic" },
      { value: "cystic", label: "Cystic" },
    ],
  },

  // ── Thyroid nodule echogenicity ────────────────────────────────────────
  nodule_echo: {
    type: "select",
    options: [
      { value: "isoechoic", label: "Isoechoic" },
      { value: "hypoechoic", label: "Hypoechoic" },
      { value: "hyperechoic", label: "Hyperechoic" },
      { value: "very hypoechoic", label: "Very hypoechoic" },
    ],
  },

  // ── Uterus position ───────────────────────────────────────────────────
  uterine_pos: {
    type: "select",
    options: [
      { value: "anteverted", label: "Anteverted" },
      { value: "retroverted", label: "Retroverted" },
      { value: "mid-position", label: "Mid-position" },
    ],
  },

  // ── Endometrium pattern ────────────────────────────────────────────────
  endo_pattern: {
    type: "select",
    options: [
      { value: "proliferative", label: "Proliferative" },
      { value: "secretory", label: "Secretory" },
      { value: "atrophic", label: "Atrophic" },
      { value: "heterogeneous", label: "Heterogeneous" },
      { value: "thickened", label: "Thickened" },
    ],
  },

  // ── Ovarian cyst type ──────────────────────────────────────────────────
  cyst_type: {
    type: "select",
    options: [
      { value: "simple", label: "Simple" },
      { value: "complex", label: "Complex" },
      { value: "hemorrhagic", label: "Hemorrhagic" },
      { value: "dermoid", label: "Dermoid" },
      { value: "endometrioma", label: "Endometrioma" },
      { value: "septated", label: "Septated" },
    ],
  },

  // ── Prostate zone ──────────────────────────────────────────────────────
  prostate_zone: {
    type: "select",
    options: [
      { value: "peripheral zone", label: "Peripheral zone" },
      { value: "transition zone", label: "Transition zone" },
      { value: "central zone", label: "Central zone" },
      { value: "anterior fibromuscular stroma", label: "Anterior fibromuscular stroma" },
    ],
  },

  // ── Breast mass shape ─────────────────────────────────────────────────
  mass_shape: {
    type: "select",
    options: [
      { value: "oval", label: "Oval" },
      { value: "round", label: "Round" },
      { value: "irregular", label: "Irregular" },
    ],
  },

  // ── Breast mass orientation ───────────────────────────────────────────
  mass_orient: {
    type: "select",
    options: [
      { value: "parallel", label: "Parallel (wider than tall)" },
      { value: "anti-parallel", label: "Anti-parallel (taller than wide)" },
    ],
  },

  // ── Breast mass margin ─────────────────────────────────────────────────
  mass_margin: {
    type: "select",
    options: [
      { value: "circumscribed", label: "Circumscribed" },
      { value: "microlobulated", label: "Microlobulated" },
      { value: "indistinct", label: "Indistinct" },
      { value: "angular", label: "Angular" },
      { value: "spiculated", label: "Spiculated" },
    ],
  },

  // ── Scrotal fluid type ───────────────────────────────────────────────
  fluid_type: {
    type: "select",
    options: [
      { value: "simple", label: "Simple (anechoic)" },
      { value: "complex", label: "Complex (with echoes)" },
      { value: "septated", label: "Septated" },
      { value: "hemorrhagic", label: "Hemorrhagic" },
    ],
  },
};

/** Get the type definition for a token. Returns null if untyped (free-text). */
export function getTokenType(tokenKey: string): TokenTypeDef | null {
  return TOKEN_TYPE_REGISTRY[tokenKey] ?? null;
}

/** Check if a token should render as a select dropdown. */
export function isSelectToken(tokenKey: string): boolean {
  const def = getTokenType(tokenKey);
  return def?.type === "select" && (def.options?.length ?? 0) > 0;
}

/** Get the options for a select token. Returns null if not a select token. */
export function getTokenOptions(tokenKey: string): TokenOption[] | null {
  const def = getTokenType(tokenKey);
  if (def?.type !== "select") return null;
  return def.options ?? null;
}
