/**
 * USG Studio — study definitions (organ scaffolds).
 *
 * Every normal line below is the doctor's own wording, curated verbatim from
 * the USG format library (formats-usg / "normal reports (SIR)"): the male and
 * female whole-abdomen normals, lower-abdomen normals and the upper-abdomen
 * normal. Medico-legal rule inherited from the MRI formats: whole-abdomen
 * normals carry NO fill-in blanks — a normal scan is one tap and print.
 * The lower-abdomen (gyn) normals DO carry the doctor's measurement slots
 * (uterus 3 dims + ET + both ovaries) because that is how she reports them.
 */
import type { UsgComposerState, UsgStudyDef, UsgVarDef } from "./types";

const V = (key: string, label: string, unit = "cm"): UsgVarDef => ({ key, label, unit });

const T_WA =
  "Ultrasonography of the whole abdomen was performed in supine position using a curvilinear 3.5 MHz transducer.";
const T_UA =
  "Ultrasonography of the upper abdomen was performed in supine position using a curvilinear 3.5 MHz transducer.";
const T_LA =
  "Ultrasonography of the lower abdomen was performed in supine position using a curvilinear 3.5 MHz transducer.";
const T_OB =
  "Obstetric ultrasonography was performed by transabdominal approach using a curvilinear 3.5 MHz transducer.";
const T_EP =
  "Ultrasonography of the lower abdomen was performed in supine position using a curvilinear 3.5 MHz transducer.";
const T_KUB =
  "Ultrasonography of the KUB region (kidneys, ureters and urinary bladder) was performed in supine position using a curvilinear 3.5 MHz transducer. Post-void residual urine was measured where possible.";
const T_THY =
  "High resolution ultrasonography of the thyroid gland and neck was performed using a linear high frequency 7.5-10 MHz transducer with colour Doppler study.";
const T_BREAST =
  "High resolution sonomammography of both breasts was performed using a linear high frequency 7.5-10 MHz transducer.";
const T_SCROTUM =
  "High resolution ultrasonography of the scrotum with colour Doppler study was performed using a linear high frequency 7.5-10 MHz transducer.";
const T_TVS =
  "Transvaginal sonography was performed using an endocavitary 6.5-7.5 MHz transducer with colour Doppler study.";
const T_TRUS =
  "Transrectal sonography of the prostate was performed using an endocavitary 6.5-7.5 MHz transducer.";
const T_ECHO =
  "Two dimensional, M-mode and colour Doppler echocardiography was performed with the patient in left lateral decubitus position using standard parasternal and apical windows.";
const T_DOP_LL =
  "Colour Doppler study of both lower limbs (arterial and venous system) was performed using a linear high frequency 5-7.5 MHz transducer.";
const T_DOP_UL =
  "Colour Doppler study of both upper limbs (arterial and venous system) was performed using a linear high frequency 5-7.5 MHz transducer.";
const T_CAROTID =
  "Colour Doppler study of both carotid and vertebral arteries was performed using a linear high frequency 5-7.5 MHz transducer with spectral analysis.";
const T_CHEST =
  "Ultrasonography of the chest (chest wall, pleura and lung bases) was performed using a curvilinear 3.5-5 MHz transducer with colour Doppler study.";
const T_CRANIUM =
  "Cranial ultrasonography was performed through the anterior fontanelle using a linear high frequency 5-7.5 MHz transducer.";
const T_ORBIT =
  "High resolution ultrasonography of both orbits was performed using a linear high frequency 7.5-10 MHz transducer.";
const T_SWELLING =
  "High resolution ultrasonography of the swelling / soft tissue region was performed using a linear high frequency 7.5-10 MHz transducer with colour Doppler study.";

// ── The doctor's normal organ lines (verbatim) ─────────────────────────────
export const LIVER_N =
  "Liver appears normal in morphology and parenchymal echogenicity. No masses or focal pathology is noted. Intrahepatic biliary channels are not dilated. The portal vein is normal in appearance.";
export const GB_N =
  "Gall bladder is normal in physiological distension. No calculi or other intrinsic lesions are noted. Wall thickness is normal. No pericholecystic collection. Sonographic Murphy's sign negative.";
export const CBD_N = "Diameter of the C.B.D is normal. No evidence of intraluminal calculus.";
export const PANCREAS_N =
  "Pancreas appears normal in morphology and parenchymal echogenicity. Pancreatic duct is not dilated. No evidence of calcification or focal lesion is seen.";
export const SPLEEN_N =
  "Spleen appears normal in morphology and parenchymal echogenicity. No evidence of focal lesion or S.O.L seen. No evidence of splenic collateral vessels.";
export const KIDNEY_N =
  "Normal in shape, size & position. Sinuses as well as cortical echoes are normal. No evidence of calculus, space occupying lesion, cyst or hydronephrosis is seen.";
export const URETERS_N = "Proximal and distal ureters are normal.";
export const UB_N =
  "Urinary bladder is normal in outline and distension. It is echo free. No evidence of calculus, mass or diverticulum is seen. Insignificant post void residual urine.";
export const PROSTATE_N =
  "Prostate is normal in size and echotexture. It is echo free. No evidence of focal lesion or S.O.L noted.";
export const RIF_N = "No obvious mass lesion is seen.";
export const OTHERS_N = "No free peritoneal fluid / enlarged lymph nodes are seen.";
export const UTERUS_N =
  "Uterus is normal in size and shape. The uterus is in anteversion with normal endometrial thickness. No focal pathology or abnormalities of outline are noted. The cervical echo is normal.";
export const ADNEXA_N = "Ovaries are normally positioned. Normal in echotexture.";
export const POD_N = "Pouch of Douglas is clear.";

// ── Paediatric normals ("Child/A Normal child.doc") — measured organs ──────
export const LIVER_CHILD_N =
  "Liver measures in mid-clavicular line {span} cm. Appears normal in size and morphology. No masses or focal pathology is noted. Intrahepatic biliary channels are not dilated. The portal vein is normal in appearance.";
export const SPLEEN_CHILD_N =
  "Spleen measures {span} cm and appears normal in morphology and parenchymal echogenicity. No evidence of focal lesion or S.O.L seen. No evidence of splenic collateral vessels.";
export const KIDNEY_CHILD_N =
  "Normal in shape, size & position. Measures {span} cm. Sinuses as well as cortical echoes are normal. No evidence of calculus, space occupying lesion, cyst or hydronephrosis is seen.";
export const UB_CHILD_N =
  "Urinary bladder is normal in outline and distension. It is echofree. No evidence of calculus, mass or diverticulum is seen.";
export const OTHERS_CHILD_N =
  "No enlarged mesenteric lymph nodes or intraperitoneal collection.";

// ── Obstetric normals (her ANTENATAL SCAN formats, verbatim) ───────────────
// v6.12: {lie} is a select-token (cephalic/breech/oblique/transverse/variable)
// registered in tokenTypes.ts. The composer substitutes it at render time;
// the doctor picks from a dropdown in the FETUS organ card.
export const FETUS_N =
  "There is a Single live intrauterine fetus in {lie} presentation at the time of examination.";
export const FETUS_IMPRESSION_N =
  "A single live intrauterine fetus at {gaw} wk {gad} days of average gestational age in {lie} presentation.";
export const BIOMETRY_N =
  "Fetal parameters-\nB.P.D {bpd} mm    {bpdw} Weeks  {bpdd} Days\nH.C {hc} mm    {hcw} Weeks  {hcd} Days\nA.C {ac} mm    {acw} Weeks  {acd} Days\nF.L. {fl} mm.   {flw} Weeks  {fld} Days\n\nParameters corresponding to mean GA : {gaw} weeks {gad} days ( ± 2 weeks)\n\nE.D.D. as per scan : {edd}\n\nFetal weight in grams : {ewt} ( ± {ewtd} ) g\n\nFHR : {fhr} B/Min & Regular.";
