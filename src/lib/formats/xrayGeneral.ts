/**
 * X-ray general formats — curated verbatim from the doctor's own X-ray
 * library (docs/report-formats/xray: chest, spine, abdomen erect, KUB,
 * PNS, bones). Procedures (IVU/HSG/MCU/barium) live in xrayProcedures.ts.
 */
import type { FormatSeed, FormatRowSeed } from "@/lib/seedData";

const REC = "Please correlate clinically. Not for medico-legal purpose.";

const row = (region: string) => (concept: string, text: string, extra: Partial<FormatRowSeed> = {}): FormatRowSeed => ({
  region, concept, text, inImpression: false, ...extra,
});

const C = row("X-Ray Chest");
const S = row("X-Ray Spine");
const A = row("X-Ray Abdomen");
const K = row("X-Ray KUB");
const P = row("X-Ray PNS");
const B = row("X-Ray Bones");

const CHEST_NORMAL = [
  C("lungs", "Bilateral lung fields are clear."),
  C("hila", "The hila and pulmonary vasculature are normal."),
  C("mediastinum", "Trachea and mediastinum are central."),
  C("cp_angles", "Bilateral costo-phrenic and cardio-phrenic angles are free."),
  C("ctr", "The cardio-thoracic ratio is normal."),
  C("diaphragm", "The domes of the diaphragm are well delineated."),
  C("bones", "Soft tissue shadows and bony thorax appear normal."),
];

