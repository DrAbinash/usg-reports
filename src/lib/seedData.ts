/**
 * Seed content — real radiology language (Phase 10 of the build spec).
 * Phrases use {level} and {laterality} placeholders.
 * NOTE: facet arthropathy and ligamentum flavum hypertrophy are SEPARATE
 * concepts (they coexist clinically — lesson from the CARE R2 review).
 */

export type PhraseSeed = {
  region: string;
  modality: string;
  label: string;
  concept: string;
  level?: string | null;
  laterality?: string | null;
  severity?: string | null;
  text: string;
  titleFragment?: string | null;
  sortOrder: number;
};

export const PHRASE_SEEDS: PhraseSeed[] = [
  // ── MRI LS Spine ──────────────────────────────────────────────────────
  { region: "LS Spine", modality: "MR", label: "Normal level", concept: "disc_contour", text: "At {level}, disc height and signal are preserved with no herniation. Neural foramina patent. No canal stenosis.", sortOrder: 1 },
  { region: "LS Spine", modality: "MR", label: "Disc bulge", concept: "disc_contour", text: "At {level}, a broad-based disc bulge is present.", sortOrder: 2 },
  { region: "LS Spine", modality: "MR", label: "Protrusion", concept: "disc_contour", text: "At {level}, a focal disc protrusion is present, {laterality} paracentral, contacting the traversing nerve root.", sortOrder: 3 },
  { region: "LS Spine", modality: "MR", label: "Extrusion", concept: "disc_contour", text: "At {level}, a disc extrusion is present with {laterality} paracentral extension.", sortOrder: 4 },
  { region: "LS Spine", modality: "MR", label: "Canal stenosis", concept: "canal_stenosis", text: "At {level}, there is {severity} central canal stenosis.", sortOrder: 5 },
  { region: "LS Spine", modality: "MR", label: "Foraminal stenosis", concept: "foraminal_stenosis", text: "At {level}, {severity} {laterality} neural foraminal stenosis.", sortOrder: 6 },
  { region: "LS Spine", modality: "MR", label: "Desiccation", concept: "disc_signal", text: "Disc desiccation is noted at {level}.", sortOrder: 7 },
  { region: "LS Spine", modality: "MR", label: "Reduced height", concept: "disc_height", text: "Reduced disc height is noted at {level}.", sortOrder: 8 },
  { region: "LS Spine", modality: "MR", label: "Modic change", concept: "endplate", text: "{severity} endplate (Modic) changes are noted at {level}.", sortOrder: 9 },
  { region: "LS Spine", modality: "MR", label: "Spondylolisthesis", concept: "spondylolisthesis", text: "Grade {severity} spondylolisthesis of {level}.", sortOrder: 10 },
  { region: "LS Spine", modality: "MR", label: "Facet OA", concept: "facet_joint", text: "Facet arthropathy is noted at {level}.", sortOrder: 11 },
  { region: "LS Spine", modality: "MR", label: "LF hypertrophy", concept: "ligamentum_flavum", text: "Ligamentum flavum hypertrophy is noted at {level}.", sortOrder: 12 },
  { region: "LS Spine", modality: "MR", label: "Schmorl node", concept: "schmorl", text: "A Schmorl node is noted at {level}.", sortOrder: 13 },
  { region: "LS Spine", modality: "MR", label: "Vertebral hemangioma", concept: "hemangioma", text: "A vertebral hemangioma is noted at {level}.", sortOrder: 14 },
  { region: "LS Spine", modality: "MR", label: "Compression fracture", concept: "fracture", text: "{severity} vertebral compression fracture at {level}.", titleFragment: "compression fracture", sortOrder: 15 },
  { region: "LS Spine", modality: "MR", label: "Conus normal", concept: "conus", text: "The conus medullaris terminates normally at L1 with normal signal.", sortOrder: 16 },
  { region: "LS Spine", modality: "MR", label: "Marrow normal", concept: "marrow", text: "Vertebral marrow signal is normal with no focal lesion.", sortOrder: 17 },

  // ── MRI Cervical Spine ────────────────────────────────────────────────
  { region: "Cervical Spine", modality: "MR", label: "Normal level", concept: "disc_contour", text: "At {level}, disc height and signal are preserved with no herniation. Neural foramina patent. No canal stenosis.", sortOrder: 1 },
  { region: "Cervical Spine", modality: "MR", label: "Disc bulge", concept: "disc_contour", text: "At {level}, a broad-based disc bulge is present.", sortOrder: 2 },
  { region: "Cervical Spine", modality: "MR", label: "Protrusion", concept: "disc_contour", text: "At {level}, a focal disc protrusion is present, {laterality} paracentral, contacting the exiting nerve root.", sortOrder: 3 },
  { region: "Cervical Spine", modality: "MR", label: "Canal stenosis", concept: "canal_stenosis", text: "At {level}, there is {severity} central canal stenosis.", sortOrder: 4 },
  { region: "Cervical Spine", modality: "MR", label: "Foraminal stenosis", concept: "foraminal_stenosis", text: "At {level}, {severity} {laterality} neural foraminal stenosis.", sortOrder: 5 },
  { region: "Cervical Spine", modality: "MR", label: "Cord signal normal", concept: "cord", text: "Cervical cord shows normal signal with no compression.", sortOrder: 6 },
  { region: "Cervical Spine", modality: "MR", label: "Facet OA", concept: "facet_joint", text: "Facet arthropathy is noted at {level}.", sortOrder: 7 },
  { region: "Cervical Spine", modality: "MR", label: "LF hypertrophy", concept: "ligamentum_flavum", text: "Ligamentum flavum hypertrophy is noted at {level}.", sortOrder: 8 },
  { region: "Cervical Spine", modality: "MR", label: "Straightening", concept: "alignment", text: "Straightening of cervical spine curvature is noted.", sortOrder: 9 },

  // ── MRI Brain ─────────────────────────────────────────────────────────
  { region: "Brain", modality: "MR", label: "Fazekas", concept: "fazekas", text: "White matter hyperintensities are consistent with Fazekas grade {severity}.", sortOrder: 1 },
  { region: "Brain", modality: "MR", label: "Age-appropriate atrophy", concept: "atrophy", text: "Age-appropriate cerebral volume loss.", sortOrder: 2 },
  { region: "Brain", modality: "MR", label: "Small vessel ischemia", concept: "svd", text: "Small vessel ischemic changes in bilateral cerebral white matter.", sortOrder: 3 },
  { region: "Brain", modality: "MR", label: "No acute infarct", concept: "infarct", text: "No acute infarct or restricted diffusion.", sortOrder: 4 },
  { region: "Brain", modality: "MR", label: "No hemorrhage", concept: "hemorrhage", text: "No intracranial hemorrhage or contusion.", sortOrder: 5 },
  { region: "Brain", modality: "MR", label: "No midline shift", concept: "midline", text: "Midline structures are in position; no midline shift.", sortOrder: 6 },
  { region: "Brain", modality: "MR", label: "Ventricles normal", concept: "ventricles", text: "Ventricles and cisternal spaces are normal for age.", sortOrder: 7 },
  { region: "Brain", modality: "MR", label: "Chronic infarct", concept: "infarct_chronic", text: "{laterality} chronic infarct in the middle cerebral artery territory with encephalomalacia.", titleFragment: "chronic infarct", sortOrder: 8 },
  { region: "Brain", modality: "MR", label: "Acute infarct", concept: "infarct", text: "Restricted diffusion in the middle cerebral artery territory — acute infarct.", titleFragment: "acute infarct", sortOrder: 13 },
  { region: "Brain", modality: "MR", label: "Pineal cyst", concept: "pineal_cyst", text: "A small pineal cyst is noted — incidental, no mass effect.", sortOrder: 9 },
  { region: "Brain", modality: "MR", label: "WM hyperintensities", concept: "wmh", text: "A few {severity} white matter hyperintensities in bilateral cerebral hemispheres.", sortOrder: 10 },
  { region: "Brain", modality: "MR", label: "Empty sella", concept: "empty_sella", text: "Partially empty sella with the pituitary gland flattened against the floor.", sortOrder: 11 },
  { region: "Brain", modality: "MR", label: "Sinus mucosal thickening", concept: "sinus", text: "Mucosal thickening in the {laterality} paranasal sinuses.", sortOrder: 12 },

  // ── CT Head ───────────────────────────────────────────────────────────
  { region: "CT Head", modality: "CT", label: "No acute infarct", concept: "infarct", text: "No acute infarct or acute hypodensity.", sortOrder: 1 },
  { region: "CT Head", modality: "CT", label: "No hemorrhage", concept: "hemorrhage", text: "No intracranial hemorrhage, extra-axial collection, or contusion.", sortOrder: 2 },
  { region: "CT Head", modality: "CT", label: "No fracture", concept: "fracture", text: "No acute fracture or bony abnormality.", sortOrder: 3 },
  { region: "CT Head", modality: "CT", label: "Edema / midline shift", concept: "midline", text: "Cerebral edema with {severity} mm midline shift.", sortOrder: 4 },
  { region: "CT Head", modality: "CT", label: "Chronic ischemia", concept: "svd", text: "Chronic small vessel ischemic changes.", sortOrder: 5 },
  { region: "CT Head", modality: "CT", label: "Age-appropriate atrophy", concept: "atrophy", text: "Age-appropriate diffuse cerebral volume loss.", sortOrder: 6 },
  { region: "CT Head", modality: "CT", label: "Sinus opacification", concept: "sinus", text: "Opacification of the {laterality} paranasal sinuses.", sortOrder: 7 },
  { region: "CT Head", modality: "CT", label: "Calcification", concept: "calcification", text: "{laterality} calcified focus noted — likely senescent.", sortOrder: 8 },
  { region: "CT Head", modality: "CT", label: "Post-op changes", concept: "postop", text: "Post-operative changes with craniotomy defect and underlying encephalomalacia.", sortOrder: 9 },
  { region: "CT Head", modality: "CT", label: "Acute infarct", concept: "infarct", text: "Hypodensity with loss of grey–white differentiation in the middle cerebral artery territory — acute infarct.", titleFragment: "acute infarct", sortOrder: 10 },
  { region: "CT Head", modality: "CT", label: "Chronic infarct", concept: "infarct_chronic", text: "{laterality} chronic infarct with encephalomalacia and ex-vacuo dilatation of the adjacent ventricle.", titleFragment: "chronic infarct", sortOrder: 11 },

  // ── CT Spine ──────────────────────────────────────────────────────────
  { region: "CT Spine", modality: "CT", label: "Alignment normal", concept: "alignment", text: "Vertebral alignment is normal with no listhesis.", sortOrder: 1 },
  { region: "CT Spine", modality: "CT", label: "Compression fracture", concept: "fracture", text: "{severity} vertebral compression fracture at {level}.", titleFragment: "compression fracture", sortOrder: 2 },
  { region: "CT Spine", modality: "CT", label: "Degenerative disc", concept: "disc_contour", text: "Degenerative disc disease with {laterality} osteophyte ridge at {level}.", sortOrder: 3 },
  { region: "CT Spine", modality: "CT", label: "Canal stenosis", concept: "canal_stenosis", text: "At {level}, there is {severity} central canal stenosis.", sortOrder: 4 },
  { region: "CT Spine", modality: "CT", label: "Facet OA", concept: "facet_joint", text: "Facet arthropathy is noted at {level}.", sortOrder: 5 },
  { region: "CT Spine", modality: "CT", label: "Paraspinal hematoma", concept: "hematoma", text: "{laterality} paraspinal hematoma is noted.", sortOrder: 6 },
];

