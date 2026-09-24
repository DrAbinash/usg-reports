/**
 * Clinic-curated advice / next-step lines keyed by pathology key.
 * Sourced from formats-usg follow-up lines (corpus B) and existing
 * `suggestions` entries. studies.ts (corpus A) wins for structure;
 * this map only fills missing advice[].
 *
 * Review table (pathology | advice | source) ships in the PR description.
 */
export const PATHOLOGY_ADVICE: Record<string, string[]> = {
  // Liver
  "liver-fatty-g1": ["Suggested: Fibroscan / elastography; correlate with LFT."],
  "liver-fatty-g1-nosize": ["Suggested: Fibroscan / elastography; correlate with LFT."],
  "liver-fatty-g2": ["Suggested: Fibroscan / elastography; correlate with LFT."],
  "liver-fatty-g2-nosize": ["Suggested: Fibroscan / elastography; correlate with LFT."],
  "liver-fatty-g3": ["Suggested: Fibroscan / elastography; correlate with LFT."],
  "liver-hepatomegaly-fatty-g1": ["Suggested: Fibroscan / elastography; correlate with LFT."],
  "liver-hepatomegaly-fatty-g1-nosize": ["Suggested: Fibroscan / elastography; correlate with LFT."],
  "liver-coarse": ["Suggested: LFT; clinical correlation."],
  "liver-coarse-nosize": ["Suggested: LFT; clinical correlation."],
  "liver-cirrhosis": ["Suggested: LFT, Upper GI endoscopy; clinical correlation."],
  "liver-sol": ["Suggested: CECT abdomen", "Suggested: FNAC"],
  "liver-hemangioma": ["Suggested: Follow-up scan / CECT if atypical."],
  "liver-haemangioma": ["Suggested: Follow-up scan / CECT if atypical."],
  "liver-abscess": ["Suggested: CECT abdomen; clinico-pathological correlation."],
  "liver-hydatid": ["Suggested: CECT abdomen; serological correlation."],
  "liver-metastasis": ["Suggested: CECT abdomen", "Suggested: FNAC"],

  // GB / CBD / Pancreas
  "gb-calculus": ["Suggested: Surgical / clinical correlation."],
  "gb-calculus-few": ["Suggested: Surgical / clinical correlation."],
  "gb-cholecystitis": ["Suggested: Surgical / clinical correlation."],
  "gb-calculus-cholecystitis": ["Suggested: Surgical / clinical correlation."],
  "gb-polyp": ["Suggested: Follow-up scan."],
  "gb-contracted": ["Suggested: Clinical correlation."],
  "cbd-dilated": ["Suggested: MRCP / ERCP"],
  "cbd-calculus": ["Suggested: MRCP / ERCP"],
  "pancreas-pancreatitis": ["Suggested: S. Amylase / S. Lipase"],
  "pancreas-chronic": ["Suggested: S. Amylase / S. Lipase; clinical correlation."],

  // Spleen
  "spleen-enlarged": ["Suggested: Clinical / haematological correlation."],
  "spleen-enlarged-nosize": ["Suggested: Clinical / haematological correlation."],
  "spleen-collateral": ["Suggested: Upper GI endoscopy; clinical correlation."],

  // Kidney / ureter / UB
  "kidney-hydro-mild": ["Suggested: Clinical correlation; follow-up scan."],
  "kidney-hydro-mod": ["Suggested: CT urography / IVU."],
  "kidney-hydro-moderate": ["Suggested: CT urography / IVU."],
  "kidney-hydro-gross": ["Suggested: CT urography / IVU."],
  "kidney-calculus": ["Suggested: X-ray KUB."],
  "kidney-calculus-few": ["Suggested: X-ray KUB."],
  "kidney-parenchymal": ["Suggested: Renal function test."],
  "kidney-cyst-simple": ["Suggested: Follow-up scan."],
  "kidney-cyst-simple-nosize": ["Suggested: Follow-up scan."],
  "kidney-pcd": ["Suggested: Clinical / nephrology correlation."],
  "ureter-calculus-distal": ["Suggested: X-ray KUB."],
  "ureter-calculus-proximal": ["Suggested: X-ray KUB / IVU."],
  "ureter-calculus-vuj": ["Suggested: X-ray KUB."],
  "ub-calculus": ["Suggested: X-ray KUB."],
  "ub-cystitis": ["Suggested: MCU/RGU (to rule out urethral stricture) if recurrent."],
  "ub-mass": ["Suggested: Cystoscopy / clinical correlation."],

  // Prostate
  "prostate-bph": ["Suggested: Serum PSA."],
  "prostate-enlarged": ["Suggested: Serum PSA."],
  "prostate-enlarged-nosize": ["Suggested: Serum PSA."],
  "prostate-median-lobe": ["Suggested: Serum PSA."],

  // Gyn
  "adnexa-cyst-simple": ["Suggested: Follow-up scan after 6 weeks."],
  "adnexa-cyst-simple-nosize": ["Suggested: Follow-up scan after 6 weeks."],
  "adnexa-cyst-complex": ["Suggested: Follow-up scan / clinical correlation."],
  "adnexa-cyst-haemorrhagic": ["Suggested: Follow-up scan after 6 weeks."],
  "adnexa-pcos": ["Suggested: Clinical / hormonal correlation."],
  "adnexa-dominant-follicle": ["Suggested: Follow-up follicular scan."],
  "adnexa-dermoid": ["Suggested: Clinical correlation / follow-up."],
  "uterus-fibroid-subserosal": ["Suggested: Clinical correlation."],
  "uterus-fibroid-intramural": ["Suggested: Clinical correlation."],
  "uterus-fibroid-submucous": ["Suggested: Clinical correlation."],
  "uterus-bulky": ["Suggested: Clinical correlation."],
  "uterus-bulky-nosize": ["Suggested: Clinical correlation."],
  "ep-ectopic": ["Suggested: UPT; urgent clinical correlation."],

  // Breast
  "breast-fibroadenoma": ["Suggested: FNAC."],
  "breast-carcinoma": ["Suggested: FNAC."],
  "breast-fibroadenosis": ["Suggested: Follow-up scan."],
  "breast-cyst": ["Suggested: Follow-up scan."],

  // Scrotum / soft tissue
  "testis-epididymo-orchitis": ["Suggested: Clinical correlation; follow-up scan."],
  "testis-hydrocele": ["Suggested: Clinical correlation."],
  "testis-varicocele": ["Suggested: Clinical correlation."],
  "swelling-abscess": ["Suggested: Clinical correlation / FNAC if indicated."],
  "swelling-lipoma": ["Suggested: Clinical correlation."],

  // Pleura / ascites
  "chest-pleural-effusion": ["Suggested: X-Ray Chest PA View."],
  "pod-collection": ["Suggested: Clinical correlation."],
  "ascites-mild": ["Suggested: Clinical correlation."],
  "ascites-moderate": ["Suggested: Clinical correlation."],
  "ascites-gross": ["Suggested: Clinical correlation."],

  // Thyroid
  "thyroid-nodule": ["Suggested: Follow-up scan / FNAC if indicated."],
  "thyroid-goitre": ["Suggested: Clinical / thyroid function correlation."],

  // Obstetric
  "ob-oligo": ["Suggested: Clinical correlation; follow-up scan."],
  "ob-poly": ["Suggested: Clinical correlation; follow-up scan."],
  "ob-iugr": ["Suggested: Clinical correlation; serial growth scans."],
  "ep-elevated-nt": ["Suggested: Genetic counselling / fetal echocardiography."],
  "ob-elevated-nt": ["Suggested: Genetic counselling / fetal echocardiography."],
};

/** Study-level all-normal advice when missing from study.defaultSuggestions. */
export const STUDY_NORMAL_ADVICE: Record<string, string[]> = {
  ep: ["Suggested: Anomaly / TIFFA scan at 20–22 weeks."],
  "ob-embryo": ["Suggested: Anomaly / TIFFA scan at 20–22 weeks."],
  "ob-nt-twin": ["Suggested: Anomaly scan at 20–22 weeks of gestational age."],
  "ob-nt-triplet": ["Suggested: Anomaly scan at 20–22 weeks of gestational age."],
  ob: ["Suggested: Clinical correlation as indicated."],
};

/** Effective advice lines for a pathology (advice → suggestions → catalog). */
export function adviceForPathology(
  key: string,
  def?: { advice?: string[]; suggestions?: string[] } | null,
): string[] {
  if (def?.advice?.length) return def.advice;
  if (def?.suggestions?.length) return def.suggestions;
  return PATHOLOGY_ADVICE[key] ?? [];
}
