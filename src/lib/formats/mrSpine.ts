/**
 * MRI Spine complete-report formats — curated from the doctor's own
 * report library. Verbatim clinical language, patient data stripped.
 * AP-diameter tables seeded as fill-in rows (___ mm) — never prefilled.
 */
import type { FormatSeed, FormatRowSeed } from "@/lib/seedData";

const T = {
  ls: "Multiplanar, multisequence MRI of the lumbar spine was performed without intravenous contrast.",
  cervical: "Plain MRI study of the cervical spine was performed using T1, T2 and STIR sequences in multiple planes.",
  dl: "Plain MRI study of the dorsolumbar spine was performed using T1, T2 and STIR sequences in multiple planes.",
  screening: "Images are acquired in limited sections.",
  lsProtocol: "Axial SE T1/FSE T2, sagittal SE T1/FSE T2, STIR coronal.",
  lsCoil: "High-resolution sagittal T1W and FSE T2W images of the lumbosacral spine were obtained on a dedicated phased array surface spine coil and correlated with T1W and T2W axial images.",
  ceDl: "Multiplanar, multisequence CE-MRI of the dorsolumbar spine was performed with whole spine screening. Post-contrast sequences obtained after intravenous gadolinium.",
  tm: "MRI CV junction — T1W sagittal, T2W sagittal, T2W axial, coronal T1 post contrast.",
};

const AP_LS =
  "Lumbar canal AP diameter (mm) — L1-L2: ___ · L2-L3: ___ · L3-L4: ___ · L4-L5: ___ · L5-S1: ___";
const AP_CERVICAL =
  "Cervical canal AP diameter (mm) — C2-C3: ___ · C3-C4: ___ · C4-C5: ___ · C5-C6: ___ · C6-C7: ___";

const r = (region: string) =>
  (concept: string, text: string, extra: Partial<FormatRowSeed> = {}): FormatRowSeed =>
    ({ region, concept, text, inImpression: false, ...extra });

const LS = r("LS Spine");
const CERV = r("Cervical Spine");
const DL = r("DL Spine");
const WSS = r("Whole Spine Screening");

const NI = (region: string): FormatRowSeed => ({
  region, concept: "normal_impression", text: "Normal study.",
  inImpression: true, impressionOnly: true,
});

/** The doctor's classic LS closing scaffold (after the finding rows). */
const LS_SCAFFOLD = (): FormatRowSeed[] => [
  LS("vertebrae", "Vertebrae show normal size, signal intensity and alignment."),
  LS("disc_rest", "Rest of the intervertebral discs are normal in height and signal intensity.", { newParagraph: true }),
  LS("conus", "Conus ends at normal level with normal cauda equina and conus medullaris.", { newParagraph: true }),
  LS("foraminal", "Rest of the neuroforamina are normal.", { newParagraph: true }),
  LS("facet", "Facet joints and ligamentum flavum are normal.", { newParagraph: true }),
  LS("paraspinal", "Paraspinal structures are normal in size and shape with normal signal intensity.", { newParagraph: true }),
  LS("vessels", "The vascular structures appear normal.", { newParagraph: true }),
  LS("measurement", AP_LS, { newParagraph: true }),
];

const CERV_SCAFFOLD = (): FormatRowSeed[] => [
  CERV("vertebrae", "The cervical vertebrae show no focal or diffuse area of altered signal abnormality."),
  CERV("posterior_elements", "The posterior elements are normal.", { newParagraph: true }),
  CERV("cord", "The cord shows normal signal intensity.", { newParagraph: true }),
  CERV("facet", "Facet joints and ligamentum flavum are normal.", { newParagraph: true }),
  CERV("paraspinal", "Pre- and paraspinal structures are normal in size and shape with normal signal intensity.", { newParagraph: true }),
  CERV("vessels", "The vascular structures appear normal.", { newParagraph: true }),
];