export type TechniqueSeed = { region: string; modality: string; text: string };

export const TECHNIQUE_SEEDS: TechniqueSeed[] = [
  { region: "LS Spine", modality: "MR", text: "Sagittal T1, T2 and STIR; axial T2 images of the lumbar spine from L1 through S1 were obtained." },
  { region: "Cervical Spine", modality: "MR", text: "Sagittal T1, T2 and STIR; axial T2 images of the cervical spine from C2 through T1 were obtained." },
  { region: "Brain", modality: "MR", text: "Multiplanar multisequence MRI of the brain including T1, T2, FLAIR, DWI and susceptibility sequences was performed." },
  { region: "CT Head", modality: "CT", text: "Non-contrast axial CT of the head, 5 mm sections with bone and soft tissue window reconstruction." },
  { region: "CT Spine", modality: "CT", text: "Non-contrast axial and sagittal reformatted CT of the spine with bone and soft tissue windows." },
];

// ── Complete report formats ─────────────────────────────────────────────
// One tap fills the WHOLE report: study title, technique, findings,
// impression, recommendation. Formats expand to FindingRows so later
// phrase additions (e.g. "Chronic infarct") append to the findings and
// impression AND recompose the study title.

export type FormatRowSeed = {
  region: string;
  concept: string;
  text: string;
  inImpression?: boolean;
  newParagraph?: boolean;
  /** Impression-only line (never printed inside Findings). */
  impressionOnly?: boolean;
  level?: string | null;
  laterality?: string | null;
  severity?: string | null;
};