export const ANATOMY_N =
  "Heart is 4 chambered with apex towards left. The stomach, kidney, neck and spine were scanned and examined which appears normal. The fetal thoracic movements are normal during respiration. Fetal limb movements are present.";
export const PLACENTA_N =
  "Placenta is located {position} ( maturity Grade {grade} ). The lower part is not extending upto the lower segment. Internal os is closed.";
export const LIQUOR_N = "Liquor AFI - {afi} cm.";

// ── Early pregnancy normals (her 6–8 week format, verbatim) ────────────────
export const GRAVID_UTERUS_N =
  "Bulky anteverted uterus contains solitary intrauterine gestational sac with an alive embryo node within. The gestational sac is double walled with regular outline. The foetal node shows:\n- Active cardiac flickering.\n- Active somatic movement.\n- Regular M-mode cardiac tracing (Heart Rate: {fhr} bpm).\nOs is closed. Cervix appears long. The gestational age is {gaw} weeks {gad} days as per C.R.L measurements.\n\nC.R.L. measures : {crl} mm = {gaw} weeks {gad} days\n\nE.D.D : {edd}";
export const GRAVID_UTERUS_IMPRESSION_N =
  "A single live intrauterine embryo at {gaw} weeks {gad} days of average gestational age.";

/** Gyn (lower abdomen) normals carry the doctor's measurement slots. */
export const UTERUS_MEASURED_N =
  "Uterus is normal in size and shape & measures {u1} x {u2} x {u3} cm. The uterus is positioned in anteversion, with normal endometrial thickness ({et} cm). No focal pathology or abnormalities of outline are noted. The cervical echo is normal.";
export const ADNEXA_MEASURED_N =
  "Ovaries are normally positioned. Normal in echotexture. RT. Ovary measures {rov1} cm x {rov2} cm. LT. Ovary measures {lov1} cm x {lov2} cm.";

// ── KUB normals — her KUB-calculus formats, measured split kidneys ────────────
export const KIDNEY_RT_KUB_N =
  "Right kidney measures {span} cm. Shape, size and axis of the right kidney is normal. Renal length within normal limits. Corticomedullary echopattern is normal. No hydronephrotic changes, masses or other intrinsic pathology is noted.";
export const KIDNEY_LT_KUB_N =
  "Left kidney measures {span} cm. Shape, size and axis of the left kidney is normal. Renal length within normal limits. Corticomedullary echopattern is normal. No hydronephrotic changes, masses or other intrinsic pathology is noted.";

// ── Thyroid normals (her "USG THYROID" / "NECK NORMAL DOPPLER" formats) ──────
export const THY_RT_N =
  "Right lobe measures {r1} X {r2} mm in AP diameter. It is normal in echotexture. No SOL or calcification seen. Color Doppler shows normal blood flow.";
export const THY_LT_N =
  "Left lobe measures {l1} X {l2} mm in AP diameter. It is normal in echotexture. No SOL or calcification seen. Color Doppler shows normal blood flow.";
export const THY_ISTHMUS_N =
  "Isthmus measure {isth} mm. Normal in size and echotexture. Color Doppler shows normal blood flow.";
/** Peak-time thyroid normals — qualitative, no lobe/isthmus millimetres. */
export const THY_RT_QUICK_N =
  "Right lobe is normal in size and echotexture. No SOL or calcification seen. Color Doppler shows normal blood flow.";
export const THY_LT_QUICK_N =
  "Left lobe is normal in size and echotexture. No SOL or calcification seen. Color Doppler shows normal blood flow.";
export const THY_ISTHMUS_QUICK_N =
  "Isthmus is normal in size and echotexture. Color Doppler shows normal blood flow.";
export const THY_SUBMAND_N =
  "Bilateral submandibular glands are normal in echotexture. No SOL or calcification seen. Color Doppler shows normal blood flow.";
export const THY_PAROTID_N =
  "Bilateral parotid glands are normal in echotexture. No SOL or calcification seen. Color Doppler shows normal blood flow.";
export const THY_NODES_N = "There is no e/o cervical lymphadenopathy.";
export const THY_VESSELS_N = "Neck vessels are normal.";

// ── Breast normals (her "U.S.G OF BREAST" normal + sonomammography scaffold) ──
export const BREAST_RT_N =
  "Fibro fatty tissue appears normal. Retroareolar area appears normal. No ductal dilatation seen. No focal or diffuse lesion seen.";
export const PECTORALIS_N =
  "Both pectoralis muscles are normal in echogenicity. Bone soft tissue interface is intact.";
export const AXILLA_N = "No axillary lymphadenopathy is seen.";

// ── Scrotum normals ("U.S.G OF SCROTUM", verbatim) ─────────────────────────
export const TESTIS_RT_N =
  "Measures {t1} X {t2} mm. Appear normal in size, shape and echotexture. Epididymis is normal in size and texture. Color Doppler shows normal blood flow pattern.";
export const TESTIS_LT_N =
  "Measures {t1} X {t2} mm. Appear normal in size, shape and echotexture. Epididymis is normal in size and texture. Color Doppler shows normal blood flow pattern.";
/** Peak-time scrotum normals — no testicular dimensions. */
export const TESTIS_QUICK_N =
  "Appear normal in size, shape and echotexture. Epididymis is normal in size and texture. Color Doppler shows normal blood flow pattern.";
export const SAC_N = "No collection in either scrotal sac.";
export const CORD_N =
  "Bilateral spermatic cord are normal in size with normal blood flow pattern.";

// ── Prostate (TRUS, measured) / seminal vesicles ─────────────────────────────
export const PROSTATE_TRUS_N =
  "Prostate is normal in size, shape and echotexture. It measures {p1} X {p2} X {p3} cm corresponding to approximately {vol} gms. It is echo free. No evidence of focal lesion, calcification or S.O.L noted.";
export const SEMINAL_N =
  "Both seminal vesicles are normal in size, shape and echotexture. No focal lesion or dilatation seen.";

// ── Echocardiography (her JUN_086 report — M-mode table + 2D profiles) ─────────
export const ECHO_MMODE_N =
  "LA ( Left Atrial Diameter ) : {la} mm ( Normal 20 - 40 mm )\nAO ( Aortic Root Diameter ) : {ao} mm ( Normal 20 - 40 mm )\nLVID (d) ( LV Internal Diameter in Diastole ) : {lvidd} mm ( Normal 35 - 45 mm )\nLVID (s) ( LV Internal Diameter in Systole ) : {lvids} mm ( Normal 24 - 42 mm )\nLVEF ( LV Ejection Fraction ) : {lvef} %\nFractional Shortening : {fs} %\nIVS (d) ( Interventricular Septum in Diastole ) : {ivsd} mm ( Normal 6 - 11 mm )\nPW (d) ( Posterior Wall in Diastole ) : {pwd} mm ( Normal 6 - 11 mm )\nRV Dimension : {rvd} mm ( Normal 7 - 23 mm )\nRA Dimension : {rad} mm ( Normal 6 - 24 mm )";
export const ECHO_VALVES_N =
  "Mitral Valve ( MV ) : The AML show normal cusps thickness and excursion, no calcification, no doming.\nAortic Valve ( AoV ) : Normal thickness & excursions.\nTricuspid Valve ( TV ) : Normal cusps.\nPulmonary Valve ( PV ) : Pulmonary annulus & its branches are normal.\nIAS ( Interatrial Septum ) : Intact.\nIVS ( Interventricular Septum ) : Intact.\nPericardium : No effusion.\nLA / LVA Clot : None.";
