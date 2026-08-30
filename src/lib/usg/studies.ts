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

/** Gyn (lower abdomen) normals carry the doctor's measurement slots. */
export const UTERUS_MEASURED_N =
  "Uterus is normal in size and shape & measures {u1} x {u2} x {u3} cm. The uterus is positioned in anteversion, with normal endometrial thickness ({et} cm). No focal pathology or abnormalities of outline are noted. The cervical echo is normal.";
export const ADNEXA_MEASURED_N =
  "Ovaries are normally positioned. Normal in echotexture. RT. Ovary measures {rov1} cm x {rov2} cm. LT. Ovary measures {lov1} cm x {lov2} cm.";

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
      { key: "uterus", label: "UTERUS", normal: UTERUS_MEASURED_N, vars: GYN_VARS, normalImpression: "Normal sized uterus with normal endometrial thickness." },
      { key: "adnexa", label: "ADNEXA", normal: ADNEXA_MEASURED_N, vars: GYN_VARS, normalImpression: "Bilateral adenexa normal in morphology." },
      { key: "pod", label: "P.O.D", normal: POD_N, normalImpression: "No POD collection." },
      { key: "others", label: "OTHERS", normal: OTHERS_N },
    ],
  },
  {
    key: "la-male",
    label: "Lower Abdomen — Male",
    title: "USG LOWER ABDOMEN",
    sex: "M",
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
];

export function getStudy(key: string): UsgStudyDef | undefined {
  return USG_STUDIES.find((s) => s.key === key);
}

/** Fresh composer state for a study — every organ normal, no variables. */
export function initialState(studyKey: string): UsgComposerState {
  const study = getStudy(studyKey) ?? USG_STUDIES[0];
  return {
    studyKey: study.key,
    organs: study.organs.map((o) => ({
      organ: o.key,
      pathology: null,
      custom: false,
      text: o.normal,
      vars: {},
    })),
    impressionOverride: null,
  };
}
