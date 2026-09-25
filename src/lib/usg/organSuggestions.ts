/**
 * organSuggestions.ts — deterministic organ-specific suggestions.
 *
 * When a pathology is selected, the studio suggests related clinical
 * actions (measurements, checks, recommendations). No AI — purely
 * deterministic, driven by this registry.
 *
 * Keys MUST match the live pathology catalog (same discipline as
 * criticalFindings registry). Orphan keys are dropped by the drift guard
 * in tests/usgTriad.test.ts.
 */

export type SuggestionKind = "measure" | "check" | "recommend" | "compare";

export type OrganSuggestion = {
  pathologyKey: string;
  kind: SuggestionKind;
  text: string;
  /** If "measure", the variable slot to fill (e.g. "span" for liver span). */
  varKey?: string;
  /** If "check", the organ to verify next (e.g. "cbd" after gallstones). */
  checkOrgan?: string;
};

const SUGGESTION_REGISTRY: OrganSuggestion[] = [
  // ── Liver ───────────────────────────────────────────────────────────────
  { pathologyKey: "liver-fatty-g1", kind: "measure", text: "Measure liver span (MCL) to document hepatomegaly.", varKey: "span" },
  { pathologyKey: "liver-fatty-g2", kind: "measure", text: "Measure liver span (MCL) and assess portal vein patency.", varKey: "span" },
  { pathologyKey: "liver-fatty-g2", kind: "check", text: "Check for portal hypertension: splenomegaly, ascites, varices.", checkOrgan: "spleen" },
  { pathologyKey: "liver-hepatomegaly-fatty-g1", kind: "measure", text: "Measure liver span (MCL) to document the degree of enlargement.", varKey: "span" },
  { pathologyKey: "liver-sol-mets", kind: "recommend", text: "CECT / MRI liver with contrast. Tumour markers (AFP, CEA, CA 19-9)." },
  { pathologyKey: "liver-hemangioma", kind: "check", text: "Confirm typical appearance (hyperechoic, well-defined). If atypical, recommend CEUS/CECT." },
  { pathologyKey: "liver-coarse", kind: "check", text: "Assess for portal hypertension: splenomegaly, ascites, portosystemic collaterals." },
  { pathologyKey: "liver-cysts-hydatid", kind: "check", text: "Check for polycystic kidney disease if multiple liver cysts." },

  // ── Gallbladder ─────────────────────────────────────────────────────────
  { pathologyKey: "gb-calculus", kind: "measure", text: "Measure largest stone size and gallbladder wall thickness.", varKey: "size" },
  { pathologyKey: "gb-calculus", kind: "check", text: "Check CBD for stones / dilation. Assess for gallbladder wall thickening.", checkOrgan: "cbd" },
  { pathologyKey: "gb-calculus-few", kind: "check", text: "Check for associated cholelithiasis and biliary obstruction.", checkOrgan: "cbd" },
  { pathologyKey: "gb-cholecystitis", kind: "check", text: "Differential: cholecystitis vs adenomyomatosis vs gallbladder carcinoma. Assess Murphy's sign clinically." },
  { pathologyKey: "gb-polyp", kind: "measure", text: "Measure polyp size. If > 10 mm, recommend surgical consultation.", varKey: "d1" },

  // ── Kidney ──────────────────────────────────────────────────────────────
  { pathologyKey: "kidney-calculus", kind: "measure", text: "Measure stone size and assess for hydronephrosis.", varKey: "size" },
  { pathologyKey: "kidney-calculus", kind: "check", text: "Check for hydronephrosis and perinephric collection." },
  { pathologyKey: "kidney-hydro-mild", kind: "measure", text: "Grade hydronephrosis (mild/moderate/severe) and measure renal pelvis AP diameter." },
  { pathologyKey: "kidney-hydro-mod", kind: "measure", text: "Grade hydronephrosis (mild/moderate/severe) and measure renal pelvis AP diameter." },
  { pathologyKey: "kidney-parenchymal", kind: "recommend", text: "Assess renal function (serum creatinine). Evaluate for chronic kidney disease." },

  // ── Prostate ────────────────────────────────────────────────────────────
  { pathologyKey: "prostate-enlarged", kind: "measure", text: "Calculate prostate volume (0.52 × L × W × H)." },
  { pathologyKey: "prostate-enlarged", kind: "recommend", text: "If volume > 30 cc or symptomatic: serum PSA, IPSS score, uroflowmetry." },
  { pathologyKey: "prostate-calculus", kind: "check", text: "Assess for associated prostatitis or BPH." },

  // ── Thyroid ─────────────────────────────────────────────────────────────
  { pathologyKey: "thyroid-nodule", kind: "measure", text: "Measure nodule size (3 dimensions). Apply ACR TI-RADS scoring." },
  { pathologyKey: "thyroid-nodule", kind: "check", text: "Assess nodule characteristics: solid/cystic, echogenicity, margins, microcalcifications, taller-than-wide." },
  { pathologyKey: "thyroid-nodule", kind: "recommend", text: "If TR4-TR5: recommend FNAC per ACR TI-RADS 2017 guidelines." },
  { pathologyKey: "thyroid-goiter-lobe", kind: "check", text: "Check thyroid function (TSH, T3, T4). Assess for Hashimoto's / Graves' features." },
  { pathologyKey: "thyroid-thyroiditis", kind: "recommend", text: "Thyroid antibody panel (anti-TPO, anti-Tg). Correlate with clinical thyroid function." },

  // ── Obstetric ───────────────────────────────────────────────────────────
  { pathologyKey: "liquor-polyhydramnios", kind: "check", text: "Assess for gestational diabetes. Check fetal swallowing (GI obstruction)." },
  { pathologyKey: "liquor-oligohydramnios", kind: "check", text: "Check for ruptured membranes (history). Assess renal anatomy (bilateral renal agenesis / obstruction)." },
  { pathologyKey: "placenta-previa-complete", kind: "recommend", text: "Advise against vaginal delivery. Follow-up at 32-34 weeks for placental migration." },
  { pathologyKey: "placenta-previa-complete", kind: "check", text: "Assess for placenta accreta spectrum if prior LSCS." },
  { pathologyKey: "placenta-previa-partial", kind: "recommend", text: "Advise against vaginal delivery. Follow-up at 32-34 weeks for placental migration." },
  { pathologyKey: "fetus-breech", kind: "recommend", text: "Assess mode of delivery. External cephalic version if eligible." },
  { pathologyKey: "anatomy-anencephaly", kind: "recommend", text: "Refer to fetal medicine specialist. Consider karyotyping / genetic counselling." },

  // ── Breast ──────────────────────────────────────────────────────────────
  { pathologyKey: "breast-carcinoma", kind: "measure", text: "Measure mass (3 dimensions). Apply BI-RADS assessment." },
  { pathologyKey: "breast-carcinoma", kind: "recommend", text: "If BI-RADS 4-5: core needle biopsy. Mammography correlation." },
  { pathologyKey: "breast-fibroadenoma", kind: "measure", text: "Measure mass (3 dimensions). Apply BI-RADS assessment." },

  // ── Scrotum ─────────────────────────────────────────────────────────────
  { pathologyKey: "cord-varicocele", kind: "measure", text: "Grade varicocele (Grade I-III). Measure vein diameter in standing position." },
  { pathologyKey: "cord-varicocele", kind: "recommend", text: "Semen analysis if fertility concern. Urology referral if Grade II+ symptomatic." },
  { pathologyKey: "sac-hydrocele-side", kind: "measure", text: "Measure hydrocele volume. Assess underlying testis." },

  // ── Uterus / Pelvis ─────────────────────────────────────────────────────
  { pathologyKey: "uterus-fibroid-intramural", kind: "measure", text: "Measure fibroid size (3 dimensions) and location (submucosal/intramural/subserosal)." },
  { pathologyKey: "uterus-fibroid-intramural", kind: "recommend", text: "Correlate with symptoms. Follow-up in 3-6 months if symptomatic." },
  { pathologyKey: "uterus-et-thick", kind: "measure", text: "Measure endometrial thickness (mm). Correlate with menstrual cycle phase." },
  { pathologyKey: "uterus-et-thick", kind: "recommend", text: "If postmenopausal > 5 mm: endometrial biopsy. Consider hysteroscopy." },
  { pathologyKey: "adnexa-cyst-simple", kind: "measure", text: "Measure cyst size. Characterise: simple/complex, septations, solid components." },
  { pathologyKey: "adnexa-cyst-simple", kind: "recommend", text: "If simple < 5 cm: follow-up in 6 weeks. If complex or > 5 cm: tumour markers (CA-125), surgical referral." },
];