export const MR_SPINE_FORMATS: FormatSeed[] = [
  // ── LS Spine ────────────────────────────────────────────────────────
  {
    key: "mr-ls-normal", modality: "MR", region: "LS Spine",
    name: "Normal", studyTitle: "MRI LUMBOSACRAL SPINE", titleSuffix: "",
    technique: T.ls, recommendation: "Clinico-pathological correlation.",
    isNormal: true, sortOrder: 1,
    rows: [
      LS("vertebrae", "The lumbosacral vertebrae show normal size, signal intensity and alignment. No focal or diffuse area of altered signal abnormality."),
      LS("disc", "Intervertebral discs are normal in height and signal intensity.", { newParagraph: true }),
      LS("posterior_elements", "The posterior elements are normal.", { newParagraph: true }),
      LS("conus", "The conus ends at normal level with normal cauda equina and conus medullaris.", { newParagraph: true }),
      LS("foraminal", "Neuroforamina are normal.", { newParagraph: true }),
      LS("facet", "Facet joints and ligamentum flavum are normal.", { newParagraph: true }),
      LS("paraspinal", "Paraspinal structures are normal in size and shape with normal signal intensity. The vascular structures appear normal.", { newParagraph: true }),
      LS("measurement", AP_LS, { newParagraph: true }),
      NI("LS Spine"),
    ],
  },
  {
    key: "mr-ls-finding-mild", modality: "MR", region: "LS Spine",
    name: "Finding — Mild Disc Bulge", studyTitle: "MRI LUMBOSACRAL SPINE",
    titleSuffix: "mild disc bulge",
    technique: T.ls, recommendation: "Clinico-pathological correlation.",
    isNormal: false, sortOrder: 2,
    rows: [
      LS("disc_contour", "There is mild diffuse disc bulge with mild central protrusion at L4-L5.", { inImpression: true, level: "L4-L5" }),
      LS("disc_contour", "There is mild diffuse disc bulge with mild central protrusion at L5-S1.", { inImpression: true, level: "L5-S1", newParagraph: true }),
      ...LS_SCAFFOLD(),
    ],
  },
  {
    key: "mr-ls-finding-mild-mod", modality: "MR", region: "LS Spine",
    name: "Finding — L4-5 Mild, L5-S1 Moderate", studyTitle: "MRI LUMBOSACRAL SPINE",
    titleSuffix: "disc bulge with annular tear",
    technique: T.ls, recommendation: "Clinico-pathological correlation.",
    isNormal: false, sortOrder: 3,
    rows: [
      LS("disc_contour", "There is diffuse disc bulge with posterior annular tear and central protrusion causing anterior thecal sac compression, compression of bilateral traversing nerve roots and bilateral neural foraminal stenosis at L5-S1.", { inImpression: true, level: "L5-S1" }),
      LS("disc_contour", "There is mild diffuse disc bulge with mild central protrusion at L4-L5.", { inImpression: true, level: "L4-L5", newParagraph: true }),
      LS("disc_signal", "Disc desiccation at L4-5 & L5-S1.", { inImpression: true, newParagraph: true }),
      ...LS_SCAFFOLD(),
    ],
  },
  {
    key: "mr-ls-spondylolisthesis", modality: "MR", region: "LS Spine",
    name: "Grade I Spondylolisthesis", studyTitle: "MRI LUMBOSACRAL SPINE",
    titleSuffix: "grade i spondylolisthesis",
    technique: T.lsProtocol, recommendation: "Clinico-pathological correlation. Not for medico-legal purpose.",
    isNormal: false, sortOrder: 4,
    rows: [
      LS("disc_signal", "Disc desiccation at L4-5 & L5-S1.", { inImpression: true }),
      LS("disc_height", "Reduction in height of L4-5 & L5-S1 intervertebral disc spaces.", { inImpression: true, newParagraph: true }),
      LS("spondylolisthesis", "Grade I anterolisthesis of L5 over S1.", { inImpression: true, newParagraph: true }),
      LS("disc_contour", "Diffuse disc bulge at L5-S1 indenting the thecal sac, narrowing the neural foramina and compressing bilateral exiting nerve roots.", { inImpression: true, level: "L5-S1", newParagraph: true }),
      LS("vertebrae", "The lumbosacral vertebral bodies show normal size, contours and marrow signal intensities. No evidence of vertebral collapse, retropulsion or vertebral destruction.", { newParagraph: true }),
      LS("posterior_elements", "The posterior elements are normal.", { newParagraph: true }),
      LS("conus", "Conus ends at L1 level and appears normal. Visualized spinal cord does not reveal any mass lesion or abnormality.", { newParagraph: true }),
      LS("paraspinal", "The pre- and para-vertebral soft tissues are normal.", { newParagraph: true }),
      LS("measurement", AP_LS, { newParagraph: true }),
    ],
  },
  {
    key: "mr-ls-compression-fracture", modality: "MR", region: "LS Spine",
    name: "Compression Fracture", studyTitle: "MRI LUMBOSACRAL SPINE",
    titleSuffix: "compression fracture",
    technique: T.lsCoil, recommendation: "Clinico-pathological correlation.",
    isNormal: false, sortOrder: 5,
    rows: [
      LS("alignment", "Lumbar lordosis is normal."),
      LS("disc_signal", "Loss of normal T2 signal intensity suggestive of desiccative degenerative changes involving intervertebral discs at L1-2, L2-L3, L3-L4, L4-5 & L5-S1.", { inImpression: true, newParagraph: true }),
      LS("fracture", "Wedge compression collapse with mild anterior wedging noted involving D11 vertebral body.", { inImpression: true, level: "D11", newParagraph: true }),
      LS("endplate", "Modic Type II/III endplate changes with osteophytic changes seen at various levels.", { inImpression: true, newParagraph: true }),
      LS("hemangioma", "Vertebral hemangioma seen at D12 & L1.", { inImpression: true, newParagraph: true }),
      LS("canal", "Bony canal is capacious at all levels. No evidence of spinal canal stenosis.", { newParagraph: true }),
      LS("conus", "The conus medullaris terminates at the L1 level and the thecal sac terminates at the L5-S1 level.", { newParagraph: true }),
      LS("cord", "Spinal cord appears normal in signal intensity. Pre- and paravertebral soft tissues are normal.", { newParagraph: true }),
    ],
  },
  {
    key: "mr-ls-screening", modality: "MR", region: "LS Spine",
    name: "Screening — Disc Bulge", studyTitle: "MRI SCREENING OF LUMBAR SPINE",
    titleSuffix: "disc bulge",
    technique: T.screening,
    recommendation: "Clinico-pathological correlation. / Detailed MRI LS Spine if clinically indicated.",
    isNormal: false, sortOrder: 6,
    rows: [
      LS("counting", "Lowermost prominent vertebra counted as L5."),
      LS("alignment", "Evidence of loss of lumbar lordosis.", { inImpression: true, newParagraph: true }),
      LS("disc_contour", "Mild disc bulge at L1-2, L2-3, L3-4, L4-5 & L5-S1.", { inImpression: true, newParagraph: true }),
      LS("endplate", "Modic type endplate changes & disc desiccation at various levels.", { inImpression: true, newParagraph: true }),
      LS("scaffold_rest", "Rest of the vertebrae show normal size, signal intensity and alignment. Rest of the intervertebral discs are normal in height and signal intensity. Rest of the neuroforamina are normal. Facet joints and ligamentum flavum are normal. Paraspinal structures are normal in size and shape with normal signal intensity. The vascular structures appear normal.", { newParagraph: true }),
    ],
  },

  // ── Cervical Spine ──────────────────────────────────────────────────
  {
    key: "mr-cervical-normal", modality: "MR", region: "Cervical Spine",
    name: "Normal", studyTitle: "MRI CERVICAL SPINE", titleSuffix: "",
    technique: T.cervical, recommendation: "Please correlate clinically.",
    isNormal: true, sortOrder: 1,
    rows: [
      CERV("vertebrae", "The cervical vertebrae show no focal or diffuse area of altered signal abnormality."),
      CERV("posterior_elements", "The posterior elements are normal.", { newParagraph: true }),
      CERV("cord", "The cervical cord shows normal signal intensity. The cervico-medullary junction is normal.", { newParagraph: true }),
      CERV("facet", "Facet joints and ligamentum flavum are normal.", { newParagraph: true }),
      CERV("paraspinal", "Pre- and paraspinal structures are normal in size and shape with normal signal intensity.", { newParagraph: true }),
      CERV("vessels", "The vascular structures appear normal.", { newParagraph: true }),
      NI("Cervical Spine"),
    ],
  },
  {
    key: "mr-cervical-finding", modality: "MR", region: "Cervical Spine",
    name: "Finding — Disc Bulge + Canal Stenosis", studyTitle: "MRI CERVICAL SPINE",
    titleSuffix: "disc bulge with canal stenosis",
    technique: T.cervical + " (Screening — limited sequences.)",
    recommendation: "Please correlate clinically.",
    isNormal: false, sortOrder: 2,
    rows: [
      CERV("disc_contour", "Disc bulge at C6-7 with central canal stenosis.", { inImpression: true, level: "C6-C7" }),
      CERV("alignment", "Evidence of loss of cervical lordosis.", { inImpression: true, newParagraph: true }),
      CERV("measurement", AP_CERVICAL, { newParagraph: true }),
      ...CERV_SCAFFOLD(),
    ],
  },
  {
    key: "mr-cervical-loss-lordosis", modality: "MR", region: "Cervical Spine",
    name: "Loss of Cervical Lordosis", studyTitle: "MRI CERVICAL SPINE",
    titleSuffix: "loss of cervical lordosis",
    technique: T.cervical, recommendation: "Please correlate clinically.",
    isNormal: false, sortOrder: 3,
    rows: [
      CERV("alignment", "Evidence of loss of cervical lordosis — ? due to spasm.", { inImpression: true }),
      ...CERV_SCAFFOLD(),
    ],
  },
  {
    key: "mr-cervical-cord-oedema", modality: "MR", region: "Cervical Spine",
    name: "Disc Bulge + Cord Oedema", studyTitle: "MRI CERVICAL SPINE",
    titleSuffix: "cord oedema",
    technique: T.cervical, recommendation: "Please correlate clinically.",
    isNormal: false, sortOrder: 4,
    rows: [
      CERV("alignment", "Loss of cervical lordosis.", { inImpression: true }),
      CERV("disc_contour", "Diffuse broad-based disc bulge with posterior annular tear and central protrusion causing anterior thecal sac compression and compression of bilateral traversing nerve roots at C4-5, C5-C6 & C6-7.", { inImpression: true, level: "C5-C6", newParagraph: true }),
      CERV("cord", "Low T1W signal intensity is seen in the cord from C4 through C5 vertebral levels, appearing hyperintense on T2W images — suggestive of cord oedema.", { inImpression: true, newParagraph: true }),
      CERV("disc_signal", "Disc desiccation at various levels.", { inImpression: true, newParagraph: true }),
      CERV("measurement", AP_CERVICAL, { newParagraph: true }),
      CERV("vertebrae", "Rest of the cervical vertebrae show no focal or diffuse area of altered signal abnormality."),
      CERV("posterior_elements", "The posterior elements are normal.", { newParagraph: true }),
      CERV("facet", "Facet joints and ligamentum flavum are normal.", { newParagraph: true }),
      CERV("paraspinal", "Pre- and paraspinal structures are normal in size and shape with normal signal intensity. The vascular structures appear normal.", { newParagraph: true }),
    ],
  },
  {
    key: "mr-cervical-tm", modality: "MR", region: "Cervical Spine",
    name: "Transverse Myelitis (CE)", studyTitle: "CE-MRI CERVICAL SPINE",
    titleSuffix: "transverse myelitis",
    technique: T.tm, recommendation: "Please correlate clinically.",
    isNormal: false, sortOrder: 5,
    rows: [
      CERV("cord", "Long-segment altered signal intensity appearing T2/STIR hyperintense in the cord from C3-C7 with mild post-contrast enhancement — transverse myelitis to be considered.", { inImpression: true }),
      CERV("disc_contour", "C3-C4, C4-C5 and C6-C7 intervertebral discs show mild disc bulge causing compression over the thecal sac without neural compression.", { inImpression: true }),
      CERV("disc_contour", "C5-C6 intervertebral disc shows diffuse disc bulge causing compression over the thecal sac and abutting the cord.", { inImpression: true, level: "C5-C6", newParagraph: true }),
      CERV("cvj", "The occipital condyles, atlas and axis show normal anatomical configuration. No congenital abnormality seen. The measurement lines of craniovertebral junction anomaly viz. Chamberlain line, McRae line and Welcher basal angle are within normal limits. No evidence of basilar impression / basilar invagination.", { newParagraph: true }),
      CERV("brainstem", "The visualized pons, cerebellum, cervico-medullary junction and cervical spinal cord show normal signal intensities.", { newParagraph: true }),
      CERV("paraspinal", "Pre- and paravertebral soft tissues appear unremarkable.", { newParagraph: true }),
    ],
  },
  {
    key: "mr-cervical-acm-syrinx", modality: "MR", region: "Cervical Spine",
    name: "Arnold Chiari + Syringomyelia", studyTitle: "MRI CERVICAL & DORSAL SPINE",
    titleSuffix: "arnold chiari malformation with syringomyelia",
    technique: T.cervical, recommendation: "Please correlate clinically.",
    isNormal: false, sortOrder: 6,
    rows: [
      CERV("cord", "The cervical cord shows dilatation inside the substance of the cord with increased signal intensity on T2WI — s/o syringomyelia.", { inImpression: true }),
      CERV("acm", "Peg-like descent of cerebellum is seen in upper cervical canal — s/o Arnold Chiari malformation.", { inImpression: true, newParagraph: true }),
      CERV("vertebrae", "The cervical vertebrae show no focal or diffuse area of altered signal abnormality."),
      CERV("posterior_elements", "The posterior elements are normal.", { newParagraph: true }),
      CERV("facet", "Facet joints and ligamentum flavum are normal.", { newParagraph: true }),
      CERV("paraspinal", "Pre- and paraspinal structures are normal in size and shape with normal signal intensity. The vascular structures appear normal.", { newParagraph: true }),
    ],
  },

  // ── Dorsolumbar Spine ───────────────────────────────────────────────
  {
    key: "mr-dl-normal", modality: "MR", region: "DL Spine",
    name: "Normal", studyTitle: "MRI DORSO-LUMBAR SPINE", titleSuffix: "",
    technique: T.dl, recommendation: "Please correlate clinically.",
    isNormal: true, sortOrder: 1,
    rows: [
      DL("vertebrae", "The vertebrae show no focal or diffuse area of altered signal abnormality."),
      DL("posterior_elements", "The posterior elements are normal.", { newParagraph: true }),
      DL("cord", "The cord shows normal signal intensity.", { newParagraph: true }),
      DL("facet", "Facet joints and ligamentum flavum are normal.", { newParagraph: true }),
      DL("paraspinal", "Pre- and paraspinal structures are normal in size and shape with normal signal intensity.", { newParagraph: true }),
      DL("vessels", "The vascular structures appear normal.", { newParagraph: true }),
      NI("DL Spine"),
    ],
  },
  {
    key: "mr-dl-finding", modality: "MR", region: "DL Spine",
    name: "Finding — Disc Bulge + Stenosis", studyTitle: "MRI DORSO-LUMBAR SPINE",
    titleSuffix: "disc bulge with canal stenosis",
    technique: T.dl, recommendation: "Please correlate clinically.",
    isNormal: false, sortOrder: 2,
    rows: [
      DL("disc_contour", "Evidence of mild posterocentral disc bulge at L1-L2, L2-L3 and L5-S1 with mild central canal stenosis.", { inImpression: true }),
      DL("disc_contour", "Evidence of significant posterocentral and left lateral disc bulge at L4-L5 with central canal stenosis and compression on left lateral exiting nerve roots.", { inImpression: true, level: "L4-L5", newParagraph: true }),
      DL("vertebrae", "The dorso-lumbar vertebrae show no focal or diffuse area of altered signal abnormality."),
      DL("posterior_elements", "The posterior elements are normal.", { newParagraph: true }),
      DL("cord", "The cord shows normal signal intensity.", { newParagraph: true }),
      DL("facet", "Facet joints and ligamentum flavum are normal.", { newParagraph: true }),
      DL("paraspinal", "Pre- and paraspinal structures are normal in size and shape with normal signal intensity. The vascular structures appear normal.", { newParagraph: true }),
    ],
  },
  {
    key: "mr-dl-tb-spine", modality: "MR", region: "DL Spine",
    name: "TB Spine (Pott's) — CE", studyTitle: "CE-MRI DORSO-LUMBAR SPINE WITH WHOLE SPINE SCREENING",
    titleSuffix: "pott's spine",
    technique: T.ceDl, recommendation: "Clinico-pathological correlation.",
    isNormal: false, sortOrder: 3,
    rows: [
      DL("lesion", "Diffuse hypointense bone marrow with high STIR signal intensity and endplate erosions involving L1-L2 vertebral bodies with marrow oedema and heterogeneous signal intensity involving the disc. Adjacent prevertebral collection measuring maximum thickness of 9 mm extending into right psoas muscle, causing mild compression over the anterior thecal sac. No central canal stenosis.", { inImpression: true }),
      DL("disc_contour", "L4-5 and L5-S1 level: mild posterior disc bulge indenting the anterior thecal sac, no central canal or neural foraminal stenosis.", { newParagraph: true }),
      DL("scaffold", "The intervertebral discs show normal height and signal pattern. The facet joints and neural foramina appear normal. The pedicles, laminae, spinous processes and transverse processes show normal morphology. The ligamentum flavum thickness is within normal limits. The spinal cord, conus medullaris and subarachnoid space are normal. The nerve roots of the cauda equina appear normal.", { newParagraph: true }),
      DL("measurement", "Canal diameter at L1 to L5 levels (mm) — L1-L2: ___ · L2-L3: ___ · L3-L4: ___ · L4-L5: ___ · L5-S1: ___", { newParagraph: true }),
      DL("screening", "Screening of cervical spine: no significant abnormality is seen.", { newParagraph: true }),
      DL("impression_summary", "Well-defined regular heterogeneously enhancing altered signal intensity changes with adjacent prevertebral collection extending into the psoas muscles — features suggestive of Pott's spine. D/D — metastasis.", { inImpression: true, impressionOnly: true }),
    ],
  },

  // ── Whole Spine Screening ───────────────────────────────────────────
  {
    key: "mr-wss-cervical-dorsal", modality: "MR", region: "Whole Spine Screening",
    name: "Screening — Cervical & Dorsal", studyTitle: "MRI SCREENING OF CERVICAL & DORSAL SPINE",
    titleSuffix: "disc bulge",
    technique: T.screening,
    recommendation: "Clinico-pathological correlation. / Detailed study of cervical spine if clinically indicated.",
    isNormal: false, sortOrder: 1,
    rows: [
      WSS("alignment", "Evidence of loss of cervical lordosis.", { inImpression: true }),
      WSS("disc_contour", "Mild diffuse disc bulge at C4-C5, C5-C6 & C6-C7.", { inImpression: true, newParagraph: true }),
      WSS("scaffold_rest", "Rest of the vertebrae show normal size, signal intensity and alignment. Rest of the intervertebral discs are normal in height and signal intensity. Rest of the neuroforamina are normal. Facet joints and ligamentum flavum are normal. Paraspinal structures are normal in size and shape with normal signal intensity. The vascular structures appear normal.", { newParagraph: true }),
      WSS("impression_summary", "Rest — normal screening study of cervical & dorsal spine.", { inImpression: true, impressionOnly: true }),
    ],
  },
  {
    key: "mr-wss-ls-detail", modality: "MR", region: "Whole Spine Screening",
    name: "LS Detail + Cervical & Dorsal Screening", studyTitle: "MRI LS SPINE WITH SCREENING OF CERVICAL & DORSAL SPINE",
    titleSuffix: "disc bulge with canal stenosis",
    technique: T.ls, recommendation: "Suggested: MRI pelvis with SI joints if clinically indicated. Please correlate clinically.",
    isNormal: false, sortOrder: 2,
    rows: [
      WSS("alignment", "LUMBOSACRAL SPINE — Loss of normal lumbar lordosis, suggestive of muscle spasm or postural alteration."),
      WSS("vertebrae", "Vertebral bodies show normal height and marrow signal intensity except for Modic Type 2 endplate changes at D12, L2, L3, L4 and L5. Schmorl's node noted at D12.", { newParagraph: true }),
      WSS("disc_signal", "Disc desiccation from L1-2 to L5-S1.", { inImpression: true, newParagraph: true }),
      WSS("disc_contour", "L4-5 and L5-S1: broad-based disc bulge with anterior thecal sac compression and bilateral exiting nerve root compression. Remaining lumbar discs show mild degenerative changes without significant canal or foraminal compromise.", { inImpression: true, newParagraph: true }),
      WSS("measurement", AP_LS, { newParagraph: true }),
      WSS("facet", "Hypertrophy of facet joints at L4-5 and L5-S1 contributing to canal and foraminal narrowing. Ligamentum flavum hypertrophy at L4-5 and L5-S1. Posterior longitudinal ligament hypertrophy noted at lower lumbar levels.", { inImpression: true, newParagraph: true }),
      WSS("canal", "Mild to moderate canal stenosis at L4-5 and L5-S1 due to combined disc, ligamentous and facet changes, with bilateral exiting nerve root compression.", { inImpression: true, newParagraph: true }),
      WSS("cervical_screen", "CERVICAL SPINE SCREENING — Loss of normal cervical lordosis, possibly due to muscle spasm. C4-5 and C5-6: diffuse disc bulge with anterior thecal sac compression. No significant spinal canal stenosis or cord signal changes.", { inImpression: true, newParagraph: true }),
      WSS("dorsal_screen", "DORSAL SPINE SCREENING — Dorsal vertebral bodies and discs appear normal. No evidence of disc herniation, canal stenosis or cord signal abnormality.", { newParagraph: true }),
    ],
  },
];
