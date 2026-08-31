/**
 * USG small parts + vascular + echo formats — curated verbatim from the
 * doctor's own library (docs/report-formats/usg: Breast/, Thyroiditis/,
 * Scrotum n Testis/, Doppler/, echo/, OTHER/).
 */
import type { FormatSeed, FormatRowSeed } from "@/lib/seedData";

const REC = "Please correlate with clinical features.";
const ECHO_REC = "Kindly take expert echocardiologist's opinion.";

const row = (region: string) => (concept: string, text: string, extra: Partial<FormatRowSeed> = {}): FormatRowSeed => ({
  region, concept, text, inImpression: false, ...extra,
});

const B = row("USG Breast");
const N = row("USG Neck");
const S = row("USG Scrotum");
const D = row("USG Doppler");
const E = row("2D Echo");

export const USG_SMALLPARTS_FORMATS: FormatSeed[] = [
  // ── Breast ────────────────────────────────────────────────────────────────
  {
    key: "usg-breast-normal", modality: "USG", region: "USG Breast",
    name: "Normal", studyTitle: "USG BREAST", titleSuffix: "",
    technique: "High frequency (7.5-12 MHz) linear transducer was used to scan both breasts.",
    recommendation: REC, isNormal: true, sortOrder: 1,
    rows: [
      B("tissue", "Fibro fatty tissue appears normal."),
      B("retroareolar", "Retroareolar area appears normal. No ductal dilatation seen."),
      B("lesion", "No focal or diffuse lesion seen."),
      B("muscle", "Pectoralis major muscle appears normal. Bone soft tissue interface is intact."),
      B("axilla", "No lymphadenopathy seen in the axillary region."),
      { region: "USG Breast", concept: "normal_impression", text: "No significant abnormality detected.", inImpression: true, impressionOnly: true },
    ],
  },
  {
    key: "usg-fibroadenosis", modality: "USG", region: "USG Breast",
    name: "Fibroadenotic Changes", studyTitle: "USG BREAST",
    titleSuffix: "fibroadenotic changes",
    technique: "High frequency (7.5-12 MHz) linear transducer was used to scan both breasts.",
    recommendation: REC, isNormal: false, sortOrder: 2,
    rows: [
      B("tissue", "Fibro glandular tissue shows heterogeneous echotexture with multiple small hypoechoic areas and cystic changes, S/o Fibroadenotic changes.", { inImpression: true }),
      B("retroareolar", "Retroareolar area appears normal. No ductal dilatation seen."),
      B("lesion", "No dominant focal lesion seen."),
      B("muscle", "Pectoralis major muscle appears normal. Bone soft tissue interface is intact."),
      B("axilla", "No significant axillary lymphadenopathy seen."),
    ],
  },
  {
    key: "usg-fibroadenoma", modality: "USG", region: "USG Breast",
    name: "Fibroadenoma", studyTitle: "USG BREAST",
    titleSuffix: "fibroadenoma",
    technique: "High frequency (7.5-12 MHz) linear transducer was used to scan the breast.",
    recommendation: "Clinico-pathological correlation. FNAC suggested. Follow up scan.", isNormal: false, sortOrder: 3,
    rows: [
      B("lesion", "A well-defined hypoechoic mobile mass (size ___ x ___ cm) with lobulated margin is seen in the ___ quadrant. Colour doppler shows mild internal vascularity.", { inImpression: true }),
      B("tissue", "Rest of the fibro fatty tissue appears normal."),
      B("retroareolar", "No ductal dilatation seen."),
      B("muscle", "Pectoralis major muscle appears normal. Bone soft tissue interface is intact."),
      B("axilla", "No lymphadenopathy seen in the axillary region."),
    ],
  },

  // ── Neck / thyroid ────────────────────────────────────────────────────────
  {
    key: "usg-neck-normal", modality: "USG", region: "USG Neck",
    name: "Normal Neck (Thyroid + Salivary)", studyTitle: "USG NECK", titleSuffix: "",
    technique: "High frequency (7.5-12 MHz) linear transducer was used to scan the neck.",
    recommendation: REC, isNormal: true, sortOrder: 1,
    rows: [
      N("thyroid_rt", "Right lobe of thyroid is normal in size and measures ___ cm in AP diameter. Parenchymal echogenicity is normal. No S.O.L or calcification seen. Colour doppler shows normal blood flow."),
      N("thyroid_lt", "Left lobe of thyroid is normal in size and measures ___ cm in AP diameter. Parenchymal echogenicity is normal. No S.O.L or calcification seen. Colour doppler shows normal blood flow."),
      N("isthmus", "Isthmus is normal in thickness (___ cm). Parenchymal echogenicity is normal."),
      N("salivary", "Bilateral submandibular glands are normal in echotexture. No S.O.L or calcification seen."),
      N("parotid", "Bilateral parotid glands are normal in echotexture. No S.O.L or calcification seen."),
      N("nodes", "No significant cervical lymphadenopathy seen."),
      { region: "USG Neck", concept: "normal_impression", text: "Normal study.", inImpression: true, impressionOnly: true },
    ],
  },
  {
    key: "usg-thyroiditis", modality: "USG", region: "USG Neck",
    name: "Thyroiditis", studyTitle: "COLOUR DOPPLER NECK",
    titleSuffix: "thyroiditis",
    technique: "High frequency (7.5-12 MHz) linear transducer with colour doppler was used to scan the thyroid.",
    recommendation: "Thyroid function test advised. " + REC, isNormal: false, sortOrder: 2,
    rows: [
      N("thyroid_rt", "Right lobe is enlarged in size and measures ___ cm in AP diameter. Parenchymal echogenicity is reduced with heterogeneous echotexture. No S.O.L or calcification seen. Colour doppler shows increased blood flow.", { inImpression: true }),
      N("thyroid_lt", "Left lobe is enlarged in size and measures ___ cm in AP diameter. Parenchymal echogenicity is reduced with heterogeneous echotexture. No S.O.L or calcification seen. Colour doppler shows increased blood flow.", { inImpression: true }),
      N("isthmus", "Isthmus is enlarged and measures ___ cm. Parenchymal echogenicity is reduced with heterogeneous echotexture.", { inImpression: true }),
      N("salivary", "Bilateral submandibular glands are normal in echotexture. No S.O.L or calcification seen."),
      N("parotid", "Bilateral parotid glands are normal in echotexture. No S.O.L or calcification seen."),
    ],
  },
  {
    key: "usg-mng", modality: "USG", region: "USG Neck",
    name: "Multinodular Goitre", studyTitle: "USG NECK",
    titleSuffix: "multinodular goitre",
    technique: "High frequency (7.5-12 MHz) linear transducer was used to scan the thyroid.",
    recommendation: REC, isNormal: false, sortOrder: 3,
    rows: [
      N("thyroid_rt", "Right lobe is enlarged and shows multiple nodules of varying sizes, largest ___ x ___ cm, with cystic degeneration and calcification. Background parenchymal echogenicity is heterogeneous.", { inImpression: true }),
      N("thyroid_lt", "Left lobe is enlarged and shows multiple nodules of varying sizes, largest ___ x ___ cm.", { inImpression: true }),
      N("isthmus", "Isthmus is thickened and measures ___ cm."),
      N("nodes", "No significant cervical lymphadenopathy seen."),
    ],
  },
  {
    key: "usg-colloid-cyst", modality: "USG", region: "USG Neck",
    name: "Colloid Nodule / Cyst", studyTitle: "USG NECK",
    titleSuffix: "colloid nodule",
    technique: "High frequency (7.5-12 MHz) linear transducer was used to scan the thyroid.",
    recommendation: REC, isNormal: false, sortOrder: 4,
    rows: [
      N("thyroid_rt", "Right lobe of thyroid is normal in size. A well-defined anechoic cystic lesion (___ x ___ cm) with comet-tail artefacts is seen in the ___ lobe, S/o Colloid cyst.", { inImpression: true }),
      N("thyroid_lt", "Left lobe of thyroid is normal in size and echotexture. No S.O.L or calcification seen."),
      N("isthmus", "Isthmus is normal in thickness."),
    ],
  },

  // ── Scrotum ───────────────────────────────────────────────────────────────
  {
    key: "usg-scrotum-normal", modality: "USG", region: "USG Scrotum",
    name: "Normal Scrotum + Doppler", studyTitle: "USG COLOUR DOPPLER SCROTUM", titleSuffix: "",
    technique: "High frequency (7.5-12 MHz) linear transducer with colour doppler was used to scan the scrotum.",
    recommendation: REC, isNormal: true, sortOrder: 1,
    rows: [
      S("testis_rt", "Right testis measures ___ x ___ mm. Appears normal in size, shape and echotexture. Epididymis is normal in size and texture. Colour doppler shows normal blood flow pattern."),
      S("testis_lt", "Left testis measures ___ x ___ mm. Appears normal in size, shape and echotexture. Epididymis is normal in size and texture. Colour doppler shows normal blood flow pattern."),
      S("inguinal", "Bilateral spermatic cords are normal in size with normal blood flow pattern."),
      S("collection", "No collection is seen in the scrotal sacs."),
      { region: "USG Scrotum", concept: "normal_impression", text: "Normal study.", inImpression: true, impressionOnly: true },
    ],
  },
  {
    key: "usg-hydrocele", modality: "USG", region: "USG Scrotum",
    name: "Hydrocele", studyTitle: "USG COLOUR DOPPLER SCROTUM",
    titleSuffix: "hydrocele",
    technique: "High frequency (7.5-12 MHz) linear transducer with colour doppler was used to scan the scrotum.",
    recommendation: REC, isNormal: false, sortOrder: 2,
    rows: [
      S("testis_rt", "Right testis measures ___ x ___ mm. Appears normal in size, shape and echotexture. Epididymis is normal in size and texture. Colour doppler shows normal blood flow pattern."),
      S("testis_lt", "Left testis measures ___ x ___ mm. Appears normal in size, shape and echotexture. Epididymis is normal in size and texture. Colour doppler shows normal blood flow pattern."),
      S("collection", "Moderate collection is seen in the ___ scrotal sac, S/o Hydrocele.", { inImpression: true }),
      S("inguinal", "Bilateral spermatic cords are normal in size with normal blood flow pattern."),
    ],
  },
  {
    key: "usg-varicocele", modality: "USG", region: "USG Scrotum",
    name: "Varicocele", studyTitle: "USG COLOUR DOPPLER SCROTUM",
    titleSuffix: "varicocele",
    technique: "High frequency (7.5-12 MHz) linear transducer with colour doppler and Valsalva manoeuvre was used to scan the scrotum.",
    recommendation: REC, isNormal: false, sortOrder: 3,
    rows: [
      S("testis_rt", "Right testis measures ___ x ___ mm. Appears normal in size, shape and echotexture. Colour doppler shows normal blood flow pattern."),
      S("testis_lt", "Left testis measures ___ x ___ mm. Appears normal in size, shape and echotexture. Colour doppler shows normal blood flow pattern."),
      S("inguinal", "___ pampiniform plexus of veins are dilated (largest ___ mm) with positive Valsalva test, S/o Varicocele.", { inImpression: true }),
    ],
  },
  {
    key: "usg-epididymo-orchitis", modality: "USG", region: "USG Scrotum",
    name: "Epididymo-orchitis", studyTitle: "USG COLOUR DOPPLER SCROTUM",
    titleSuffix: "epididymo-orchitis",
    technique: "High frequency (7.5-12 MHz) linear transducer with colour doppler was used to scan the scrotum.",
    recommendation: REC, isNormal: false, sortOrder: 4,
    rows: [
      S("testis_rt", "Right testis measures ___ x ___ mm. Appears normal in size, shape and echotexture. Colour doppler shows normal blood flow pattern."),
      S("testis_lt", "Left testis is enlarged, measures ___ x ___ mm, with decreased echogenicity. Head, body and tail of epididymis are enlarged, heterogeneous in echotexture. Colour doppler shows increased vascularity.", { inImpression: true }),
      S("collection", "Mild collection is seen in the left scrotal sac."),
      S("inguinal", "Left spermatic cord is thickened. Colour doppler shows increased flow."),
    ],
  },
  {
    key: "usg-undescended", modality: "USG", region: "USG Scrotum",
    name: "Undescended Testis", studyTitle: "USG SCROTUM + INGUINAL",
    titleSuffix: "undescended testis",
    technique: "High frequency (7.5-12 MHz) linear transducer was used to scan the scrotum and both inguinal regions.",
    recommendation: REC, isNormal: false, sortOrder: 5,
    rows: [
      S("testis_rt", "Right testis is not seen in the scrotal sac. A small ovoid soft tissue structure (___ x ___ cm) with testicular echotexture is seen in the right inguinal canal, S/o Undescended testis.", { inImpression: true }),
      S("testis_lt", "Left testis measures ___ x ___ mm. Appears normal in size, shape and echotexture."),
    ],
  },

  // ── Doppler ───────────────────────────────────────────────────────────────
  {
    key: "usd-ll-venous-normal", modality: "USG", region: "USG Doppler",
    name: "Lower Limb Venous — Normal", studyTitle: "COLOUR DOPPLER BOTH LOWER LIMBS",
    titleSuffix: "",
    technique: "Bilateral lower limb venous doppler was performed with the patient supine, using a linear transducer with graded compression.",
    recommendation: REC, isNormal: true, sortOrder: 1,
    rows: [
      D("rt_veins", "Right common femoral, superficial femoral and popliteal veins are normal in calibre and compressible. Spontaneous and phasic flow with normal augmentation on distal compression is seen on colour and spectral doppler."),
      D("lt_veins", "Left common femoral, superficial femoral and popliteal veins are normal in calibre and compressible. Spontaneous and phasic flow with normal augmentation is seen."),
      D("calf", "Calf veins are normal and compressible on both sides."),
      D("saphenous", "No evidence of saphenous or perforator incompetence."),
      { region: "USG Doppler", concept: "normal_impression", text: "No evidence of deep vein thrombosis in both lower limbs.", inImpression: true, impressionOnly: true },
    ],
  },
  {
    key: "usd-dvt", modality: "USG", region: "USG Doppler",
    name: "DVT", studyTitle: "COLOUR DOPPLER BOTH LOWER LIMBS",
    titleSuffix: "deep vein thrombosis",
    technique: "Bilateral lower limb venous doppler was performed with the patient supine, using a linear transducer with graded compression.",
    recommendation: REC, isNormal: false, sortOrder: 2,
    rows: [
      D("rt_veins", "Right common femoral, superficial femoral and popliteal veins are normal in calibre and compressible with normal flow."),
      D("lt_veins", "___ femoral and popliteal vein is dilated and non-compressible with echogenic thrombus seen within, showing no flow on colour doppler, S/o Deep vein thrombosis.", { inImpression: true }),
      D("calf", "Calf veins are normal and compressible on both sides."),
    ],
  },
  {
    key: "usd-ll-arterial-normal", modality: "USG", region: "USG Doppler",
    name: "Lower Limb Arterial — Normal", studyTitle: "ARTERIAL DOPPLER BOTH LOWER LIMBS",
    titleSuffix: "",
    technique: "Bilateral lower limb arterial doppler was performed with the patient supine, using a linear transducer.",
    recommendation: REC, isNormal: true, sortOrder: 3,
    rows: [
      D("rt_artery", "Right common femoral, superficial femoral, popliteal and tibial arteries show normal diameter with normal triphasic spectral waveform and normal peak systolic velocities. No plaque or calcification seen."),
      D("lt_artery", "Left common femoral, superficial femoral, popliteal and tibial arteries show normal diameter with normal triphasic spectral waveform and normal peak systolic velocities. No plaque or calcification seen."),
      { region: "USG Doppler", concept: "normal_impression", text: "Normal arterial study of both lower limbs.", inImpression: true, impressionOnly: true },
    ],
  },
  {
    key: "usd-carotid-normal", modality: "USG", region: "USG Doppler",
    name: "Carotid Doppler — Normal", studyTitle: "BILATERAL CAROTID DOPPLER", titleSuffix: "",
    technique: "Bilateral carotid doppler was performed with the patient supine, using a linear transducer.",
    recommendation: REC, isNormal: true, sortOrder: 4,
    rows: [
      D("carotid", "Both the common carotid arteries, carotid bulbs and the proximal internal and external carotid arteries are normal in diameter. Normal intimo-media complex is seen. No focal plaque, thrombosis or dissection seen."),
      D("spectral", "On colour and spectral doppler study, normal spectral waveforms and velocities are seen on both sides. No turbulence noted."),
      D("vertebral", "Vertebral arteries reveal normal flow velocity, direction of flow and spectral waveform."),
      D("ijv", "Bilateral internal jugular veins are patent and show spontaneous flow."),
      { region: "USG Doppler", concept: "normal_impression", text: "Normal carotid doppler study.", inImpression: true, impressionOnly: true },
    ],
  },

  // ── 2D Echo ───────────────────────────────────────────────────────────────
  {
    key: "echo-normal-adult", modality: "USG", region: "2D Echo",
    name: "2D Echo — Normal Adult", studyTitle: "2D ECHOCARDIOGRAPHY", titleSuffix: "",
    technique: "M-mode, 2D and colour doppler echocardiography was performed in left lateral decubitus position.",
    recommendation: ECHO_REC, isNormal: true, sortOrder: 1,
    rows: [
      E("dimensions", "M-mode dimensions — LA ___ mm (20-40), AO root ___ mm (20-40), LVID(d) ___ mm (35-45), LVID(s) ___ mm (24-42), LVEF ___ %, RV ___ mm (7-23), RA ___ mm (6-24), IVS(d) ___ mm (6-11), PW(d) ___ mm (6-11)."),
      E("mv", "Mitral valve: the AML shows normal cusps thickness and excursion. No calcification, no doming, no SAM."),
      E("av", "Aortic valve: normal thickness and excursions."),
      E("tv_pv", "Tricuspid and pulmonary valves: normal cusps. Pulmonary annulus and its branches are normal."),
      E("septa", "IAS and IVS are intact."),
      E("pericardium", "No pericardial effusion."),
      E("clot", "No LA/LV clot."),
      E("others", "No PDA / ASD / VSD. Situs solitus with left-sided aortic arch."),
      E("function", "Normal LV/RV systolic function. No regional wall motion abnormality detected."),
      { region: "2D Echo", concept: "normal_impression", text: "No chamber dilatation. Normally functioning cardiac valves. No pericardial effusion. No regional wall motion abnormality.", inImpression: true, impressionOnly: true },
    ],
  },
  {
    key: "echo-asd", modality: "USG", region: "2D Echo",
    name: "ASD with Dilated RA/RV", studyTitle: "2D ECHOCARDIOGRAPHY",
    titleSuffix: "atrial septal defect",
    technique: "M-mode, 2D and colour doppler echocardiography was performed in left lateral decubitus position.",
    recommendation: ECHO_REC, isNormal: false, sortOrder: 2,
    rows: [
      E("asd", "A wide defect (___ mm) is seen in the interatrial septum (ostium secundum) with left-to-right shunt on colour doppler, S/o Atrial septal defect.", { inImpression: true }),
      E("ra_rv", "Right atrium and right ventricle are dilated.", { inImpression: true }),
      E("mv", "Mitral valve: normal cusps thickness and excursion."),
      E("av", "Aortic valve: normal thickness and excursions."),
      E("septa", "IVS is intact. IAS — see above."),
      E("pericardium", "No pericardial effusion."),
      E("function", "Normal LV systolic function. RV systolic pressure appears normal. No regional wall motion abnormality."),
    ],
  },
  {
    key: "echo-ms", modality: "USG", region: "2D Echo",
    name: "Mitral Stenosis", studyTitle: "2D ECHOCARDIOGRAPHY",
    titleSuffix: "mitral stenosis",
    technique: "M-mode, 2D and colour doppler echocardiography was performed in left lateral decubitus position.",
    recommendation: ECHO_REC, isNormal: false, sortOrder: 3,
    rows: [
      E("mv", "Mitral valve leaflets are thickened with restricted opening and doming of the AML. Mitral valve orifice area ___ cm2 by planimetry, S/o Mitral stenosis (___ severity). Colour doppler shows accelerated flow across the valve.", { inImpression: true }),
      E("la", "Left atrium is dilated.", { inImpression: true }),
      E("clot", "No LA/LV clot seen."),
      E("av", "Aortic valve: normal thickness and excursions."),
      E("septa", "IAS is intact."),
      E("pericardium", "No pericardial effusion."),
      E("function", "Normal LV systolic function. Estimated PASP ___ mmHg."),
    ],
  },
  {
    key: "echo-lv-hypertrophy", modality: "USG", region: "2D Echo",
    name: "LV Hypertrophy + Diastolic Dysfunction", studyTitle: "2D ECHOCARDIOGRAPHY",
    titleSuffix: "left ventricular hypertrophy with diastolic dysfunction",
    technique: "M-mode, 2D and colour doppler echocardiography was performed in left lateral decubitus position.",
    recommendation: ECHO_REC, isNormal: false, sortOrder: 4,
    rows: [
      E("lv_wall", "LV walls are concentrically hypertrophied — IVS ___ mm, PW ___ mm.", { inImpression: true }),
      E("function", "Normal LV systolic function (LVEF ___ %) with Grade ___ diastolic dysfunction on transmitral doppler.", { inImpression: true }),
      E("mv", "Mitral valve: normal cusps thickness and excursion."),
      E("av", "Aortic valve shows sclerosis with normal excursion."),
      E("septa", "IAS and IVS are intact."),
      E("pericardium", "No pericardial effusion."),
    ],
  },
];