export const ECHO_OTHERS_N =
  "Situs solitus, normal atrioventricular & ventriculo-arterial drainage with left sided aortic arch.\nNo PDA / ASD / VSD.\nNormal pulmonary trunk & its branches.\nNo chamber clot / valvular vegetations.\nNormal LV & RV function.";

// ── Limb Doppler normals (her "USG OF BOTH LOWER LIMB (DOPPLER)" format) ───────
export const ARTERIAL_LL_N =
  "Wall of the common femoral, popliteal and tibial arteries shows normal echogenicity with no calcification or plaque. Shows normal diameter of common femoral arteries showing normal blood flow with triphasic spectral waveform. Popliteal artery with its divisions shows normal flow pattern and peak systolic velocity. Dorsalis pedis artery shows normal flow pattern.";
export const VENOUS_LL_N =
  "Deep femoral veins show normal diameter having normal phasicity. Augmentation test done was positive. Vessels compressibility is normal. No evidence of deep vein thrombosis or varicosity is seen.";
export const SUBCUT_LL_N = "No subcutaneous edema is seen in the lower limbs.";
export const ARTERIAL_UL_N =
  "Brachial, radial and ulnar arteries show normal wall echogenicity with no calcification or plaque. Normal diameter showing normal blood flow with triphasic spectral waveform and normal peak systolic velocity. Palmar arch shows normal flow pattern.";
export const VENOUS_UL_N =
  "Deep veins as well as cephalic and basilic veins of both upper limbs show normal diameter having normal phasicity. Augmentation test done was positive. Vessels compressibility is normal. No evidence of deep vein thrombosis is seen.";
export const SUBCUT_UL_N = "No subcutaneous edema is seen in the upper limbs.";

// ── Carotid Doppler normals (textbook — no corpus template) ─────────────────────
export const CAROTID_RT_N =
  "Right common carotid artery shows normal wall echogenicity with no intimal thickening or plaque. Normal diameter with normal blood flow and triphasic spectral waveform. Right ICA and ECA show normal flow pattern and peak systolic velocity. Right vertebral artery shows normal antegrade flow and velocity.";
export const CAROTID_LT_N =
  "Left common carotid artery shows normal wall echogenicity with no intimal thickening or plaque. Normal diameter with normal blood flow and triphasic spectral waveform. Left ICA and ECA show normal flow pattern and peak systolic velocity. Left vertebral artery shows normal antegrade flow and velocity.";
export const CAROTID_OTHERS_N = "No significant abnormality detected on carotid Doppler study.";

// ── Chest normals (textbook — her effusion wording lives in OTHERS) ───────────
export const CHEST_WALL_N =
  "Chest wall soft tissue and subcutaneous plane are normal in echogenicity. No collection, swelling or mass lesion seen.";
export const PLEURA_RT_N =
  "Right pleura shows normal echogenicity with no thickening or effusion. Lung sliding ( gliding sign ) is normal. No pleural mass or nodule seen. No collapsed lung seen at the base.";
export const PLEURA_LT_N =
  "Left pleura shows normal echogenicity with no thickening or effusion. Lung sliding ( gliding sign ) is normal. No pleural mass or nodule seen. No collapsed lung seen at the base.";
export const CHEST_OTHERS_N =
  "No mediastinal lymphadenopathy or pericardial collection seen. Both diaphragms show normal contour and movement on respiration.";

// ── Cranium normals (textbook transfontanelle scaffold) ───────────────────────────
export const PARENCHYMA_N =
  "Both cerebral hemispheres show normal parenchymal echogenicity with symmetrical sulcal pattern. No focal lesion, echogenic area, calcification or cyst seen in either hemisphere.";
export const VENTRICLES_N =
  "Both lateral ventricles are normal in size with normal shape. Third and fourth ventricles are normal. No evidence of hydrocephalus. Extra-axial CSF spaces are normal for age.";
export const MIDLINE_N =
  "Midline structures are in normal position with no midline shift. Interhemispheric fissure is normal. No subdural or epidural collection seen. Cavum septum pellucidum is normal. Cerebellum and posterior fossa appear normal.";

// ── Orbit normals (textbook) ───────────────────────────────────────────────
export const GLOBE_RT_N =
  "Right globe is normal in size and contour. Vitreous is echo free with no opacity, debris or foreign body seen. Retina is in position with no detachment. No intraocular mass or calcification seen. Vitreous and anterior chamber depths are normal.";
export const GLOBE_LT_N =
  "Left globe is normal in size and contour. Vitreous is echo free with no opacity, debris or foreign body seen. Retina is in position with no detachment. No intraocular mass or calcification seen. Vitreous and anterior chamber depths are normal.";
export const MUSCLES_N =
  "Extra ocular muscles are normal in thickness and echogenicity. No muscle enlargement seen. Tendon insertions are normal.";
export const OPTIC_N =
  "Optic nerves are normal in diameter and echogenicity. Retrobulbar space is normal with no mass lesion or collection. Orbital walls appear intact with no fracture seen.";

// ── USG of swelling (her "USG OF SWELLING" / thigh / parietal wall formats) ─────────
export const SWELLING_N =
  "No obvious collection or mass lesion is seen in the region of interest. Tissue planes are normal with no disruption.";
export const SKIN_N =
  "The overlying skin and subcutaneous tissue are normal in echogenicity. No thickened echogenic oedematous tissue seen.";
export const DEEP_N =
  "The underlying muscles and bones are normal in echogenicity. No bulky muscle or collection seen.";
export const REGIONAL_VESSELS_N =
  "Colour Doppler shows normal flow pattern in the regional vessels. No abnormal vascularity could be demonstrated on colour Doppler and power Doppler scan.";

const GYN_VARS = [
  V("u1", "Uterus L", "cm"),
  V("u2", "Uterus W", "cm"),
  V("u3", "Uterus H", "cm"),
  V("et", "Endometrium", "cm"),
  V("rov1", "RT ovary L", "cm"),
  V("rov2", "RT ovary W", "cm"),
  V("lov1", "LT ovary L", "cm"),
  V("lov2", "LT ovary W", "cm"),
];