/**
 * Get suggestions for a selected pathology.
 * Returns empty array if no suggestions are registered.
 */
export function getSuggestionsForPathology(pathologyKey: string): OrganSuggestion[] {
  return SUGGESTION_REGISTRY.filter((s) => s.pathologyKey === pathologyKey);
}

/**
 * Get suggestions for multiple selected pathologies.
 * Deduplicates by text. Optionally excludes lines already in triad advice.
 */
export function getSuggestionsForPathologies(
  pathologyKeys: string[],
  excludeAdviceTexts?: Iterable<string>,
): OrganSuggestion[] {
  const excluded = new Set(
    [...(excludeAdviceTexts ?? [])].map((t) => t.trim()).filter(Boolean),
  );
  const all: OrganSuggestion[] = [];
  const seen = new Set<string>();
  for (const key of pathologyKeys) {
    for (const s of getSuggestionsForPathology(key)) {
      if (excluded.has(s.text.trim())) continue;
      if (!seen.has(s.text)) {
        seen.add(s.text);
        all.push(s);
      }
    }
  }
  return all;
}

/** Exposed for drift-guard tests (keys must exist in the pathology catalog). */
export function suggestionRegistryKeys(): string[] {
  return [...new Set(SUGGESTION_REGISTRY.map((s) => s.pathologyKey))];
}

/** Suggestion kind → display icon (lucide). */
export function suggestionIcon(kind: SuggestionKind): string {
  switch (kind) {
    case "measure":
      return "Ruler";
    case "check":
      return "Stethoscope";
    case "recommend":
      return "ClipboardList";
    case "compare":
      return "GitCompare";
  }
}

/** Suggestion kind → display colour (Tailwind classes). */
export function suggestionColour(kind: SuggestionKind): string {
  switch (kind) {
    case "measure":
      return "text-sky-700 bg-sky-50 border-sky-200";
    case "check":
      return "text-amber-700 bg-amber-50 border-amber-200";
    case "recommend":
      return "text-violet-700 bg-violet-50 border-violet-200";
    case "compare":
      return "text-emerald-700 bg-emerald-50 border-emerald-200";
  }
}