export const XRAY_GENERAL_FORMATS: FormatSeed[] = [
  // ── Chest ─────────────────────────────────────────────────────────────────
  {
    key: "xray-chest-normal", modality: "X-Ray", region: "X-Ray Chest",
    name: "Chest PA — Normal", studyTitle: "X-RAY CHEST PA VIEW", titleSuffix: "",
    technique: "Standard postero-anterior radiograph of the chest was obtained in erect position.",
    recommendation: REC, isNormal: true, sortOrder: 1,
    rows: [...CHEST_NORMAL, { region: "X-Ray Chest", concept: "normal_impression", text: "No significant abnormality detected.", inImpression: true, impressionOnly: true }],
  },
  {
    key: "xray-chest-ap-child-normal", modality: "X-Ray", region: "X-Ray Chest",
    name: "Chest AP — Normal (Child)", studyTitle: "X-RAY CHEST AP VIEW", titleSuffix: "",
    technique: "Antero-posterior radiograph of the chest was obtained in erect position.",
    recommendation: REC, isNormal: true, sortOrder: 2,
    rows: [...CHEST_NORMAL, { region: "X-Ray Chest", concept: "normal_impression", text: "No significant abnormality detected.", inImpression: true, impressionOnly: true }],
  },
  {
    key: "xray-chest-infiltrates", modality: "X-Ray", region: "X-Ray Chest",
    name: "Parenchymal Infiltrates", studyTitle: "X-RAY CHEST PA VIEW",
    titleSuffix: "parenchymal infiltrates",
    technique: "Standard postero-anterior radiograph of the chest was obtained in erect position.",
    recommendation: REC, isNormal: false, sortOrder: 3,
    rows: [
      C("infiltrates", "Parenchymal infiltrates are seen in the ___ zone of the ___ lung field.", { inImpression: true }),
      ...CHEST_NORMAL.slice(1),
    ],
  },
  {
    key: "xray-chest-copd", modality: "X-Ray", region: "X-Ray Chest",
    name: "COPD", studyTitle: "X-RAY CHEST PA VIEW", titleSuffix: "copd changes",
    technique: "Standard postero-anterior radiograph of the chest was obtained in erect position.",
    recommendation: REC, isNormal: false, sortOrder: 4,
    rows: [
      C("copd", "The chest X-ray demonstrates evidence of air trapping — horizontality of the ribs, hyperinflated lungs, hyperlucent lung fields with bilateral symmetrical attenuated pulmonary vasculature, long tubular heart, and scalloping with flattening of the diaphragm.", { inImpression: true }),
      C("lungs", "Bilateral lung fields are otherwise clear."),
      C("hila", "The hila and pulmonary vasculature are normal."),
      C("mediastinum", "Trachea and mediastinum are central."),
      C("cp_angles", "Bilateral costo-phrenic and cardio-phrenic angles are free."),
      C("bones", "Soft tissue shadows and bony thorax appear normal."),
    ],
  },
  {
    key: "xray-chest-pleural-effusion", modality: "X-Ray", region: "X-Ray Chest",
    name: "Pleural Effusion", studyTitle: "X-RAY CHEST PA VIEW",
    titleSuffix: "pleural effusion",
    technique: "Standard postero-anterior radiograph of the chest was obtained in erect position.",
    recommendation: REC, isNormal: false, sortOrder: 5,
    rows: [
      C("effusion", "Homogeneous opacity in the ___ lower zone with obscuration of the ___ costo-phrenic angle, ___ hemidiaphragm and ___ cardiac margin, S/o ___ pleural effusion.", { inImpression: true }),
      C("mediastinum", "Mediastinum is central / mildly shifted towards the opposite side."),
      C("lungs", "The rest of the lung fields are clear."),
      C("ctr", "The cardio-thoracic ratio is normal."),
      C("bones", "Soft tissue shadows and bony thorax appear normal."),
    ],
  },

  // ── Spine ────────────────────────────────────────────────────────────────
  {
    key: "xray-ls-spine-normal", modality: "X-Ray", region: "X-Ray Spine",
    name: "LS Spine — Normal", studyTitle: "X-RAY L.S. SPINE AP/LAT", titleSuffix: "",
    technique: "Antero-posterior and lateral radiographs of the lumbosacral spine were obtained.",
    recommendation: REC, isNormal: true, sortOrder: 1,
    rows: [
      S("lordosis", "Lumbar lordosis is maintained."),
      S("vertebrae", "All the vertebral bodies appear normal in height and density."),
      S("disc", "All the I.V disc spaces & body heights appear normal."),
      S("soft_tissue", "No para or pre-vertebral abnormal soft tissue opacity is seen."),
      S("sacroiliac", "Sacroiliac joints on both sides appear normal."),
      { region: "X-Ray Spine", concept: "normal_impression", text: "No significant abnormality detected.", inImpression: true, impressionOnly: true },
    ],
  },
  {
    key: "xray-ls-spine-degenerative", modality: "X-Ray", region: "X-Ray Spine",
    name: "LS Spine — Early Degenerative", studyTitle: "X-RAY L.S. SPINE AP/LAT",
    titleSuffix: "early degenerative changes",
    technique: "Antero-posterior and lateral radiographs of the lumbosacral spine were obtained.",
    recommendation: REC, isNormal: false, sortOrder: 2,
    rows: [
      S("lordosis", "Lumbar lordosis is reduced."),
      S("disc", "Reduced ___ intervertebral disc space.", { inImpression: true }),
      S("osteophytes", "Degenerative changes as evident by osteophyte formation at ___ vertebral levels.", { inImpression: true }),
      S("vertebrae", "All the vertebral bodies appear normal in height and density."),
      S("soft_tissue", "No para or pre-vertebral abnormal soft tissue opacity is seen."),
      S("sacroiliac", "Sacroiliac joints on both sides appear normal."),
    ],
  },
  {
    key: "xray-ls-spine-spondylolisthesis", modality: "X-Ray", region: "X-Ray Spine",
    name: "LS Spine — Anterolisthesis", studyTitle: "X-RAY L.S. SPINE AP/LAT",
    titleSuffix: "anterolisthesis",
    technique: "Antero-posterior and lateral radiographs of the lumbosacral spine were obtained.",
    recommendation: "MRI L.S. spine suggested. " + REC, isNormal: false, sortOrder: 3,
    rows: [
      S("listhesis", "Anterolisthesis of ___ over ___ vertebra.", { inImpression: true }),
      S("disc", "Reduced ___ intervertebral disc space."),
      S("osteophytes", "Marginal osteophytes at ___ vertebrae."),
      S("vertebrae", "All the vertebral bodies appear normal in height and density."),
      S("soft_tissue", "No para or pre-vertebral abnormal soft tissue opacity is seen."),
      S("sacroiliac", "Sacroiliac joints on both sides appear normal."),
    ],
  },
  {
    key: "xray-ls-spine-sacroiliitis", modality: "X-Ray", region: "X-Ray Spine",
    name: "LS Spine + Pelvis — Sacroiliitis", studyTitle: "X-RAY L.S. SPINE + PELVIS",
    titleSuffix: "bilateral sacroiliitis",
    technique: "Antero-posterior and lateral radiographs of the lumbosacral spine and pelvis were obtained.",
    recommendation: REC, isNormal: false, sortOrder: 4,
    rows: [
      S("sacroiliac", "Sclerosis at the articulating margins of bilateral sacroiliac joints with loss of joint space (___ > ___), S/o Bilateral sacroiliitis.", { inImpression: true }),
      S("lordosis", "Lumbar lordosis is maintained."),
      S("disc", "Reduced ___ intervertebral disc space."),
      S("vertebrae", "All the vertebral bodies appear normal in height and density."),
      S("soft_tissue", "No para or pre-vertebral abnormal soft tissue opacity is seen."),
    ],
  },
  {
    key: "xray-ls-spine-osteoporotic", modality: "X-Ray", region: "X-Ray Spine",
    name: "LS Spine — Osteoporotic Wedge", studyTitle: "X-RAY L.S. SPINE AP/LAT",
    titleSuffix: "osteoporotic wedge compression",
    technique: "Antero-posterior and lateral radiographs of the lumbosacral spine were obtained.",
    recommendation: "Bone densitometry (DEXA) suggested. " + REC, isNormal: false, sortOrder: 5,
    rows: [
      S("bones", "Visualised bones show osteoporotic changes.", { inImpression: true }),
      S("wedge", "Anterior wedging of the ___ vertebral body.", { inImpression: true }),
      S("disc", "Reduced ___ and ___ intervertebral disc spaces."),
      S("osteophytes", "Anterior marginal osteophytes at ___ vertebrae."),
      S("soft_tissue", "No para or pre-vertebral abnormal soft tissue opacity is seen."),
    ],
  },
  {
    key: "xray-c-spine-normal", modality: "X-Ray", region: "X-Ray Spine",
    name: "Cervical Spine — Normal", studyTitle: "X-RAY CERVICAL SPINE AP/LAT", titleSuffix: "",
    technique: "Antero-posterior and lateral radiographs of the cervical spine were obtained.",
    recommendation: REC, isNormal: true, sortOrder: 6,
    rows: [
      S("alignment", "Alignment is normal and curvature is maintained."),
      S("vertebrae", "The vertebrae are normal in height and density."),
      S("lesion", "There is no evidence of lytic or sclerotic lesion."),
      S("disc", "The disc spaces are well maintained."),
      S("posterior", "Posterior elements appear normal."),
      S("soft_tissue", "Pre and para-vertebral soft tissue shadows appear normal."),
      { region: "X-Ray Spine", concept: "normal_impression", text: "No significant abnormality detected.", inImpression: true, impressionOnly: true },
    ],
  },
  {
    key: "xray-c-spine-spondylosis", modality: "X-Ray", region: "X-Ray Spine",
    name: "Cervical Spine — Spondylosis", studyTitle: "X-RAY CERVICAL SPINE AP/LAT",
    titleSuffix: "cervical spondylosis",
    technique: "Antero-posterior and lateral radiographs of the cervical spine were obtained.",
    recommendation: REC, isNormal: false, sortOrder: 7,
    rows: [
      S("lordosis", "Cervical lordosis is reduced."),
      S("disc", "Reduced ___ intervertebral disc spaces.", { inImpression: true }),
      S("osteophytes", "Osteophyte formation at the ___ vertebral margins.", { inImpression: true }),
      S("vertebrae", "The vertebrae are normal in height and density."),
      S("posterior", "Posterior elements appear normal."),
      S("soft_tissue", "Pre and para-vertebral soft tissue shadows appear normal."),
    ],
  },
  {
    key: "xray-dl-spine-normal", modality: "X-Ray", region: "X-Ray Spine",
    name: "Dorsolumbar Spine — Normal", studyTitle: "X-RAY D.L. SPINE AP/LAT", titleSuffix: "",
    technique: "Antero-posterior and lateral radiographs of the dorsolumbar spine were obtained.",
    recommendation: REC, isNormal: true, sortOrder: 8,
    rows: [
      S("lordosis", "Spinal curvature is maintained."),
      S("vertebrae", "All the vertebral bodies appear normal in height and density."),
      S("disc", "All the I.V disc spaces appear normal."),
      S("posterior", "Posterior elements appear normal."),
      S("soft_tissue", "No para or pre-vertebral abnormal soft tissue opacity is seen."),
      { region: "X-Ray Spine", concept: "normal_impression", text: "No significant abnormality detected.", inImpression: true, impressionOnly: true },
    ],
  },
  {
    key: "xray-whole-spine-normal", modality: "X-Ray", region: "X-Ray Spine",
    name: "Whole Spine — Normal", studyTitle: "X-RAY WHOLE SPINE AP/LAT", titleSuffix: "",
    technique: "Antero-posterior and lateral radiographs of the whole spine were obtained.",
    recommendation: REC, isNormal: true, sortOrder: 9,
    rows: [
      S("cervical", "Cervical spine: alignment is normal and curvature is maintained. The vertebrae are normal in height and density. The disc spaces are well maintained. Pre and para-vertebral soft tissue shadows appear normal."),
      S("dorsal", "Dorsal spine: curvature is maintained. All the vertebral bodies appear normal in height and density. All the I.V disc spaces appear normal."),
      S("lumbar", "Lumbosacral spine: lumbar lordosis is maintained. All the vertebral bodies appear normal in height and density. All the I.V disc spaces & body heights appear normal."),
      S("sacroiliac", "Sacroiliac joints on both sides appear normal."),
      { region: "X-Ray Spine", concept: "normal_impression", text: "No significant abnormality detected.", inImpression: true, impressionOnly: true },
    ],
  },

  // ── Abdomen erect ────────────────────────────────────────────────────────
  {
    key: "xray-abd-erect-normal", modality: "X-Ray", region: "X-Ray Abdomen",
    name: "Abdomen Erect — Normal", studyTitle: "X-RAY ABDOMEN ERECT", titleSuffix: "",
    technique: "Erect radiograph of the abdomen was obtained.",
    recommendation: REC, isNormal: true, sortOrder: 1,
    rows: [
      A("gas", "Normal gas pattern is seen in the bowel loops."),
      A("levels", "No air-fluid levels are seen."),
      A("pneumoperitoneum", "No evidence of pneumoperitoneum is seen."),
      A("viscera", "Shadow of solid viscera (liver and spleen) appear normal."),
      A("bones", "Lumbo-sacral spine and bony pelvis appear normal."),
      { region: "X-Ray Abdomen", concept: "normal_impression", text: "No significant abnormality detected.", inImpression: true, impressionOnly: true },
    ],
  },
  {
    key: "xray-abd-erect-obstruction", modality: "X-Ray", region: "X-Ray Abdomen",
    name: "Intestinal Obstruction", studyTitle: "X-RAY ABDOMEN ERECT",
    titleSuffix: "intestinal obstruction",
    technique: "Erect radiograph of the abdomen was obtained.",
    recommendation: REC, isNormal: false, sortOrder: 2,
    rows: [
      A("levels", "Dilated small bowel loops with multiple air-fluid levels in the central abdomen, S/o Intestinal obstruction.", { inImpression: true }),
      A("pneumoperitoneum", "No evidence of pneumoperitoneum is seen."),
      A("viscera", "Shadow of solid viscera (liver and spleen) appear normal."),
      A("bones", "Lumbo-sacral spine appears normal."),
    ],
  },
  {
    key: "xray-abd-erect-perforation", modality: "X-Ray", region: "X-Ray Abdomen",
    name: "Intestinal Obstruction + Pneumoperitoneum", studyTitle: "X-RAY ABDOMEN ERECT",
    titleSuffix: "intestinal obstruction with pneumoperitoneum",
    technique: "Erect radiograph of the abdomen was obtained.",
    recommendation: REC, isNormal: false, sortOrder: 3,
    rows: [
      A("levels", "Dilated bowel loops with multiple air-fluid levels, S/o Intestinal obstruction.", { inImpression: true }),
      A("pneumoperitoneum", "Free air is seen under the right dome of the diaphragm, S/o Pneumoperitoneum.", { inImpression: true }),
      A("viscera", "Shadow of solid viscera (liver and spleen) appear normal."),
      A("bones", "Lumbo-sacral spine appears normal."),
    ],
  },

  // ── KUB ──────────────────────────────────────────────────────────────────
  {
    key: "xray-kub-normal", modality: "X-Ray", region: "X-Ray KUB",
    name: "KUB — Normal", studyTitle: "X-RAY K.U.B.", titleSuffix: "",
    technique: "Supine radiograph of the kidney, ureter and bladder region was obtained.",
    recommendation: REC, isNormal: true, sortOrder: 1,
    rows: [
      K("calculus", "No radiopaque calculus in the KUB region."),
      K("psoas", "Both psoas shadows are normal. No abnormal para-vertebral opacity is demonstrated."),
      K("bowel", "Colon is filled with gas and faecal matter."),
      K("bones", "Lumbo-sacral spine and bony pelvis are normal."),
      { region: "X-Ray KUB", concept: "normal_impression", text: "No significant abnormality detected.", inImpression: true, impressionOnly: true },
    ],
  },
  {
    key: "xray-kub-ureteric-calculus", modality: "X-Ray", region: "X-Ray KUB",
    name: "KUB — Ureteric Calculus", studyTitle: "X-RAY K.U.B.",
    titleSuffix: "ureteric calculus",
    technique: "Supine radiograph of the kidney, ureter and bladder region was obtained.",
    recommendation: "IVU suggested.", isNormal: false, sortOrder: 2,
    rows: [
      K("calculus", "A well-defined oval radiopaque shadow overlying the ___ of the ___ vertebra, S/o Ureteric calculus.", { inImpression: true }),
      K("psoas", "Both psoas shadows are normal. No abnormal para-vertebral opacity is demonstrated."),
      K("bowel", "Colon is filled with gas and faecal matter."),
      K("bones", "Lumbo-sacral spine and bony pelvis are normal."),
    ],
  },

  // ── PNS ──────────────────────────────────────────────────────────────────
  {
    key: "xray-pns-normal", modality: "X-Ray", region: "X-Ray PNS",
    name: "PNS — Normal", studyTitle: "X-RAY P.N.S.", titleSuffix: "",
    technique: "Open-mouth Water's view radiograph of the paranasal sinuses was obtained.",
    recommendation: REC, isNormal: true, sortOrder: 1,
    rows: [
      P("maxillary", "Bilateral maxillary sinuses are clear."),
      P("frontal", "Frontal sinuses are well formed and clear."),
      P("septum", "Nasal septum is in the midline."),
      P("bones", "No bony lesion noted."),
      { region: "X-Ray PNS", concept: "normal_impression", text: "No significant abnormality detected.", inImpression: true, impressionOnly: true },
    ],
  },
  {
    key: "xray-pns-sinusitis", modality: "X-Ray", region: "X-Ray PNS",
    name: "PNS — Sinusitis", studyTitle: "X-RAY P.N.S.", titleSuffix: "sinusitis",
    technique: "Open-mouth Water's view radiograph of the paranasal sinuses was obtained.",
    recommendation: REC, isNormal: false, sortOrder: 2,
    rows: [
      P("maxillary", "Haziness is seen in the ___ maxillary sinus, S/o Sinusitis.", { inImpression: true }),
      P("turbinate", "Hypertrophied ___ inferior nasal turbinate.", { inImpression: true }),
      P("frontal", "Frontal sinus is well formed."),
      P("septum", "Nasal septum is mildly deviated towards ___."),
      P("bones", "No bony lesion noted."),
    ],
  },

  // ── Bones / MSK ──────────────────────────────────────────────────────────
  {
    key: "xray-pelvis-normal", modality: "X-Ray", region: "X-Ray Bones",
    name: "Pelvis + Hips — Normal", studyTitle: "X-RAY PELVIS WITH BOTH HIP JOINTS", titleSuffix: "",
    technique: "Antero-posterior radiograph of the pelvis with both hip joints was obtained.",
    recommendation: REC, isNormal: true, sortOrder: 1,
    rows: [
      B("sacrum", "The sacrum and sacroiliac joints are intact."),
      B("innominate", "The innominate bones are normal."),
      B("hips", "The hips are well preserved and normal."),
      B("neck", "Bilateral femoral necks and trochanters are normal. No fracture line seen."),
      { region: "X-Ray Bones", concept: "normal_impression", text: "Normal pelvis, hips and sacroiliac joints.", inImpression: true, impressionOnly: true },
    ],
  },
  {
    key: "xray-bone-age", modality: "X-Ray", region: "X-Ray Bones",
    name: "Bone Age (Wrist)", studyTitle: "X-RAY B/L WRIST FOR BONE AGE", titleSuffix: "",
    technique: "Postero-anterior radiographs of both wrist joints were obtained for bone age assessment.",
    recommendation: REC, isNormal: false, sortOrder: 2,
    rows: [
      B("ossification", "Ossification centres — lower end of radius has appeared, lower end of ulna has appeared / not appeared, metacarpal heads appeared, base of middle phalanx appeared, base of distal phalanx appeared."),
      B("impression", "Average bone age appears to be approximately ___ years.", { inImpression: true }),
    ],
  },
];