export const USG_STUDIES: UsgStudyDef[] = [
  {
    key: "wa-female",
    label: "Whole Abdomen — Female",
    title: "USG WHOLE ABDOMEN",
    sex: "F",
    group: "abd",
    technique: T_WA,
    allNormalImpression: ["Normal scan of upper abdomen.", "Normal sized uterus with normal endometrial thickness."],
    upperGroupNormalLine: "Normal scan of upper abdomen.",
    organs: [
      { key: "liver", label: "LIVER", normal: LIVER_N },
      { key: "gb", label: "G. B", normal: GB_N },
      { key: "cbd", label: "C.B.DUCT", normal: CBD_N },
      { key: "pancreas", label: "PANCREAS", normal: PANCREAS_N },
      { key: "spleen", label: "SPLEEN", normal: SPLEEN_N },
      { key: "kidney_rt", label: "RT KIDNEY", normal: KIDNEY_N },
      { key: "kidney_lt", label: "LT KIDNEY", normal: KIDNEY_N },
      { key: "ureters", label: "URETERS", normal: URETERS_N },
      { key: "ub", label: "U. B", normal: UB_N },
      { key: "uterus", label: "UTERUS", normal: UTERUS_N, normalImpression: "Normal sized uterus with normal endometrial thickness." },
      { key: "adnexa", label: "ADNEXA", normal: ADNEXA_N, normalImpression: "Bilateral adenexa normal in morphology." },
      { key: "pod", label: "P.O.D", normal: POD_N, normalImpression: "No POD collection." },
      { key: "others", label: "OTHERS", normal: OTHERS_N },
    ],
  },
  {
    key: "wa-male",
    label: "Whole Abdomen — Male",
    title: "USG WHOLE ABDOMEN",
    sex: "M",
    group: "abd",
    technique: T_WA,
    allNormalImpression: ["No significant abnormality detected."],
    organs: [
      { key: "liver", label: "LIVER", normal: LIVER_N },
      { key: "gb", label: "G. B", normal: GB_N },
      { key: "cbd", label: "C.B.DUCT", normal: CBD_N },
      { key: "pancreas", label: "PANCREAS", normal: PANCREAS_N },
      { key: "spleen", label: "SPLEEN", normal: SPLEEN_N },
      { key: "kidney_rt", label: "RT KIDNEY", normal: KIDNEY_N },
      { key: "kidney_lt", label: "LT KIDNEY", normal: KIDNEY_N },
      { key: "ureters", label: "URETERS", normal: URETERS_N },
      { key: "ub", label: "U. B", normal: UB_N, normalImpression: "Insignificant post void residual urine." },
      { key: "prostate", label: "PROSTATE", normal: PROSTATE_N },
      { key: "rif", label: "R.I.F", normal: RIF_N },
      { key: "others", label: "OTHERS", normal: OTHERS_N },
    ],
  },
  {
    key: "ua",
    label: "Upper Abdomen",
    title: "USG UPPER ABDOMEN",
    group: "abd",
    technique: T_UA,
    allNormalImpression: ["Normal scan of upper abdomen."],
    organs: [
      { key: "liver", label: "LIVER", normal: LIVER_N },
      { key: "gb", label: "G. B", normal: GB_N },
      { key: "cbd", label: "C.B.DUCT", normal: CBD_N },
      { key: "pancreas", label: "PANCREAS", normal: PANCREAS_N },
      { key: "spleen", label: "SPLEEN", normal: SPLEEN_N },
      { key: "kidney_rt", label: "RT KIDNEY", normal: KIDNEY_N },
      { key: "kidney_lt", label: "LT KIDNEY", normal: KIDNEY_N },
      { key: "others", label: "OTHERS", normal: OTHERS_N },
    ],
  },
  {
    key: "la-female",
    label: "Lower Abdomen — Female",
    title: "USG LOWER ABDOMEN",
    sex: "F",
    group: "abd",
    technique: T_LA,
    allNormalImpression: [
      "Normal sized uterus with normal endometrial thickness.",
      "Bilateral adenexa normal in morphology.",
      "No POD collection.",
    ],
    organs: [
      { key: "kidney_rt", label: "RT KIDNEY", normal: KIDNEY_N },
      { key: "kidney_lt", label: "LT KIDNEY", normal: KIDNEY_N },
      { key: "ureters", label: "URETERS", normal: URETERS_N },
      { key: "ub", label: "U. B", normal: UB_N },
      { key: "uterus", label: "UTERUS", normal: UTERUS_MEASURED_N, normalQuick: UTERUS_N, vars: GYN_VARS, normalImpression: "Normal sized uterus with normal endometrial thickness." },
      { key: "adnexa", label: "ADNEXA", normal: ADNEXA_MEASURED_N, normalQuick: ADNEXA_N, vars: GYN_VARS, normalImpression: "Bilateral adenexa normal in morphology." },
      { key: "pod", label: "P.O.D", normal: POD_N, normalImpression: "No POD collection." },
      { key: "others", label: "OTHERS", normal: OTHERS_N },
    ],
  },
  {
    key: "la-male",
    label: "Lower Abdomen — Male",
    title: "USG LOWER ABDOMEN",
    sex: "M",
    group: "abd",
    technique: T_LA,
    allNormalImpression: ["No significant abnormality detected."],
    organs: [
      { key: "kidney_rt", label: "RT KIDNEY", normal: KIDNEY_N },
      { key: "kidney_lt", label: "LT KIDNEY", normal: KIDNEY_N },
      { key: "ureters", label: "URETERS", normal: URETERS_N },
      { key: "ub", label: "U. B", normal: UB_N, normalImpression: "Insignificant post void residual urine." },
      { key: "prostate", label: "PROSTATE", normal: PROSTATE_N },
      { key: "rif", label: "R.I.F", normal: RIF_N },
      { key: "others", label: "OTHERS", normal: OTHERS_N },
    ],
  },
  {
    // The doctor's paediatric whole abdomen — measured organs, no prostate /
    // uterus / adnexa / POD, mesenteric-node OTHERS line ("A Normal child.doc").
    key: "wa-child",
    label: "Whole Abdomen — Child",
    title: "USG WHOLE ABDOMEN",
    group: "abd",
    technique: T_WA,
    allNormalImpression: ["No significant abnormality detected."],
    organs: [
      // normalQuick = adult unmeasured wording — rush/peak child normals
      // without forcing MCL / organ length entry.
      { key: "liver", label: "LIVER", normal: LIVER_CHILD_N, normalQuick: LIVER_N, vars: [V("span", "Liver span (MCL)")] },
      { key: "gb", label: "G. B", normal: GB_N },
      { key: "cbd", label: "C.B.DUCT", normal: CBD_N },
      { key: "pancreas", label: "PANCREAS", normal: PANCREAS_N },
      { key: "spleen", label: "SPLEEN", normal: SPLEEN_CHILD_N, normalQuick: SPLEEN_N, vars: [V("span", "Spleen length")] },
      {
        key: "kidney_rt",
        label: "RT KIDNEY",
        normal: KIDNEY_CHILD_N,
        normalQuick: KIDNEY_N,
        vars: [V("span", "RT kidney length")],
      },
      {
        key: "kidney_lt",
        label: "LT KIDNEY",
        normal: KIDNEY_CHILD_N,
        normalQuick: KIDNEY_N,
        vars: [V("span", "LT kidney length")],
      },
      { key: "ureters", label: "URETERS", normal: URETERS_N },
      { key: "ub", label: "U. B", normal: UB_CHILD_N },
      { key: "others", label: "OTHERS", normal: OTHERS_CHILD_N },
    ],
  },
  {
    // ANTENATAL SCAN — her main pregnancy format: fetus → biometry → survey
    // → placenta → liquor, PC-PNDT declaration, GA line leads the impression.
    key: "ob",
    label: "Pregnancy — Antenatal Scan",
    title: "ANTENATAL SCAN",
    sex: "F",
    group: "obg",
    technique: T_OB,
    allNormalImpression: [FETUS_IMPRESSION_N],
    normalImpressionFirst: true,
    pcpndt: true,
    organs: [
      {
        key: "fetus",
        label: "FETUS & PRESENTATION",
        normal: FETUS_N,
        normalImpression: FETUS_IMPRESSION_N,
        // v6.12: {lie} is a select-token — the organ card renders a dropdown
        // (cephalic/breech/oblique/transverse/variable). Default value is set
        // at first render via the tokenTypes registry default.
        vars: [V("lie", "Fetal lie", "")],
      },
      {
        key: "biometry",
        label: "FETAL BIOMETRY",
        normal: BIOMETRY_N,
        // v6.13: label every biometry slot so the UI shows "BPD mm" instead of "bpd"
        vars: [
          V("bpd", "BPD", "mm"), V("bpdw", "BPD GA wk"), V("bpdd", "BPD GA d"),
          V("hc", "HC", "mm"), V("hcw", "HC GA wk"), V("hcd", "HC GA d"),
          V("ac", "AC", "mm"), V("acw", "AC GA wk"), V("acd", "AC GA d"),
          V("fl", "FL", "mm"), V("flw", "FL GA wk"), V("fld", "FL GA d"),
          V("gaw", "Mean GA wk"), V("gad", "Mean GA d"),
          V("edd", "EDD"), V("ewt", "EFW", "g"), V("ewtd", "EFW ±", "g"),
          V("fhr", "FHR", "bpm"),
        ],
      },
      { key: "anatomy", label: "FETAL SURVEY", normal: ANATOMY_N },
      {
        key: "placenta",
        label: "PLACENTA & OS",
        normal: PLACENTA_N,
        vars: [V("position", "Position (ant/post)", ""), V("grade", "Maturity grade", "")],
      },
      { key: "liquor", label: "LIQUOR", normal: LIQUOR_N, vars: [V("afi", "AFI")] },
    ],
  },
  {
    // Early pregnancy (≤13 weeks) — gravid uterus + adnexa + POD, with the
    // anomaly-scan reminder under a normal impression (her 6–8 / 9–13 week formats).
    key: "ep",
    label: "Pregnancy — Early (≤13 wks)",
    title: "USG LOWER ABDOMEN",
    sex: "F",
    group: "obg",
    technique: T_EP,
    allNormalImpression: [GRAVID_UTERUS_IMPRESSION_N],
    defaultSuggestions: ["Anomaly scan to be done at 20-22 weeks of gestational age."],
    normalImpressionFirst: true,
    pcpndt: true,
    organs: [
      {
        key: "gravid-uterus",
        label: "UTERUS",
        normal: GRAVID_UTERUS_N,
        normalImpression: GRAVID_UTERUS_IMPRESSION_N,
      },
      { key: "adnexa", label: "ADNEXA", normal: ADNEXA_MEASURED_N, normalQuick: ADNEXA_N, vars: GYN_VARS },
      { key: "pod", label: "P.O.D", normal: POD_N },
    ],
  },
  {
    // KUB — the whole-abdomen renal scaffold with measured split kidneys;
    // every kidney / ureter / bladder quick-select from the abdomen library
    // is available because the organ keys are shared.
    key: "kub",
    label: "KUB (Kidneys / Ureters / Bladder)",
    title: "USG KUB",
    group: "kubp",
    technique: T_KUB,
    allNormalImpression: ["No significant abnormality detected in KUB region."],
    organs: [
      { key: "kidney_rt", label: "RT KIDNEY", normal: KIDNEY_RT_KUB_N, normalQuick: KIDNEY_N, vars: [V("span", "RT kidney length")] },
      { key: "kidney_lt", label: "LT KIDNEY", normal: KIDNEY_LT_KUB_N, normalQuick: KIDNEY_N, vars: [V("span", "LT kidney length")] },
      { key: "ureters", label: "URETERS", normal: URETERS_N },
      { key: "ub", label: "U. B", normal: UB_N, normalImpression: "Insignificant post void residual urine." },
      { key: "others", label: "OTHERS", normal: OTHERS_N },
    ],
  },
  {
    // USG THYROID — her "USG THYROID / NECK" format with AP-diameter slots.
    key: "thyroid",
    label: "Thyroid & Neck",
    title: "USG THYROID",
    group: "small",
    technique: T_THY,
    allNormalImpression: ["No significant abnormality detected."],
    organs: [
      { key: "thyroid_rt", label: "RIGHT LOBE", normal: THY_RT_N, normalQuick: THY_RT_QUICK_N, vars: [V("r1", "RT lobe AP", "mm"), V("r2", "RT lobe TR", "mm")] },
      { key: "thyroid_lt", label: "LEFT LOBE", normal: THY_LT_N, normalQuick: THY_LT_QUICK_N, vars: [V("l1", "LT lobe AP", "mm"), V("l2", "LT lobe TR", "mm")] },
      { key: "isthmus", label: "ISTHMUS", normal: THY_ISTHMUS_N, normalQuick: THY_ISTHMUS_QUICK_N, vars: [V("isth", "Isthmus", "mm")] },
      { key: "submandibular", label: "SUBMANDIBULAR", normal: THY_SUBMAND_N },
      { key: "parotid", label: "PAROTID", normal: THY_PAROTID_N },
      { key: "nodes", label: "LYMPH NODES", normal: THY_NODES_N },
      { key: "vessels", label: "NECK VESSELS", normal: THY_VESSELS_N },
    ],
  },
  {
    // Sonomammography — both breasts as organ cards so a pathology swaps one
    // side only; shared structures (muscles / bone interface / axilla) follow.
    key: "breast",
    label: "Breast (Sonomammography)",
    title: "SONOMAMMOGRAPHY OF BOTH BREASTS",
    group: "small",
    technique: T_BREAST,
    allNormalImpression: ["No significant abnormality detected."],
    organs: [
      { key: "breast_rt", label: "RIGHT BREAST", normal: BREAST_RT_N },
      { key: "breast_lt", label: "LEFT BREAST", normal: BREAST_RT_N },
      { key: "pectoralis", label: "PECTORALIS", normal: PECTORALIS_N },
      { key: "axilla", label: "AXILLA", normal: AXILLA_N },
    ],
  },
  {
    // USG SCROTUM — both testes measured, sac + cords, colour Doppler lines.
    key: "scrotum",
    label: "Scrotum & Testes",
    title: "USG SCROTUM",
    sex: "M",
    group: "small",
    technique: T_SCROTUM,
    allNormalImpression: ["No significant abnormality detected."],
    organs: [
      { key: "testis_rt", label: "RIGHT TESTIS", normal: TESTIS_RT_N, normalQuick: TESTIS_QUICK_N, vars: [V("t1", "RT testis L", "mm"), V("t2", "RT testis W", "mm")] },
      { key: "testis_lt", label: "LEFT TESTIS", normal: TESTIS_LT_N, normalQuick: TESTIS_QUICK_N, vars: [V("t1", "LT testis L", "mm"), V("t2", "LT testis W", "mm")] },
      { key: "sac", label: "SCROTAL SAC", normal: SAC_N },
      { key: "cord", label: "INGUINAL REGION", normal: CORD_N },
    ],
  },
  {
    // Transvaginal sonography — same gyn organ keys as the lower abdomen so
    // the whole uterus / adnexa / POD quick-select library applies directly.
    key: "tvs",
    label: "TVS (Transvaginal Scan)",
    title: "TRANSVAGINAL SONOGRAPHY",
    sex: "F",
    group: "obg",
    technique: T_TVS,
    allNormalImpression: [
      "Normal sized uterus with normal endometrial thickness.",
      "Bilateral adenexa normal in morphology.",
      "No POD collection.",
    ],
    organs: [
      { key: "uterus", label: "UTERUS", normal: UTERUS_MEASURED_N, normalQuick: UTERUS_N, vars: GYN_VARS, normalImpression: "Normal sized uterus with normal endometrial thickness." },
      { key: "adnexa", label: "ADNEXA", normal: ADNEXA_MEASURED_N, normalQuick: ADNEXA_N, vars: GYN_VARS, normalImpression: "Bilateral adenexa normal in morphology." },
      { key: "pod", label: "P.O.D", normal: POD_N, normalImpression: "No POD collection." },
    ],
  },
  {
    // Transrectal sonography of prostate — measured gland + seminal vesicles;
    // shares the "prostate" organ key so all prostate quick-selects apply.
    key: "trus",
    label: "TRUS (Transrectal — Prostate)",
    title: "TRANSRECTAL SONOGRAPHY",
    sex: "M",
    group: "kubp",
    technique: T_TRUS,
    allNormalImpression: ["Normal prostate on transrectal sonography."],
    organs: [
      {
        key: "prostate",
        label: "PROSTATE",
        normal: PROSTATE_TRUS_N,
        normalQuick: PROSTATE_N,
        vars: [V("p1", "Prostate L", "cm"), V("p2", "Prostate W", "cm"), V("p3", "Prostate H", "cm"), V("vol", "Volume", "gms")],
      },
      { key: "seminal", label: "SEMINAL VESICLES", normal: SEMINAL_N },
    ],
  },
  {
    // 2D echocardiography — her M-mode dimension table (printed as a real
    // measurement table) + 2D valve profiles + other findings.
    key: "echo",
    label: "Echo (2D Echocardiography)",
    title: "2D ECHOCARDIOGRAPHY",
    group: "cardiac",
    technique: T_ECHO,
    allNormalImpression: ["Normal 2D echocardiography study."],
    organs: [
      {
        key: "echo-mmode",
        label: "M-MODE DIMENSIONS",
        kind: "table",
        normal: ECHO_MMODE_N,
        vars: [
          V("la", "LA", "mm"), V("ao", "Aortic root", "mm"),
          V("lvidd", "LVID (d)", "mm"), V("lvids", "LVID (s)", "mm"),
          V("lvef", "LVEF", "%"), V("fs", "Fractional shortening", "%"),
          V("ivsd", "IVS (d)", "mm"), V("pwd", "PW (d)", "mm"),
          V("rvd", "RV dimension", "mm"), V("rad", "RA dimension", "mm"),
        ],
      },
      { key: "echo-valves", label: "2D ECHO PROFILES", normal: ECHO_VALVES_N },
      { key: "echo-others", label: "OTHERS FINDINGS", normal: ECHO_OTHERS_N },
    ],
  },
  {
    // Colour Doppler — both lower limbs, her arterial/venous system sections.
    key: "doppler-lower",
    label: "Doppler — Both Lower Limbs",
    title: "COLOUR DOPPLER OF BOTH LOWER LIMBS",
    group: "doppler",
    technique: T_DOP_LL,
    allNormalImpression: ["NORMAL COLOUR DOPPLER STUDY OF BOTH LOWER LIMBS."],
    organs: [
      { key: "arterial", label: "ARTERIAL SYSTEM", normal: ARTERIAL_LL_N },
      { key: "venous", label: "VENOUS SYSTEM", normal: VENOUS_LL_N },
      { key: "subcut", label: "SUBCUTANEOUS TISSUE", normal: SUBCUT_LL_N },
    ],
  },
  {
    // Colour Doppler — both upper limbs (brachial/radial/ulnar + deep and
    // superficial veins) — textbook mirror of her lower-limb format.
    key: "doppler-upper",
    label: "Doppler — Both Upper Limbs",
    title: "COLOUR DOPPLER OF BOTH UPPER LIMBS",
    group: "doppler",
    technique: T_DOP_UL,
    allNormalImpression: ["NORMAL COLOUR DOPPLER STUDY OF BOTH UPPER LIMBS."],
    organs: [
      { key: "arterial", label: "ARTERIAL SYSTEM", normal: ARTERIAL_UL_N },
      { key: "venous", label: "VENOUS SYSTEM", normal: VENOUS_UL_N },
      { key: "subcut", label: "SUBCUTANEOUS TISSUE", normal: SUBCUT_UL_N },
    ],
  },
  {
    // Carotid Doppler — right/left side cards, PSV-measured stenosis chips.
    key: "carotid",
    label: "Doppler — Carotid & Vertebral",
    title: "COLOUR DOPPLER OF CAROTID VESSELS",
    group: "doppler",
    technique: T_CAROTID,
    allNormalImpression: ["Normal carotid Doppler study."],
    organs: [
      { key: "carotid_rt", label: "RIGHT SIDE", normal: CAROTID_RT_N },
      { key: "carotid_lt", label: "LEFT SIDE", normal: CAROTID_LT_N },
      { key: "carotid-others", label: "OTHERS", normal: CAROTID_OTHERS_N },
    ],
  },
  {
    // USG chest — chest wall + both pleurae + others; her effusion wording.
    key: "chest",
    label: "Chest (Pleura / Lung Bases)",
    title: "USG CHEST",
    group: "small",
    technique: T_CHEST,
    allNormalImpression: ["No significant abnormality detected on ultrasound of chest."],
    organs: [
      { key: "chest-wall", label: "CHEST WALL", normal: CHEST_WALL_N },
      { key: "pleura_rt", label: "RIGHT PLEURA", normal: PLEURA_RT_N },
      { key: "pleura_lt", label: "LEFT PLEURA", normal: PLEURA_LT_N },
      { key: "chest-others", label: "OTHERS", normal: CHEST_OTHERS_N },
    ],
  },
  {
    // USG cranium — infant transfontanelle study.
    key: "cranium",
    label: "Cranium (Infant — Transfontanelle)",
    title: "USG CRANIUM",
    group: "small",
    technique: T_CRANIUM,
    allNormalImpression: ["Normal cranial ultrasound study."],
    organs: [
      { key: "parenchyma", label: "BRAIN PARENCHYMA", normal: PARENCHYMA_N },
      { key: "ventricles", label: "VENTRICLES", normal: VENTRICLES_N },
      { key: "midline", label: "MIDLINE & EXTRA-AXIAL", normal: MIDLINE_N },
    ],
  },
  {
    // USG orbit — both globes + muscles + nerve/retrobulbar space.
    key: "orbit",
    label: "Orbit (Both Eyes)",
    title: "USG ORBIT",
    group: "small",
    technique: T_ORBIT,
    allNormalImpression: ["No significant abnormality detected on orbital ultrasound."],
    organs: [
      { key: "globe_rt", label: "RIGHT GLOBE", normal: GLOBE_RT_N },
      { key: "globe_lt", label: "LEFT GLOBE", normal: GLOBE_LT_N },
      { key: "muscles", label: "EXTRAOCULAR MUSCLES", normal: MUSCLES_N },
      { key: "optic", label: "OPTIC NERVE / RETROBULBAR", normal: OPTIC_N },
    ],
  },
  {
    // USG of swelling / soft tissue / parietal wall — her regional formats
    // with {site} slot so the same study covers any region of the body.
    key: "swelling",
    label: "Swelling / Soft Tissue",
    title: "USG OF SWELLING",
    group: "small",
    technique: T_SWELLING,
    allNormalImpression: ["No significant abnormality detected in the region of interest."],
    organs: [
      { key: "lesion", label: "REGION OF INTEREST", normal: SWELLING_N },
      { key: "skin", label: "SKIN / SUBCUTANEOUS", normal: SKIN_N },
      { key: "deep", label: "MUSCLES / BONES", normal: DEEP_N },
      { key: "regional-vessels", label: "REGIONAL VESSELS", normal: REGIONAL_VESSELS_N },
    ],
  },
];

