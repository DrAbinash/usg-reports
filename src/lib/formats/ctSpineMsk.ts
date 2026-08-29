/**
 * CT Spine / Musculoskeletal complete-report formats — curated verbatim from
 * the doctor's own CT report library (care-erp docs/report-formats/ct).
 * AP-diameter measurement tables always seed as blanks (___ mm) — never with
 * sample values (medico-legal safety).
 */
import type { FormatSeed, FormatRowSeed } from "@/lib/seedData";

const REC = "Clinico-pathological correlation. Not for medico-legal purpose.";

const S = (
  concept: string,
  text: string,
  extra: Partial<FormatRowSeed> = {},
): FormatRowSeed => ({ region: "CT Spine", concept, text, inImpression: false, ...extra });

const NI = (): FormatRowSeed => ({
  region: "CT Spine", concept: "normal_impression", text: "No significant abnormality seen.",
  inImpression: true, impressionOnly: true,
});

/** The doctor's blank AP-diameter table — measurements are NEVER prefilled. */
const AP_TABLE = (): FormatRowSeed[] =>
  ["L1-2", "L2-3", "L3-4", "L4-5", "L5-S1"].map((lvl, i) =>
    S("canal_ap", `- ${lvl} = ___ mm`, { level: lvl, newParagraph: i === 0, inImpression: false }),
  );