export type FormatSeed = {
  key: string;
  modality: string;
  region: string;
  name: string;
  studyTitle: string;
  titleSuffix: string;
  technique: string;
  recommendation: string;
  isNormal: boolean;
  sortOrder: number;
  rows: FormatRowSeed[];
};

const T = {
  brainMr: "Multiplanar multisequence MRI of the brain including T1, T2, FLAIR, DWI and susceptibility sequences was performed.",
  lsMr: "Sagittal T1, T2 and STIR; axial T2 images of the lumbar spine from L1 through S1 were obtained.",
  cervicalMr: "Sagittal T1, T2 and STIR; axial T2 images of the cervical spine from C2 through T1 were obtained.",
  headCt: "Non-contrast axial CT of the head, 5 mm sections with bone and soft tissue window reconstruction.",
  spineCt: "Non-contrast axial and sagittal reformatted CT of the spine with bone and soft tissue windows.",
};

/** The normal-impression line — auto-yields when an abnormal finding enters the impression. */
const NORMAL_IMPRESSION = (region: string): FormatRowSeed => ({
  region,
  concept: "normal_impression",
  text: "No significant abnormality detected.",
  inImpression: true,
  impressionOnly: true,
});

export const FORMAT_SEEDS: FormatSeed[] = [
  // ── MRI Brain ────────────────────────────────────────────────────────
  {
    key: "mr-brain-normal", modality: "MR", region: "Brain",
    name: "Normal", studyTitle: "MRI BRAIN", titleSuffix: "",
    technique: T.brainMr, recommendation: "", isNormal: true, sortOrder: 1,
    rows: [
      { region: "Brain", concept: "scaffold", text: "Cerebral hemispheres show normal grey–white matter differentiation. No focal lesion, mass effect or midline shift.", inImpression: false },
      { region: "Brain", concept: "ventricles", text: "Ventricles and cisternal spaces are normal for age. No hydrocephalus.", inImpression: false, newParagraph: true },
      { region: "Brain", concept: "infarct", text: "No acute infarct or restricted diffusion. No intracranial hemorrhage or contusion.", inImpression: false, newParagraph: true },
      { region: "Brain", concept: "posterior_fossa", text: "Brainstem, cerebellum and posterior fossa structures are normal. Visualized paranasal sinuses, mastoid air cells and orbits are unremarkable.", inImpression: false, newParagraph: true },
      NORMAL_IMPRESSION("Brain"),
    ],
  },
  {
    key: "mr-brain-fazekas1-senile", modality: "MR", region: "Brain",
    name: "Fazekas Gr 1 + Senile Changes", studyTitle: "MRI BRAIN",
    titleSuffix: "fazekas grade 1 changes and senile changes",
    technique: T.brainMr, recommendation: "Correlate clinically.", isNormal: false, sortOrder: 2,
    rows: [
      // Normal scaffold — the report reads “normal WITH abnormal findings of …”
      { region: "Brain", concept: "scaffold", text: "Cerebral hemispheres show normal grey–white matter differentiation. No focal lesion, mass effect or midline shift.", inImpression: false },
      { region: "Brain", concept: "wmh", text: "Few punctate T2/FLAIR hyperintensities in the periventricular and deep cerebral white matter — consistent with Fazekas grade 1 small vessel ischemic changes.", inImpression: true, newParagraph: true },
      // Same slot as the normal "ventricles" line — replaces it (prominent CSF spaces)
      { region: "Brain", concept: "ventricles", text: "Senile cerebral atrophy — sulci and CSF spaces are prominent for age.", inImpression: true, newParagraph: true },
      { region: "Brain", concept: "infarct", text: "No acute infarct or restricted diffusion. No intracranial hemorrhage or contusion.", inImpression: false, newParagraph: true },
      { region: "Brain", concept: "posterior_fossa", text: "Brainstem, cerebellum and posterior fossa structures are normal. Visualized paranasal sinuses, mastoid air cells and orbits are unremarkable.", inImpression: false, newParagraph: true },
    ],
  },
  {
    key: "mr-brain-fazekas2", modality: "MR", region: "Brain",
    name: "Fazekas Gr 2", studyTitle: "MRI BRAIN",
    titleSuffix: "fazekas grade 2 changes",
    technique: T.brainMr, recommendation: "Correlate clinically.", isNormal: false, sortOrder: 3,
    rows: [
      { region: "Brain", concept: "scaffold", text: "Cerebral hemispheres show normal grey–white matter differentiation. No focal lesion, mass effect or midline shift.", inImpression: false },
      { region: "Brain", concept: "wmh", text: "Confluent T2/FLAIR hyperintensities in the periventricular and deep cerebral white matter — consistent with Fazekas grade 2 small vessel ischemic changes.", inImpression: true, newParagraph: true },
      { region: "Brain", concept: "infarct", text: "No acute infarct or restricted diffusion. No intracranial hemorrhage or contusion.", inImpression: false, newParagraph: true },
      { region: "Brain", concept: "posterior_fossa", text: "Brainstem, cerebellum and posterior fossa structures are normal. Visualized paranasal sinuses, mastoid air cells and orbits are unremarkable.", inImpression: false, newParagraph: true },
    ],
  },
  {
    key: "mr-brain-fazekas3", modality: "MR", region: "Brain",
    name: "Fazekas Gr 3", studyTitle: "MRI BRAIN",
    titleSuffix: "fazekas grade 3 changes",
    technique: T.brainMr, recommendation: "Correlate clinically.", isNormal: false, sortOrder: 4,
    rows: [
      { region: "Brain", concept: "scaffold", text: "Cerebral hemispheres show normal grey–white matter differentiation. No mass effect or midline shift.", inImpression: false },
      { region: "Brain", concept: "wmh", text: "Extensive confluent T2/FLAIR hyperintensities involving the periventricular and deep cerebral white matter — consistent with Fazekas grade 3 small vessel ischemic changes.", inImpression: true, newParagraph: true },
      { region: "Brain", concept: "infarct", text: "No acute infarct or restricted diffusion. No intracranial hemorrhage.", inImpression: false, newParagraph: true },
      { region: "Brain", concept: "posterior_fossa", text: "Brainstem, cerebellum and posterior fossa structures are normal. Visualized paranasal sinuses and mastoid air cells are unremarkable.", inImpression: false, newParagraph: true },
    ],
  },

  // ── MRI LS Spine ─────────────────────────────────────────────────────
  {
    key: "mr-ls-normal", modality: "MR", region: "LS Spine",
    name: "Normal", studyTitle: "MRI LUMBOSACRAL SPINE", titleSuffix: "",
    technique: T.lsMr, recommendation: "", isNormal: true, sortOrder: 1,
    rows: [
      { region: "LS Spine", concept: "alignment", text: "Lumbar spine alignment is normal with no spondylolisthesis. Vertebral body heights are maintained and marrow signal is normal with no focal lesion.", inImpression: false },
      { region: "LS Spine", concept: "disc_contour", text: "Disc heights and hydration are preserved at all levels with no bulge, herniation or canal stenosis. Nerve roots of the cauda equina are unremarkable.", inImpression: false, newParagraph: true },
      { region: "LS Spine", concept: "facet_joint", text: "Facet joints and ligamenta flava are unremarkable. Neural foramina are patent bilaterally.", inImpression: false, newParagraph: true },
      { region: "LS Spine", concept: "conus", text: "The conus medullaris terminates normally at L1 with normal signal intensity.", inImpression: false, newParagraph: true },
      NORMAL_IMPRESSION("LS Spine"),
    ],
  },

  // ── MRI Cervical Spine ───────────────────────────────────────────────
  {
    key: "mr-cervical-normal", modality: "MR", region: "Cervical Spine",
    name: "Normal", studyTitle: "MRI CERVICAL SPINE", titleSuffix: "",
    technique: T.cervicalMr, recommendation: "", isNormal: true, sortOrder: 1,
    rows: [
      { region: "Cervical Spine", concept: "alignment", text: "Cervical spine alignment is normal with no listhesis. Vertebral body heights and marrow signal are preserved.", inImpression: false },
      { region: "Cervical Spine", concept: "disc_contour", text: "Disc heights and hydration are preserved at all levels with no bulge, herniation or canal stenosis. Neural foramina are patent bilaterally.", inImpression: false, newParagraph: true },
      { region: "Cervical Spine", concept: "cord", text: "The cervical cord shows normal caliber and signal intensity with no compression.", inImpression: false, newParagraph: true },
      { region: "Cervical Spine", concept: "facet_joint", text: "Facet joints and ligamenta flava are unremarkable.", inImpression: false, newParagraph: true },
      NORMAL_IMPRESSION("Cervical Spine"),
    ],
  },

  // ── CT Head ──────────────────────────────────────────────────────────
  {
    key: "ct-head-normal", modality: "CT", region: "CT Head",
    name: "Normal", studyTitle: "CT HEAD", titleSuffix: "",
    technique: T.headCt, recommendation: "", isNormal: true, sortOrder: 1,
    rows: [
      { region: "CT Head", concept: "scaffold", text: "Cerebral parenchyma shows normal attenuation with no focal lesion, mass effect or midline shift.", inImpression: false },
      { region: "CT Head", concept: "ventricles", text: "Ventricles and cisternal spaces are normal for age. No hydrocephalus.", inImpression: false, newParagraph: true },
      { region: "CT Head", concept: "infarct", text: "No acute infarct or hypodensity. No intracranial hemorrhage, extra-axial collection or contusion.", inImpression: false, newParagraph: true },
      { region: "CT Head", concept: "fracture", text: "No fracture. Visualized paranasal sinuses and mastoid air cells are clear.", inImpression: false, newParagraph: true },
      NORMAL_IMPRESSION("CT Head"),
    ],
  },
  {
    key: "ct-head-senile", modality: "CT", region: "CT Head",
    name: "Senile Changes", studyTitle: "CT HEAD",
    titleSuffix: "senile changes",
    technique: T.headCt, recommendation: "Correlate clinically.", isNormal: false, sortOrder: 2,
    rows: [
      { region: "CT Head", concept: "scaffold", text: "Cerebral parenchyma shows normal attenuation with no focal lesion or mass effect.", inImpression: false },
      { region: "CT Head", concept: "svd", text: "Chronic small vessel ischemic changes in bilateral cerebral white matter.", inImpression: true, newParagraph: true },
      // Same slot as the normal "ventricles" line — prominent CSF spaces replace it
      { region: "CT Head", concept: "ventricles", text: "Senile cerebral atrophy — sulci and CSF spaces are prominent for age.", inImpression: true, newParagraph: true },
      { region: "CT Head", concept: "infarct", text: "No acute infarct or hypodensity. No intracranial hemorrhage, extra-axial collection or contusion. No fracture. Visualized paranasal sinuses and mastoid air cells are clear.", inImpression: false, newParagraph: true },
    ],
  },

  // ── CT Spine ─────────────────────────────────────────────────────────
  {
    key: "ct-spine-normal", modality: "CT", region: "CT Spine",
    name: "Normal", studyTitle: "CT SPINE", titleSuffix: "",
    technique: T.spineCt, recommendation: "", isNormal: true, sortOrder: 1,
    rows: [
      { region: "CT Spine", concept: "alignment", text: "Vertebral alignment is normal with no listhesis or acute fracture. Vertebral body heights are maintained.", inImpression: false },
      { region: "CT Spine", concept: "disc_contour", text: "No destructive bony lesion. Facet joints are unremarkable. Disc heights are maintained with no significant osteophyte ridge or canal stenosis.", inImpression: false, newParagraph: true },
      { region: "CT Spine", concept: "hematoma", text: "Paraspinal soft tissues are unremarkable.", inImpression: false, newParagraph: true },
      NORMAL_IMPRESSION("CT Spine"),
    ],
  },
];