// ── v6.12: Combined studies (Whole Abdomen + Pregnancy, TVS + Pregnancy,
// Whole + TVS) ────────────────────────────────────────────────────────────
// Common in practice: a patient may need both a whole abdomen scan AND a
// pregnancy scan in one sitting. These combined studies merge the organs
// from both, so the doctor reports everything in one composer session.
//
// We build them at module load by concatenating organs from the source
// studies. This means no changes to the composer, print, or any other
// code — the combined study is just a regular study with more organs.

function combineStudies(
  key: string,
  label: string,
  title: string,
  sex: "F" | "M",
  group: string,
  technique: string,
  sourceKeys: string[],
  allNormalImpression: string[],
): UsgStudyDef {
  const organs: UsgStudyDef["organs"] = [];
  const seen = new Set<string>();
  for (const srcKey of sourceKeys) {
    const src = USG_STUDIES.find((s) => s.key === srcKey);
    if (!src) continue;
    for (const o of src.organs) {
      if (!seen.has(o.key)) {
        seen.add(o.key);
        organs.push(o);
      }
    }
  }
  return {
    key,
    label,
    title,
    sex,
    group,
    technique,
    allNormalImpression,
    organs,
  };
}

// Add the combination studies after USG_STUDIES is fully defined.
const _waFemale = USG_STUDIES.find((s) => s.key === "wa-female")!;
const _ob = USG_STUDIES.find((s) => s.key === "ob")!;
const _tvs = USG_STUDIES.find((s) => s.key === "tvs")!;

