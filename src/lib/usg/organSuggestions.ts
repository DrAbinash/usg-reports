/**
 * organSuggestions.ts — deterministic organ-specific suggestions.
 *
 * When a pathology is selected, the studio suggests related clinical
 * actions (measurements, checks, recommendations). No AI — purely
 * deterministic, driven by this registry.
 *
 * Ported from CARE ERP's copilotUsg* modules, simplified to a lookup
 * table that any non-technical person can read and extend.
 *
 * The suggestions appear as a subtle "Suggested" panel under the
 * selected pathology chip — the sonologist can dismiss or act on them.
 */

export type SuggestionKind = "measure" | "check" | "recommend" | "compare";

export type OrganSuggestion = {
  pathologyKey: string;
  kind: SuggestionKind;
  text: string;
  /** If "measure", the variable slot to fill (e.g. "l1" for liver length). */
  varKey?: string;
  /** If "check", the organ to verify next (e.g. "cbd" after gallstones). */
  checkOrgan?: string;
};

const SUGGESTION_REGISTRY: OrganSuggestion[] = [
  // ── Liver ───────────────────────────────────────────────────────────────
  { pathologyKey: "liver-fatty-g1", kind: "measure", text: "Measure liver span (MCL) to document hepatomegaly.", varKey: "l1" },
  { pathologyKey: "liver-fatty-g2", kind: "measure", text: "Measure liver span (MCL) and assess portal vein patency.", varKey: "l1" },
  { pathologyKey: "liver-fatty-g3", kind: "check", text: "Check for portal hypertension: splenomegaly, ascites, varices.", checkOrgan: "spleen" },
  { pathologyKey: "liver-hepatomegaly", kind: "measure", text: "Measure liver span (MCL) to document the degree of enlargement.", varKey: "l1" },
  { pathologyKey: "liver-mass", kind: "recommend", text: "CECT / MRI liver with contrast. Tumour markers (AFP, CEA, CA 19-9)." },
  { pathologyKey: "liver-haemangioma", kind: "check", text: "Confirm typical appearance (hyperechoic, well-defined). If atypical, recommend CEUS/CECT." },
  { pathologyKey: "liver-cirrhosis", kind: "check", text: "Assess for portal hypertension: splenomegaly, ascites, portosystemic collaterals." },
  { pathologyKey: "liver-cysts", kind: "check", text: "Check for polycystic kidney disease if multiple liver cysts." },

  // ── Gallbladder ─────────────────────────────────────────────────────────
  { pathologyKey: "gb_cholelithiasis", kind: "measure", text: "Measure largest stone size and gallbladder wall thickness.", varKey: "gw" },
  { pathologyKey: "gb_cholelithiasis", kind: "check", text: "Check CBD for stones / dilation. Assess for gallbladder wall thickening.", checkOrgan: "cbd" },
  { pathologyKey: "gb-sludge", kind: "check", text: "Check for associated cholelithiasis and biliary obstruction.", checkOrgan: "cbd" },
  { pathologyKey: "gb-wall-thickening", kind: "check", text: "Differential: cholecystitis vs adenomyomatosis vs gallbladder carcinoma. Assess Murphy's sign clinically." },
  { pathologyKey: "gb-polyp", kind: "measure", text: "Measure polyp size. If > 10 mm, recommend surgical consultation.", varKey: "ps" },

  // ── Kidney ──────────────────────────────────────────────────────────────
  { pathologyKey: "kidney-calculus-rt", kind: "measure", text: "Measure stone size and assess for hydronephrosis.", varKey: "r1" },
  { pathologyKey: "kidney-calculus-rt", kind: "check", text: "Check for hydronephrosis and perinephric collection.", checkOrgan: "kidney_rt" },
  { pathologyKey: "kidney-calculus-lt", kind: "measure", text: "Measure stone size and assess for hydronephrosis.", varKey: "l1" },
  { pathologyKey: "kidney-calculus-lt", kind: "check", text: "Check for hydronephrosis and perinephric collection.", checkOrgan: "kidney_lt" },
  { pathologyKey: "kidney-hydronephrosis-rt", kind: "measure", text: "Grade hydronephrosis (mild/moderate/severe) and measure renal pelvis AP diameter.", varKey: "r1" },
  { pathologyKey: "kidney-hydronephrosis-lt", kind: "measure", text: "Grade hydronephrosis (mild/moderate/severe) and measure renal pelvis AP diameter.", varKey: "l1" },
  { pathologyKey: "kidney-cortical-thinning-rt", kind: "recommend", text: "Assess renal function (serum creatinine). Evaluate for chronic kidney disease." },
  { pathologyKey: "kidney-cortical-thinning-lt", kind: "recommend", text: "Assess renal function (serum creatinine). Evaluate for chronic kidney disease." },

  // ── Prostate ────────────────────────────────────────────────────────────
  { pathologyKey: "prostate-enlarged", kind: "measure", text: "Calculate prostate volume (0.52 × L × W × H).", varKey: "p1" },
  { pathologyKey: "prostate-enlarged", kind: "recommend", text: "If volume > 30 cc or symptomatic: serum PSA, IPSS score, uroflowmetry." },
  { pathologyKey: "prostate-calcification", kind: "check", text: "Assess for associated prostatitis or BPH." },

  // ── Thyroid ─────────────────────────────────────────────────────────────
  { pathologyKey: "thyroid-nodule-rt", kind: "measure", text: "Measure nodule size (3 dimensions). Apply ACR TI-RADS scoring.", varKey: "t1" },
  { pathologyKey: "thyroid-nodule-rt", kind: "check", text: "Assess nodule characteristics: solid/cystic, echogenicity, margins, microcalcifications, taller-than-wide." },
  { pathologyKey: "thyroid-nodule-rt", kind: "recommend", text: "If TR4-TR5: recommend FNAC per ACR TI-RADS 2017 guidelines." },
  { pathologyKey: "thyroid-nodule-lt", kind: "measure", text: "Measure nodule size (3 dimensions). Apply ACR TI-RADS scoring.", varKey: "t1" },
  { pathologyKey: "thyroid-nodule-lt", kind: "check", text: "Assess nodule characteristics: solid/cystic, echogenicity, margins, microcalcifications, taller-than-wide." },
  { pathologyKey: "thyroid-nodule-lt", kind: "recommend", text: "If TR4-TR5: recommend FNAC per ACR TI-RADS 2017 guidelines." },
  { pathologyKey: "thyroid-diffuse-goitre", kind: "check", text: "Check thyroid function (TSH, T3, T4). Assess for Hashimoto's / Graves' features." },
  { pathologyKey: "thyroid-itis", kind: "recommend", text: "Thyroid antibody panel (anti-TPO, anti-Tg). Correlate with clinical thyroid function." },

  // ── Obstetric ───────────────────────────────────────────────────────────
  { pathologyKey: "ob-iugr", kind: "compare", text: "Compare with prior scan if available. Check EFW percentile on growth chart." },
  { pathologyKey: "ob-iugr", kind: "recommend", text: "Doppler: umbilical artery PI, MCA PI, ductus venosus. Follow-up in 2 weeks." },
  { pathologyKey: "ob-polyhydramnios", kind: "check", text: "Assess for gestational diabetes. Check fetal swallowing (GI obstruction)." },
  { pathologyKey: "ob-oligohydramnios", kind: "check", text: "Check for ruptured membranes (history). Assess renal anatomy (bilateral renal agenesis / obstruction)." },
  { pathologyKey: "ob-placenta-previa", kind: "recommend", text: "Advise against vaginal delivery. Follow-up at 32-34 weeks for placental migration." },
  { pathologyKey: "ob-placenta-previa", kind: "check", text: "Assess for placenta accreta spectrum if prior LSCS." },
  { pathologyKey: "ob-breech", kind: "recommend", text: "Assess mode of delivery. External cephalic version if eligible." },
  { pathologyKey: "ob-fetal-anomaly", kind: "recommend", text: "Refer to fetal medicine specialist. Consider karyotyping / genetic counselling." },

  // ── Breast ──────────────────────────────────────────────────────────────
  { pathologyKey: "breast-mass-rt", kind: "measure", text: "Measure mass (3 dimensions). Apply BI-RADS assessment.", varKey: "b1" },
  { pathologyKey: "breast-mass-rt", kind: "recommend", text: "If BI-RADS 4-5: core needle biopsy. Mammography correlation." },
  { pathologyKey: "breast-mass-lt", kind: "measure", text: "Measure mass (3 dimensions). Apply BI-RADS assessment.", varKey: "b1" },
  { pathologyKey: "breast-mass-lt", kind: "recommend", text: "If BI-RADS 4-5: core needle biopsy. Mammography correlation." },

  // ── Scrotum ─────────────────────────────────────────────────────────────
  { pathologyKey: "testis-varicocele-rt", kind: "measure", text: "Grade varicocele (Grade I-III). Measure vein diameter in standing position." },
  { pathologyKey: "testis-varicocele-rt", kind: "recommend", text: "Semen analysis if fertility concern. Urology referral if Grade II+ symptomatic." },
  { pathologyKey: "testis-varicocele-lt", kind: "measure", text: "Grade varicocele (Grade I-III). Measure vein diameter in standing position." },
  { pathologyKey: "testis-varicocele-lt", kind: "recommend", text: "Semen analysis if fertility concern. Urology referral if Grade II+ symptomatic." },
  { pathologyKey: "testis-hydrocele-rt", kind: "measure", text: "Measure hydrocele volume. Assess underlying testis." },
  { pathologyKey: "testis-hydrocele-lt", kind: "measure", text: "Measure hydrocele volume. Assess underlying testis." },
  { pathologyKey: "testis-torsion-rt", kind: "recommend", text: "EMERGENCY: Immediate surgical exploration. Do not delay for further imaging." },
  { pathologyKey: "testis-torsion-lt", kind: "recommend", text: "EMERGENCY: Immediate surgical exploration. Do not delay for further imaging." },

  // ── Uterus / Pelvis ─────────────────────────────────────────────────────
  { pathologyKey: "uterine-fibroid", kind: "measure", text: "Measure fibroid size (3 dimensions) and location (submucosal/intramural/subserosal).", varKey: "u1" },
  { pathologyKey: "uterine-fibroid", kind: "recommend", text: "Correlate with symptoms. Follow-up in 3-6 months if symptomatic." },
  { pathologyKey: "endometrial-thickening", kind: "measure", text: "Measure endometrial thickness (mm). Correlate with menstrual cycle phase." },
  { pathologyKey: "endometrial-thickening", kind: "recommend", text: "If postmenopausal > 5 mm: endometrial biopsy. Consider hysteroscopy." },
  { pathologyKey: "ovarian-cyst-rt", kind: "measure", text: "Measure cyst size. Characterise: simple/complex, septations, solid components.", varKey: "o1" },
  { pathologyKey: "ovarian-cyst-rt", kind: "recommend", text: "If simple < 5 cm: follow-up in 6 weeks. If complex or > 5 cm: tumour markers (CA-125), surgical referral." },
  { pathologyKey: "ovarian-cyst-lt", kind: "measure", text: "Measure cyst size. Characterise: simple/complex, septations, solid components.", varKey: "o1" },
  { pathologyKey: "ovarian-cyst-lt", kind: "recommend", text: "If simple < 5 cm: follow-up in 6 weeks. If complex or > 5 cm: tumour markers (CA-125), surgical referral." },
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
 * Deduplicates by text.
 */
export function getSuggestionsForPathologies(
  pathologyKeys: string[],
): OrganSuggestion[] {
  const all: OrganSuggestion[] = [];
  const seen = new Set<string>();
  for (const key of pathologyKeys) {
    for (const s of getSuggestionsForPathology(key)) {
      if (!seen.has(s.text)) {
        seen.add(s.text);
        all.push(s);
      }
    }
  }
  return all;
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