export const CT_SPINE_FORMATS: FormatSeed[] = [
  {
    key: "ct-ls-spine-normal", modality: "CT", region: "CT Spine",
    name: "Normal (LS Spine)", studyTitle: "NCCT LUMBAR SPINE", titleSuffix: "",
    technique: "The lumbar spine was studied with 3 x 2 mm sections in helical mode taken from T12 to S1 vertebrae.",
    recommendation: "Clinical correlation. Not for medico-legal purposes.", isNormal: true, sortOrder: 1,
    rows: [
      S("alignment", "Lumbar lordosis is maintained."),
      S("disc_contour", "Visualised disc spaces are normal."),
      S("vertebrae", "Vertebral bodies appear normal."),
      ...AP_TABLE(),
      S("facet_joint", "Facetal joints appear normal."),
      S("sol", "No focal lesion seen."),
      S("soft_tissue", "No abnormal pre or para vertebral soft tissue mass is seen.", { newParagraph: true }),
      NI(),
    ],
  },
  {
    key: "ct-dls-spine-normal", modality: "CT", region: "CT Spine",
    name: "Normal (DLS Spine)", studyTitle: "NCCT DORSO-LUMBO-SACRAL SPINE", titleSuffix: "",
    technique: "The DLS spine was studied with 3 x 2 mm sections in helical mode.",
    recommendation: "Clinical correlation. MRI DLS spine if indicated. Not for medico-legal purposes.", isNormal: true, sortOrder: 2,
    rows: [
      S("canal_ap", "Spinal canal diameters are normal."),
      S("alignment", "Spinal curvature is maintained."),
      S("disc_contour", "Visualised disc spaces are normal."),
      S("facet_joint", "Facetal joints appear normal."),
      S("sol", "No focal lesion seen."),
      S("soft_tissue", "No abnormal pre or para vertebral soft tissue mass is seen.", { newParagraph: true }),
      NI(),
    ],
  },
  {
    key: "ct-ls-spine-disc-bulge", modality: "CT", region: "CT Spine",
    name: "Disc Bulge — L4-5, L5-S1", studyTitle: "NCCT LUMBAR SPINE",
    titleSuffix: "disc bulge and degenerative changes",
    technique: "The lumbar spine was studied in helical mode; sections were taken from T12 to S1 vertebrae.",
    recommendation: "Clinico-pathological correlation.", isNormal: false, sortOrder: 3,
    rows: [
      S("alignment", "Lumbar lordosis is maintained."),
      S("disc_contour", "There is evidence of disc degeneration involving the L5-S1 and L4-5 intervertebral disc levels with diffuse disc bulge causing indentation of thecal sac.", { inImpression: true, level: "L4-5" }),
      ...AP_TABLE(),
      S("vertebrae", "Extensive degenerative changes seen in the visualized vertebral bodies with evidence of osteophytes in the margins of the vertebral bodies.", { inImpression: true }),
      S("soft_tissue", "No abnormal pre or para vertebral soft tissue mass is seen.", { newParagraph: true }),
    ],
  },
  {
    key: "ct-ls-spine-degenerative", modality: "CT", region: "CT Spine",
    name: "Degenerative Changes + SI Arthropathy", studyTitle: "NCCT LUMBO-SACRAL SPINE",
    titleSuffix: "degenerative changes",
    technique: "Non-contrast axial and sagittal reformatted CT of the lumbosacral spine with bone and soft tissue windows.",
    recommendation: "MRI lumbar spine for status of intervertebral discs. Not for medico-legal purpose.", isNormal: false, sortOrder: 4,
    rows: [
      S("vertebrae", "Lumbar spine shows mild spondylosis.", { inImpression: true }),
      S("facet_joint", "There is facetal arthropathy at L5-S1 level.", { inImpression: true, level: "L5-S1" }),
      S("si_joint", "Bilateral sacro-iliac joints show sclerosis and osteophytes.", { inImpression: true }),
      S("sol", "Other vertebral bodies show normal attenuation. No obvious fractures. No evidence of osteolysis / osteosclerosis. No evidence of spondylolysis / listhesis."),
      S("posterior_elements", "Transverse processes, other facetal processes, laminae and spinous processes appear normal. No obvious fractures."),
      S("canal_stenosis", "Spinal canal is normal. No evidence of extradural / intradural / intramedullary mass lesion."),
      S("disc_contour", "Intervertebral levels: discs show normal height. No significant herniations.", { newParagraph: true }),
      S("soft_tissue", "No pre or para vertebral soft tissue mass lesion seen.", { newParagraph: true }),
    ],
  },
  {
    key: "ct-tls-spine-compression-fracture", modality: "CT", region: "CT Spine",
    name: "Compression Fracture (TLS Spine)", studyTitle: "NCCT THORACO-LUMBAR SPINE",
    titleSuffix: "compression fracture",
    technique: "NCCT of thoraco-lumbar-sacral spine. 5.0 mm and 2.0 mm non-contiguous sections were taken from D1 to S1 vertebrae.",
    recommendation: "MRI DLS spine. Not for medico-legal purposes.", isNormal: false, sortOrder: 5,
    rows: [
      S("fracture", "Anterior wedge compression fracture of the L1 vertebra.", { inImpression: true, level: "L1" }),
      S("disc_contour", "Intervertebral disc spaces are maintained."),
      S("vertebrae", "Marginal osteophyte formation at L4-L5 vertebra.", { inImpression: true }),
      S("soft_tissue", "Bilateral ligamenta flava and paravertebral soft tissue are normal."),
      S("foramina", "Bilateral neural foramina are normal."),
      S("canal_ap", "Spinal canal diameters are within normal limits."),
      S("facet_joint", "Lumbar facet joints are normal."),
      S("prevertebral", "Prevertebral soft tissue planes are maintained.", { newParagraph: true }),
    ],
  },
  {
    key: "ct-cervical-spine-degenerative", modality: "CT", region: "CT Spine",
    name: "Cervical Spondylosis + OPLL", studyTitle: "CT CERVICAL SPINE",
    titleSuffix: "degenerative changes with opll",
    technique: "Non-contrast axial and sagittal reformatted CT of the cervical spine with bone and soft tissue windows.",
    recommendation: "MRI for further evaluation. Not for medico-legal purpose.", isNormal: false, sortOrder: 6,
    rows: [
      S("opll", "There is ossification of the posterior longitudinal ligament extending from the C2-C7 level with impingement on the thecal sac.", { inImpression: true }),
      S("vertebrae", "Visualised bones show osteopenia. Degenerative changes are seen at all vertebral body levels.", { inImpression: true }),
      S("alignment", "Cervical spine shows moderate spondylosis with loss of lordosis.", { inImpression: true }),
      S("posterior_elements", "Pedicles, laminae, spinous and transverse processes appear normal."),
      S("sol", "No evidence of osteolysis / osteosclerosis."),
      S("cv_junction", "No evidence of basilar invagination / atlanto-axial dislocation."),
      S("fracture", "No evidence of obvious fracture."),
      S("soft_tissue", "Pre and para vertebral soft tissues are normal."),
      S("disc_contour", "Intervertebral levels: disc height reduction at all cervical levels with anterior and posterior marginal osteophytes.", { newParagraph: true }),
    ],
  },
  {
    key: "ct-potts-spine", modality: "CT", region: "CT Spine",
    name: "Pott's Spine with Cold Abscess", studyTitle: "CT SPINE WITH CONTRAST",
    titleSuffix: "pott's spine with cold abscess",
    technique: "CT scan of the spine was performed with contrast, serial continuous sections.",
    recommendation: "MRI spine for better evaluation. Clinico-pathological correlation. Not for medico-legal purpose.", isNormal: false, sortOrder: 7,
    rows: [
      S("potts", "Soft tissue density noted at L4-5 level tracking down to left SI joint and along left iliopsoas muscle. Heterogeneous post contrast enhancement noted — likely Pott's spine with cold abscess. There is destruction of L5 vertebra.", { inImpression: true }),
      S("collection", "Loculated collection also noted near left iliopsoas muscle 3.1 x 3.3 cm.", { inImpression: true }),
      S("facet_joint", "Both hip joints are normal."),
      S("vertebrae", "The bony trabecular pattern is normal. Visualized ilium, ischium and pubic bones are normal."),
      S("soft_tissue", "Visualised pelvic girdle is normal.", { newParagraph: true }),
    ],
  },
  {
    key: "ct-pelvis-acetabulum-fracture", modality: "CT", region: "CT Pelvis",
    name: "Acetabular Fracture + Dislocation", studyTitle: "NCCT PELVIS",
    titleSuffix: "acetabular fracture",
    technique: "NCCT of the pelvis done by taking (5 x 5 mm) axial sections from the superior margin of the ilium up to the proximal femur.",
    recommendation: "Clinical correlation. Not for medico-legal purposes.", isNormal: false, sortOrder: 1,
    rows: [
      { region: "CT Pelvis", concept: "fracture", text: "Comminuted fracture of the right acetabular rim with dislocation of the femoral head.", inImpression: true },
      { region: "CT Pelvis", concept: "bones", text: "Rest of the visualized bones are normal in density and alignment.", newParagraph: true },
      { region: "CT Pelvis", concept: "hip_joint", text: "Left hip joint is normal." },
      { region: "CT Pelvis", concept: "femur", text: "Visualized bilateral proximal femur are normal." },
      { region: "CT Pelvis", concept: "vertebrae", text: "Visualized vertebrae are normal in height and alignment." },
    ],
  },
];