USG_STUDIES.push(
  combineStudies(
    "wa-ob",
    "Whole Abdomen + Pregnancy",
    "USG WHOLE ABDOMEN + ANTENATAL SCAN",
    "F",
    "obg",
    T_WA + " / " + T_OB,
    ["wa-female", "ob"],
    [
      ...(_waFemale.allNormalImpression ?? []),
      ...(_ob.allNormalImpression ?? []),
    ],
  ),
  combineStudies(
    "tvs-ob",
    "TVS + Pregnancy",
    "TRANSVAGINAL SONOGRAPHY + ANTENATAL SCAN",
    "F",
    "obg",
    T_TVS + " / " + T_OB,
    ["tvs", "ob"],
    [
      ...(_tvs.allNormalImpression ?? []),
      ...(_ob.allNormalImpression ?? []),
    ],
  ),
  combineStudies(
    "wa-tvs",
    "Whole Abdomen + TVS",
    "USG WHOLE ABDOMEN + TRANSVAGINAL SONOGRAPHY",
    "F",
    "obg",
    T_WA + " / " + T_TVS,
    ["wa-female", "tvs"],
    [
      ...(_waFemale.allNormalImpression ?? []),
      ...(_tvs.allNormalImpression ?? []),
    ],
  ),
);

/** Study groups shown in the composer dropdown and the studio filter chips. */
export const STUDY_GROUPS: { key: string; label: string }[] = [
  { key: "abd", label: "Abdomen" },
  { key: "kubp", label: "KUB & Prostate" },
  { key: "obg", label: "Obstetric & Gynae" },
  { key: "small", label: "Small Parts & Others" },
  { key: "doppler", label: "Doppler & Vascular" },
  { key: "cardiac", label: "Cardiac" },
  {
    key: "ob-tiffa-4d",
    label: "Pregnancy — 4D Anomaly Scan",
    title: "U.S.G OF FOETUS (4D ANOMALY SCAN)",
    sex: "F",
    group: "obg",
    technique: T_OB,
    allNormalImpression: [
      "Single live intrauterine pregnancy in presently {presentation} presentation with a composite gestational age of {gaw} weeks {gad} days.",
      "No gross fetal congenital anomalies detected.",
      "Not all congenital anomalies especially of heart, limbs & chromosomal abnormalities can be ruled out on an ultrasound scan."
    ],
    normalImpressionFirst: true,
    pcpndt: true,
    organs: [
      {
        key: "fetus",
        label: "FETUS & PRESENTATION",
        normal: "There is a single live intrauterine fetus in presently {presentation} presentation with active body movement. Fetal heart beat is seen in real time and corroborated in M-mode study.",
        vars: [{ key: "presentation", label: "Presentation", unit: "" }]
      },
      {
        key: "biometry",
        label: "FETAL BIOMETRY",
        normal: "Fetal biometry corresponds to {gaw} weeks {gad} days.",
        vars: [
          V("bpd", "BPD", "mm"), V("bpdw", "BPD GA wk"), V("bpdd", "BPD GA d"),
          V("hc", "HC", "mm"), V("hcw", "HC GA wk"), V("hcd", "HC GA d"),
          V("ac", "AC", "mm"), V("acw", "AC GA wk"), V("acd", "AC GA d"),
          V("fl", "FL", "mm"), V("flw", "FL GA wk"), V("fld", "FL GA d"),
          V("gaw", "Mean GA wk"), V("gad", "Mean GA d"),
          V("edd", "EDD"), V("ewt", "EFW", "g"), V("ewtd", "EFW ±", "g"),
          V("fhr", "FHR", "bpm"),
        ],
      },
      {
        key: "anomaly_4d",
        label: "CONGENITAL ANOMALY SCAN (4D)",
        normal: "The shape of the fetal skull is normal. The cerebral and cerebellar hemispheres are bilaterally symmetrical. The cavum septum pellucidum and thalamus are normal. The ventricular system is within normal limits. Cisterna magna is normal. No evidence of hydrocephalus. No evidence of any space occupying lesions. Fetal face was scanned. Bilateral orbits are at normal distance. The fetal nose and lips are normally formed. Fetal spine was scanned in sagittal and longitudinal planes from the cervical to the coccygeal region. No significant defect or splaying was visualized."
      },
      {
        key: "cardiac_stic",
        label: "FETAL HEART (4D STIC)",
        normal: "Fetal heart is evaluated with 4D fetal STIC. Heart is 4 chambered with apex towards left. No large VSD seen. However small ASD, VSD & Coarctation are well known to be missed. A reevaluation is recommended. Aortic arch, head and neck vessels were seen and they appear to be within normal limits."
      },
      {
        key: "thorax_cord_limbs",
        label: "THORAX, ABDOMEN, CORD & LIMBS",
        normal: "The fetal thoracic movements are normal during respiration. No fetal pleural effusion. The fetal abdomen was scanned. The liver, GB and kidney appears normal. The stomach is normally fluid filled. No fetal ascites. The cord insertion was checked. The umbilical cord is 3 vessels. No evidence of umbilical hernia. The fetal limbs (upper and lower) are normal in echogenicity, shape, movements and position. No evidence of club foot. All the 4 limb movements are normal."
      },
      {
        key: "color_doppler",
        label: "COLOR DOPPLER",
        normal: "Color Doppler reveals normal low resistance flow waveforms of uterine arteries with good diastolic flow. No diastolic notch is seen. Umbilical artery shows normal waveforms with good diastolic flow. MCA shows normal waveforms and flow velocities."
      },
      { key: "placenta", label: "PLACENTA & OS", normal: "Grade {grade} placenta is seen in the {position}. Cord is not surrounding neck. Three vessel system is seen in the umbilical cord. The lower part is not extending up to the lower segment. Internal OS is closed.", vars: [{ key: "position", label: "Position", unit: "" }, { key: "grade", label: "Grade", unit: "" }] },
      { key: "liquor", label: "LIQUOR", normal: "It is adequate - AFI is {afi} cms (Normal range - 8 to 24 cm).", vars: [{ key: "afi", label: "AFI", unit: "cms" }] },
    ],
  },
  {
    key: "ob-tiffa-twin",
    label: "Pregnancy — Twin Anomaly Scan",
    title: "U.S.G OF TWIN FETUS (ANOMALY SCAN)",
    sex: "F",
    group: "obg",
    technique: T_OB,
    allNormalImpression: [
      "Twin intrauterine (diamniotic, diachorionic) pregnancy.",
      "No gross fetal congenital anomalies detected."
    ],
    normalImpressionFirst: true,
    pcpndt: true,
    organs: [
      {
        key: "twins_intro",
        label: "TWIN PREGNANCY & PRESENTATION",
        normal: "Diamniotic, diachorionic twin pregnancies are seen. Fetus-A in the {a_lie} and Fetus-B in {b_lie} presentation. Normal fetal movement is seen.",
        vars: [{ key: "a_lie", label: "Fetus-A lie", unit: "" }, { key: "b_lie", label: "Fetus-B lie", unit: "" }]
      },
      {
        key: "biometry_a",
        label: "FETAL BIOMETRY — TWIN-A",
        normal: "Twin-A biometry corresponds to {a_w} weeks {a_d} days.",
        vars: [
          V("a_bpd", "A: BPD", "mm"), V("a_hc", "A: HC", "mm"), V("a_ac", "A: AC", "mm"), V("a_fl", "A: FL", "mm"),
          V("a_w", "A: GA wk"), V("a_d", "A: GA d"), V("a_ewt", "A: AFW", "g"), V("a_ewtd", "A: AFW ±", "g"), V("a_fhr", "A: FHR", "bpm"),
        ],
      },
      {
        key: "biometry_b",
        label: "FETAL BIOMETRY — TWIN-B",
        normal: "Twin-B biometry corresponds to {b_w} weeks {b_d} days.",
        vars: [
          V("b_bpd", "B: BPD", "mm"), V("b_hc", "B: HC", "mm"), V("b_ac", "B: AC", "mm"), V("b_fl", "B: FL", "mm"),
          V("b_w", "B: GA wk"), V("b_d", "B: GA d"), V("b_ewt", "B: AFW", "g"), V("b_ewtd", "B: AFW ±", "g"), V("b_fhr", "B: FHR", "bpm"),
        ],
      },
      {
        key: "survey_a",
        label: "FETAL SURVEY TWIN-A",
        normal: "HEAD: No abnormality is seen in the thalami, lateral ventricle hemispheric width ratio, cerebral peduncles. Head circumference and abdominal circumference ratio is normal.\nNECK: No cystic lesion noted around the neck.\nFACE: Fetal face shows normal anatomy. Both orbit, nose and mouth appear normal. Nasal bone length within normal limit.\nTHORAX: Both lungs seen and demonstrate normal echogenicity. No e/o of pleural and pericardial effusion.\nHEART: Normal cardiac situs and axis. Four chamber view normal. Outflow tracts are normal. Three vessel tracheal view normal. Fetal Heart Rate- {a_fhr} BPM.\nSPINE: Entire spine visualized in axial, longitudinal and transverse axis. Vertebrae and spinal canal appears normal.\nABDOMEN: Abdominal viscera like stomach, kidney, urinary bladder show no abnormality. Abdominal wall is intact. No distended intestinal loop is seen.\nLIMBS: All fetal limb bones are visualized and appears normal for the gestational age."
      },
      {
        key: "survey_b",
        label: "FETAL SURVEY TWIN-B",
        normal: "HEAD: No abnormality is seen in the thalami, lateral ventricle hemispheric width ratio, cerebral peduncles. Head circumference and abdominal circumference ratio is normal.\nNECK: No cystic lesion noted around the neck.\nFACE: Fetal face shows normal anatomy. Both orbit, nose and mouth appear normal. Nasal bone length within normal limit.\nTHORAX: Both lungs seen and demonstrate normal echogenicity. No e/o of pleural and pericardial effusion.\nHEART: Normal cardiac situs and axis. Four chamber view normal. Outflow tracts are normal. Three vessel tracheal view normal. Fetal Heart Rate- {b_fhr} BPM.\nSPINE: Entire spine visualized in axial, longitudinal and transverse axis. Vertebrae and spinal canal appears normal.\nABDOMEN: Abdominal viscera like stomach, kidney, urinary bladder show no abnormality. Abdominal wall is intact. No distended intestinal loop is seen.\nLIMBS: All fetal limb bones are visualized and appears normal for the gestational age."
      },
      {
        key: "placenta_twin",
        label: "PLACENTA & OS (TWINS)",
        normal: "Fetus-A – Placenta located {a_pos} (Maturity Grade {a_grade}) & Fetus-B is {b_pos} located (Maturity Grade {b_grade}). Three vessel system is seen in the umbilical cord. The lower part is not extending up to the lower segment. Internal OS is closed.",
        vars: [{ key: "a_pos", label: "A: Position", unit: "" }, { key: "a_grade", label: "A: Grade", unit: "" }, { key: "b_pos", label: "B: Position", unit: "" }, { key: "b_grade", label: "B: Grade", unit: "" }]
      },
      {
        key: "liquor_twin",
        label: "LIQUOR (TWINS)",
        normal: "It is adequate. Limb and cord free maximum amniotic space is {pocket} cm (Normal range for single largest pocket - 2 to 8). AFI is {afi} cms (Normal range - 8 to 24 cm).",
        vars: [{ key: "pocket", label: "Largest pocket", unit: "cm" }, { key: "afi", label: "AFI", unit: "cms" }]
      },
    ],
  },
];

