/**
 * X-ray procedure formats — curated verbatim from the doctor's own library
 * (docs/report-formats/xray: X-RAY MODIFIED/PROCEDURES — IVU, HSG, MCU/RGU,
 * barium studies, fistulogram, invertogram, T-tube cholangiography).
 */
import type { FormatSeed, FormatRowSeed } from "@/lib/seedData";

const REC = "Please correlate clinically. Not for medico-legal purpose.";

const row = (region: string) => (concept: string, text: string, extra: Partial<FormatRowSeed> = {}): FormatRowSeed => ({
  region, concept, text, inImpression: false, ...extra,
});

const I = row("X-Ray IVU");
const H = row("X-Ray HSG");
const M = row("X-Ray MCU");
const BA = row("X-Ray Barium");
const F = row("X-Ray Fistulogram");
const X = row("X-Ray Misc");

export const XRAY_PROCEDURES_FORMATS: FormatSeed[] = [
  // ── IVU ──────────────────────────────────────────────────────────────────
  {
    key: "xray-ivu-normal", modality: "X-Ray", region: "X-Ray IVU",
    name: "IVU — Normal", studyTitle: "INTRAVENOUS UROGRAM", titleSuffix: "",
    technique: "50 ml non-ionic contrast medium was injected intravenously and serial films were taken. No immediate complications seen.",
    recommendation: REC, isNormal: true, sortOrder: 1,
    rows: [
      I("control", "Control film: bilateral renal outlines and psoas shadows are normal. Visualised L.S. spine, pelvic bones and proximal femora are normal."),
      I("excretion", "Both kidneys show prompt excretion of contrast."),
      I("kidney_rt", "Right kidney: normal in size, shape, position, outline and axis. The pelvicalyceal system is not dilated. Normal cupping pattern of the calyces is well maintained."),
      I("kidney_lt", "Left kidney: normal in size, shape, position, outline and axis. The pelvicalyceal system is not dilated. Normal cupping pattern of the calyces is well maintained."),
      I("ureters", "B/L ureters: normal in course and calibre."),
      I("bladder", "Full bladder shows normal outline and distension. No filling defect seen."),
      I("post_void", "Post void: residual urine is insignificant. No abnormal hold-up of contrast material seen."),
      { region: "X-Ray IVU", concept: "normal_impression", text: "Normally excreting bilateral kidneys. Normal IVU study.", inImpression: true, impressionOnly: true },
    ],
  },
  {
    key: "xray-ivu-nephrolith", modality: "X-Ray", region: "X-Ray IVU",
    name: "IVU — Nephrolithiasis", studyTitle: "INTRAVENOUS UROGRAM",
    titleSuffix: "renal calculus",
    technique: "50 ml non-ionic contrast medium was injected intravenously and serial films were taken. No immediate complications seen.",
    recommendation: "Kindly co-relate with clinical and USG findings.", isNormal: false, sortOrder: 2,
    rows: [
      I("control", "Control film: a well-defined radiopaque shadow is seen in the ___ renal area at the level of the ___ vertebra. Bilateral renal outline and psoas shadows are normal."),
      I("excretion", "Both kidneys show prompt excretion of contrast."),
      I("kidney_rt", "Right kidney: normal in size, shape, position, outline and axis. The pelvicalyceal system is not dilated. Normal cupping pattern of the calyces is well maintained."),
      I("kidney_lt", "Left kidney: normal in size, shape, position, outline and axis. The radiopaque shadow in the control film is seen to lie within the ___ calyx of the ___ kidney. The pelvicalyceal system is not dilated.", { inImpression: true }),
      I("ureters", "B/L ureters: normal in course and calibre."),
      I("bladder", "Full bladder shows normal outline and distension. No filling defect seen."),
      I("post_void", "Post void: residual urine is insignificant."),
    ],
  },
  {
    key: "xray-ivu-ureteric-calculus", modality: "X-Ray", region: "X-Ray IVU",
    name: "IVU — Ureteric Calculus with Hold-up", studyTitle: "INTRAVENOUS UROGRAM",
    titleSuffix: "ureteric calculus with obstruction",
    technique: "50 ml non-ionic contrast medium was injected intravenously and serial films were taken. No immediate complications seen.",
    recommendation: "Kindly co-relate with clinical and USG findings.", isNormal: false, sortOrder: 3,
    rows: [
      I("control", "Control film: a well-defined radiopaque shadow is seen in the line of the ___ ureter at the level of the ___. Bilateral renal outline and psoas shadows are normal."),
      I("excretion", "___ kidney shows delayed excretion of contrast with dilatation of the pelvicalyceal system.", { inImpression: true }),
      I("kidney_rt", "Right kidney: normal in size, shape, position, outline and axis."),
      I("kidney_lt", "Left kidney: normal in size, shape, position, outline and axis."),
      I("ureters", "The contrast column in the ___ ureter is seen to stop abruptly at the level of the radiopaque shadow, S/o ureteric calculus with obstruction.", { inImpression: true }),
      I("bladder", "Full bladder shows normal outline and distension."),
      I("post_void", "Post void: residual urine is insignificant."),
    ],
  },

  // ── HSG ──────────────────────────────────────────────────────────────────
  {
    key: "xray-hsg-normal", modality: "X-Ray", region: "X-Ray HSG",
    name: "HSG — Normal", studyTitle: "HYSTEROSALPINGOGRAPHY", titleSuffix: "",
    technique: "Hysterosalpingography was done under full aseptic precautions. Approximately 12 ml of non-ionic contrast was injected through the cannula. The procedure was uneventful.",
    recommendation: REC, isNormal: true, sortOrder: 1,
    rows: [
      H("uterus", "The uterus is normal in size and shape. The uterine margin is smooth. No filling defect is noted in the uterine cavity."),
      H("tube_rt", "Right fallopian tube appears normal in course and calibre. Free peritoneal spillage of contrast is present."),
      H("tube_lt", "Left fallopian tube appears normal in course and calibre. Free peritoneal spillage of contrast is present."),
      { region: "X-Ray HSG", concept: "normal_impression", text: "Normal study.", inImpression: true, impressionOnly: true },
    ],
  },
  {
    key: "xray-hsg-bilateral-block", modality: "X-Ray", region: "X-Ray HSG",
    name: "HSG — Bilateral Tubal Block", studyTitle: "HYSTEROSALPINGOGRAPHY",
    titleSuffix: "bilateral tubal block",
    technique: "Hysterosalpingography was done under full aseptic precautions. Approximately 12 ml of non-ionic contrast was injected through the cannula. The procedure was uneventful.",
    recommendation: REC, isNormal: false, sortOrder: 2,
    rows: [
      H("uterus", "Uterus is in anteversion. Shows regular outline and is normal in shape."),
      H("tube_rt", "Right fallopian tube is opacified in its proximal most part only. Rest of the tube is not opacified. No peritoneal spillage of contrast.", { inImpression: true }),
      H("tube_lt", "Left fallopian tube is opacified up to the mid part. No peritoneal spillage of contrast.", { inImpression: true }),
    ],
  },
  {
    key: "xray-hsg-fimbrial-block", modality: "X-Ray", region: "X-Ray HSG",
    name: "HSG — Fimbrial Block", studyTitle: "HYSTEROSALPINGOGRAPHY",
    titleSuffix: "fimbrial block",
    technique: "Hysterosalpingography was done under full aseptic precautions. Approximately 12 ml of non-ionic contrast was injected through the cannula. The procedure was uneventful.",
    recommendation: REC, isNormal: false, sortOrder: 3,
    rows: [
      H("uterus", "The uterus is normal in size and shape. The uterine margin is smooth. No filling defect is noted in the uterine cavity."),
      H("tube_rt", "Right fallopian tube is visualised up to its fimbrial end and is ___ in outline. No peritoneal spillage of contrast is present, S/o fimbrial block.", { inImpression: true }),
      H("tube_lt", "Left fallopian tube appears normal in course and calibre. Free peritoneal spillage of contrast is present."),
    ],
  },
  {
    key: "xray-hsg-hydrosalpinx", modality: "X-Ray", region: "X-Ray HSG",
    name: "HSG — Hydrosalpinx", studyTitle: "HYSTEROSALPINGOGRAPHY",
    titleSuffix: "hydrosalpinx",
    technique: "Hysterosalpingography was done under full aseptic precautions. Approximately 12 ml of non-ionic contrast was injected through the cannula. The procedure was uneventful.",
    recommendation: REC, isNormal: false, sortOrder: 4,
    rows: [
      H("uterus", "The uterus is normal in size and shape. The uterine margin is smooth."),
      H("tube_rt", "Right fallopian tube is dilated and sacculated in its distal part with no peritoneal spillage of contrast, S/o Hydrosalpinx.", { inImpression: true }),
      H("tube_lt", "Left fallopian tube appears normal in course and calibre. Free peritoneal spillage of contrast is present."),
    ],
  },
  {
    key: "xray-hsg-bicornuate", modality: "X-Ray", region: "X-Ray HSG",
    name: "HSG — Bicornuate Uterus", studyTitle: "HYSTEROSALPINGOGRAPHY",
    titleSuffix: "bicornuate uterus",
    technique: "Hysterosalpingography was done under full aseptic precautions. Approximately 12 ml of non-ionic contrast was injected through the cannula. The procedure was uneventful.",
    recommendation: REC, isNormal: false, sortOrder: 5,
    rows: [
      H("uterus", "The uterine cavity is divided into two horns by a septum, S/o Bicornuate uterus.", { inImpression: true }),
      H("tube_rt", "Right fallopian tube appears normal in course and calibre. Free peritoneal spillage of contrast is present."),
      H("tube_lt", "Left fallopian tube appears normal in course and calibre. Free peritoneal spillage of contrast is present."),
    ],
  },
  {
    key: "xray-hsg-asherman", modality: "X-Ray", region: "X-Ray HSG",
    name: "HSG — Asherman's Syndrome", studyTitle: "HYSTEROSALPINGOGRAPHY",
    titleSuffix: "asherman's syndrome",
    technique: "Hysterosalpingography was done under full aseptic precautions. Approximately 12 ml of non-ionic contrast was injected through the cannula. All the contrast injected refluxed back. Four serial films were taken. The procedure was uneventful.",
    recommendation: REC, isNormal: false, sortOrder: 6,
    rows: [
      H("uterus", "Part of the cervix is opacified. However, the uterus is not opacified.", { inImpression: true }),
      H("tubes", "Bilateral fallopian tubes are not visualised throughout their courses. No peritoneal spillage of contrast is seen.", { inImpression: true }),
    ],
  },
  {
    key: "xray-hsg-genital-tb", modality: "X-Ray", region: "X-Ray HSG",
    name: "HSG — Genital Tuberculosis", studyTitle: "HYSTEROSALPINGOGRAPHY",
    titleSuffix: "features s/o genital tuberculosis",
    technique: "Hysterosalpingography was done under full aseptic precautions. Approximately 12 ml of non-ionic contrast was injected through the cannula. The procedure was uneventful.",
    recommendation: REC, isNormal: false, sortOrder: 7,
    rows: [
      H("uterus", "Irregularly outlined T-shaped uterine cavity, S/o Chronic endometritis.", { inImpression: true }),
      H("tube_rt", "Right fallopian tube is visualised only in its proximal most part. No peritoneal spillage of contrast is present.", { inImpression: true }),
      H("tube_lt", "Left fallopian tube is visualised up to its fimbrial end and is beaded and irregular in outline. No peritoneal spillage of contrast is present.", { inImpression: true }),
    ],
  },

  // ── MCU / RGU ────────────────────────────────────────────────────────────
  {
    key: "xray-mcu-normal", modality: "X-Ray", region: "X-Ray MCU",
    name: "MCU — Normal", studyTitle: "VOIDING CYSTOURETHROGRAM", titleSuffix: "",
    technique: "The MCU examination was done after injecting water-soluble contrast media into the urinary bladder (Urograffin-76%).",
    recommendation: REC, isNormal: true, sortOrder: 1,
    rows: [
      M("bladder", "The study shows normal distension and outline of the urinary bladder. There is no evidence of mucosal thickening, oedema or trabeculation."),
      M("urethra", "The urethra appears normal in length and has smooth margins. No stricture or abnormal dilatation is seen involving the urethra."),
      M("reflux", "There is no evidence of vesico-ureteral reflux noted during micturition."),
      M("obstruction", "There is no evidence of bladder outlet obstruction."),
      M("volumes", "Prevoid urine volume ___ cc. Post void residual urine volume — insignificant."),
      { region: "X-Ray MCU", concept: "normal_impression", text: "Normal MCU study.", inImpression: true, impressionOnly: true },
    ],
  },
  {
    key: "xray-rgu-stricture", modality: "X-Ray", region: "X-Ray MCU",
    name: "RGU — Urethral Stricture", studyTitle: "RETROGRADE URETHROGRAM",
    titleSuffix: "urethral stricture",
    technique: "RGU was done under full aseptic precautions. 10 ml contrast was injected through the cannula.",
    recommendation: "MCU suggested for further evaluation.", isNormal: false, sortOrder: 2,
    rows: [
      M("urethra", "The urethra is normally opacified in its anterior part with regular outline. There is sudden narrowing at the junction of the anterior and posterior urethra with a thin stream of contrast in the posterior urethra.", { inImpression: true }),
    ],
  },

  // ── Barium studies ───────────────────────────────────────────────────────
  {
    key: "xray-ba-swallow-normal", modality: "X-Ray", region: "X-Ray Barium",
    name: "Barium Swallow — Normal", studyTitle: "BARIUM SWALLOW", titleSuffix: "",
    technique: "The barium swallow was performed in erect position using thin, high-density barium.",
    recommendation: REC, isNormal: true, sortOrder: 1,
    rows: [
      BA("passage", "The passage of barium through the oesophagus was uninterrupted."),
      BA("mucosa", "The oesophageal mucosa is normal."),
      BA("peristalsis", "The oesophagus distends well and shows normal peristalsis."),
      BA("goj", "The gastro-oesophageal junction is competent."),
      BA("lesions", "No evidence of stricture, obstruction, diverticulum or ulceration is seen. No growth is noted. No evidence of gastro-oesophageal reflux."),
      { region: "X-Ray Barium", concept: "normal_impression", text: "Normal study.", inImpression: true, impressionOnly: true },
    ],
  },
  {
    key: "xray-ba-swallow-stricture", modality: "X-Ray", region: "X-Ray Barium",
    name: "Barium Swallow — Stricture", studyTitle: "BARIUM SWALLOW",
    titleSuffix: "oesophageal stricture",
    technique: "The barium swallow was performed in erect position using thin, high-density barium.",
    recommendation: "Endoscopy suggested. " + REC, isNormal: false, sortOrder: 2,
    rows: [
      BA("stricture", "A well-defined short segment of narrowing with shouldering is seen in the ___ third of the oesophagus, S/o stricture.", { inImpression: true }),
      BA("passage", "Passage of barium is held up at the level of the stricture."),
      BA("mucosa", "The mucosal pattern at the stricture site is irregular."),
      BA("peristalsis", "The rest of the oesophagus shows normal peristalsis."),
      BA("goj", "The gastro-oesophageal junction is competent."),
    ],
  },
  {
    key: "xray-bmft-normal", modality: "X-Ray", region: "X-Ray Barium",
    name: "Barium Meal Follow-Through — Normal", studyTitle: "BARIUM MEAL FOLLOW-THROUGH", titleSuffix: "",
    technique: "Barium meal follow-through study was performed after oral ingestion of barium suspension with serial films.",
    recommendation: REC, isNormal: true, sortOrder: 3,
    rows: [
      BA("oesophagus", "Whole length of the oesophagus is seen, appears normal. No filling defect is seen."),
      BA("stomach", "Stomach appears normal in size and shape. No filling defect or ulcer crater is seen."),
      BA("duodenum", "Normal triangular shape of the duodenal cap with unremarkable rest of the duodenum. No filling defect or ulcer crater is seen."),
      BA("small_bowel", "Small intestine — jejunum and ileum: unremarkable."),
      BA("caecum", "Caecum is unremarkable. Appendix is seen and appears normal."),
      BA("colon", "Colon — ascending, transverse, splenic flexure, sigmoid and rectum: unremarkable."),
      { region: "X-Ray Barium", concept: "normal_impression", text: "No significant abnormality detected.", inImpression: true, impressionOnly: true },
    ],
  },
  {
    key: "xray-ba-meal-goo", modality: "X-Ray", region: "X-Ray Barium",
    name: "Barium Meal — Gastric Outlet Obstruction", studyTitle: "BARIUM MEAL",
    titleSuffix: "gastric outlet obstruction",
    technique: "Barium meal study was performed after oral ingestion of barium suspension.",
    recommendation: "Upper GI endoscopy suggested.", isNormal: false, sortOrder: 4,
    rows: [
      BA("stomach", "Stomach is grossly distended with retained secretions. Beaking at the pyloric antrum with very slow transit of barium from the pylorus, S/o Gastric outlet obstruction.", { inImpression: true }),
      BA("duodenum", "The duodenal cap is not well formed."),
    ],
  },
  {
    key: "xray-ba-enema-normal", modality: "X-Ray", region: "X-Ray Barium",
    name: "Barium Enema — Normal (Double Contrast)", studyTitle: "BARIUM ENEMA (DOUBLE CONTRAST)", titleSuffix: "",
    technique: "Double contrast barium enema was performed after bowel preparation with rectal tube insertion.",
    recommendation: REC, isNormal: true, sortOrder: 5,
    rows: [
      BA("rectum", "Rectum appears normal in shape and position with normal mucosal outline. No abnormal dilatation or filling defect is seen."),
      BA("colon", "Sigmoid, descending, transverse and ascending colon appear normal in course and calibre. No abnormal dilatation or filling defect is seen. Mucosal pattern appears normal."),
      BA("caecum", "Caecum and ileocaecal junction are normal."),
      { region: "X-Ray Barium", concept: "normal_impression", text: "Normal study.", inImpression: true, impressionOnly: true },
    ],
  },

  // ── Fistulogram ──────────────────────────────────────────────────────────
  {
    key: "xray-fistulogram", modality: "X-Ray", region: "X-Ray Fistulogram",
    name: "Fistulogram", studyTitle: "FISTULOGRAM", titleSuffix: "fistulous tract",
    technique: "Water-soluble contrast was injected through the external opening of the sinus under aseptic precautions and films were taken.",
    recommendation: REC, isNormal: false, sortOrder: 1,
    rows: [
      F("tract", "The contrast-filled fistulous tract is seen extending from the external opening ___ for a length of ___ cm, S/o ___."),
      F("connection", "The tract is seen communicating with ___.", { inImpression: true }),
      F("collection", "No associated cavity or collection is seen."),
    ],
  },

  // ── Misc (invertogram, T-tube cholangiogram) ─────────────────────────────
  {
    key: "xray-invertogram", modality: "X-Ray", region: "X-Ray Misc",
    name: "Invertogram (Imperforate Anus)", studyTitle: "INVERTOGRAM",
    titleSuffix: "imperforate anus",
    technique: "Invertogram was performed with the baby held inverted in lateral position with the anal opening marked.",
    recommendation: REC, isNormal: false, sortOrder: 1,
    rows: [
      X("gas", "Imperforate anus with ___ cm (approximately) distance between the rectal gas and the external marker at the anal opening.", { inImpression: true }),
      X("levels", "Multiple air-fluid levels are seen in the abdominal cavity."),
    ],
  },
  {
    key: "xray-t-tube-cholangiogram", modality: "X-Ray", region: "X-Ray Misc",
    name: "T-Tube Cholangiogram", studyTitle: "T-TUBE CHOLANGIOGRAPHY",
    titleSuffix: "",
    technique: "Post-cholecystectomy status. Study done by instilling diluted iodinated water-soluble contrast via the T-tube.",
    recommendation: "Kindly correlate clinically.", isNormal: true, sortOrder: 2,
    rows: [
      X("tube", "T-tube is seen in situ."),
      X("biliary", "Intrahepatic biliary radicles and CBD are normal in diameter. No definite intraluminal filling defect."),
      X("duodenum", "Biliary-duodenal ostium is patent with free flow of contrast into the duodenum."),
      X("leak", "No leakage of contrast is seen."),
      { region: "X-Ray Misc", concept: "normal_impression", text: "Normal post-cholecystectomy biliary tree with patent biliary-enteric flow.", inImpression: true, impressionOnly: true },
    ],
  },
];