/** Quick lookup by key. O(1) via a Map built once at module load — the
 *  prior `.find()` scanned the studies array on every call. */
const STUDY_MAP: ReadonlyMap<string, UsgStudyDef> = new Map(
  USG_STUDIES.map((s) => [s.key, s]),
);

/** Quick lookup by key. */
export function getStudy(key: string): UsgStudyDef | undefined {
  return STUDY_MAP.get(key);
}

/** Normal-wording override map — key `${studyKey}:${organKey}` → text (v5). */
export type NormalOverrides = Record<string, string>;

export function normalOverrideKey(studyKey: string, organKey: string): string {
  return `${studyKey}:${organKey}`;
}

/** A study clone whose organ normals carry the doctor's own wording. */
export function applyNormalOverrides(
  study: UsgStudyDef,
  overrides: NormalOverrides | undefined | null,
): UsgStudyDef {
  if (!overrides || Object.keys(overrides).length === 0) return study;
  let changed = false;
  const organs = study.organs.map((o) => {
    const text = overrides[normalOverrideKey(study.key, o.key)];
    if (typeof text === "string" && text.trim() && text.trim() !== o.normal) {
      changed = true;
      return { ...o, normal: text.trim() };
    }
    return o;
  });
  return changed ? { ...study, organs } : study;
}

/** getStudy + the doctor's normal-wording overrides applied. */
export function getStudyWithOverrides(
  key: string,
  overrides?: NormalOverrides | null,
): UsgStudyDef | undefined {
  const study = getStudy(key);
  return study ? applyNormalOverrides(study, overrides) : undefined;
}

/** Fresh composer state for a study — every organ normal, no variables. */
export function initialState(
  studyKey: string,
  overrides?: NormalOverrides | null,
): UsgComposerState {
  const study = getStudyWithOverrides(studyKey, overrides) ?? USG_STUDIES[0];
  return {
    studyKey: study.key,
    organs: study.organs.map((o) => ({
      organ: o.key,
      pathology: null,
      pathologies: [],
      custom: false,
      text: o.normal,
      vars: {},
    })),
    impressionOverride: null,
  };
}


export function studyKeyForBillTest(name: string, gender?: string): string | null {
  const n = (name || "").toLowerCase();
  const g = (gender || "").toLowerCase();
  const fem = !g.startsWith("m");
  if (/twin/.test(n)) return "ob-tiffa-twin";
  if (/anomaly|tiffa|targeted|level ?(ii|2)|4d/.test(n)) return "ob-tiffa-4d";
  if (/nt scan|nuchal/.test(n)) return "ep";
  if (/fetal doppler|fwb|well ?being|growth/.test(n)) return "ob";
  if (/tvs|transvaginal|follicular|sonosalping/.test(n)) return "tvs";
  if (/thyroid/.test(n)) return "thyroid";
  if (/breast|sonomamm/.test(n)) return "breast";
  if (/scrotum|testis|inguino/.test(n)) return "scrotum";
  if (/echo|echocardi/.test(n)) return "echo";
  if (/carotid|vertebral/.test(n)) return "carotid";
  if (/limb|thigh|penis/.test(n)) return "doppler-lower";
  if (/upper abdomen/.test(n)) return "ua";
  if (/lower abdom/.test(n)) return fem ? "la-female" : "la-male";   // tolerates desk typo "ABDOMEM"
  if (/brain|cranium/.test(n)) return "cranium";
  if (/eye|orbit/.test(n)) return "orbit";
  if (/chest|pleura|ascitic/.test(n)) return "chest";
  if (/prostate|trus/.test(n)) return "trus";
  if (/fnac|aspirat/.test(n)) return "swelling";
  if (/inguinal/.test(n)) return "swelling";
  if (/whole abdomen|kub/.test(n)) return fem ? "wa-female" : "wa-male";
  return null;
}
