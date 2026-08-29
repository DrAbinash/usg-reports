/**
 * Seed content — the doctor's real radiology language.
 * Phrases use {level} and {laterality} placeholders.
 * NOTE: facet arthropathy and ligamentum flavum hypertrophy are SEPARATE
 * concepts (they coexist clinically — lesson from the CARE R2 review).
 *
 * Complete-report formats live in ./formats/* — curated verbatim from
 * the doctor's own report library (docs/mri-report-formats).
 */

// Complete-report formats: MRI seeds curated verbatim from the doctor's
// own library (docs/mri-report-formats); CT seeds retained below.
import { MR_BRAIN_FORMATS } from "@/lib/formats/mrBrain";
import { MR_BRAIN_PATHOLOGY_FORMATS } from "@/lib/formats/mrBrainPathology";
import { MR_SPINE_FORMATS } from "@/lib/formats/mrSpine";
import { MR_JOINT_FORMATS } from "@/lib/formats/mrJoints";
import { MR_OTHER_FORMATS } from "@/lib/formats/mrOther";

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
  { region: "Cervical Spine", modality: "MR", label: "Loss of lordosis", concept: "alignment", text: "Evidence of loss of cervical lordosis — ? due to spasm.", titleFragment: "loss of cervical lordosis", sortOrder: 10 },

  // ── MRI DL Spine (dorsolumbar) ────────────────────────────────────────
  { region: "DL Spine", modality: "MR", label: "Disc bulge", concept: "disc_contour", text: "At {level}, a posterocentral disc bulge is present with {severity} central canal stenosis.", sortOrder: 1 },
  { region: "DL Spine", modality: "MR", label: "Compression fracture", concept: "fracture", text: "Wedge compression collapse noted involving {level} vertebral body.", titleFragment: "compression fracture", sortOrder: 2 },
  { region: "DL Spine", modality: "MR", label: "Pott's spine", concept: "lesion", text: "Altered marrow signal with endplate erosions and adjacent prevertebral collection at {level} — s/o infective spondylodiscitis.", titleFragment: "pott's spine", sortOrder: 3 },
  { region: "DL Spine", modality: "MR", label: "Cord normal", concept: "cord", text: "The cord shows normal signal intensity.", sortOrder: 4 },

  // ── Whole Spine Screening ─────────────────────────────────────────────
  { region: "Whole Spine Screening", modality: "MR", label: "Loss of lordosis", concept: "alignment", text: "Evidence of loss of cervical lordosis.", sortOrder: 1 },
  { region: "Whole Spine Screening", modality: "MR", label: "Disc bulge", concept: "disc_contour", text: "Mild diffuse disc bulge at {level}.", titleFragment: "disc bulge", sortOrder: 2 },

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
  { region: "Brain", modality: "MR", label: "Ring-enhancing lesion", concept: "mass", text: "Ring-enhancing lesion with significant perilesional edema.", titleFragment: "ring enhancing granuloma", sortOrder: 14 },
  { region: "Brain", modality: "MR", label: "Demyelinating plaques", concept: "wmh", text: "Multiple confluent and discrete hyperintense foci perpendicular to the periventricular white matter — demyelinating plaques.", titleFragment: "demyelinating plaques", sortOrder: 15 },
  { region: "Brain", modality: "MR", label: "Microbleeds (SWI)", concept: "swi", text: "Small regions of susceptibility artifact (cerebral microbleeds) at the grey-white matter junction on SWI.", sortOrder: 16 },

  // ── MRI Knee Joint ────────────────────────────────────────────────────
  { region: "Knee Joint", modality: "MR", label: "Joint effusion", concept: "effusion", text: "Minimal joint effusion.", titleFragment: "joint effusion", sortOrder: 1 },
  { region: "Knee Joint", modality: "MR", label: "Meniscal tear", concept: "menisci", text: "Horizontal tear in the posterior horn of the {laterality} meniscus.", titleFragment: "meniscal tear", sortOrder: 2 },
  { region: "Knee Joint", modality: "MR", label: "ACL partial tear", concept: "cruciate", text: "Partial tear of the anterior cruciate ligament with increased signal and fiber discontinuity.", titleFragment: "acl tear", sortOrder: 3 },
  { region: "Knee Joint", modality: "MR", label: "Bone bruise", concept: "bones", text: "Bone marrow edema / bone bruise noted in the {laterality} tibial plateau.", sortOrder: 4 },
  { region: "Knee Joint", modality: "MR", label: "Baker's cyst", concept: "soft_tissue", text: "A Baker's (popliteal) cyst is noted in the medial gastrocnemius–semimembranosus interval.", titleFragment: "baker's cyst", sortOrder: 5 },
  { region: "Knee Joint", modality: "MR", label: "MCL injury", concept: "collateral", text: "Partial-thickness tear / edema within the {laterality} medial collateral ligament.", sortOrder: 6 },

  // ── MRI Shoulder Joint ────────────────────────────────────────────────
  { region: "Shoulder Joint", modality: "MR", label: "Supraspinatus tendinopathy", concept: "rotator_cuff", text: "Ill-defined increased signal in the supraspinatus tendon near its attachment — ? tendinopathy / partial tear.", sortOrder: 1 },
  { region: "Shoulder Joint", modality: "MR", label: "Supraspinatus full-thickness tear", concept: "rotator_cuff", text: "Full-thickness tear of the supraspinatus tendon with retraction.", titleFragment: "supraspinatus tear", sortOrder: 2 },
  { region: "Shoulder Joint", modality: "MR", label: "Subacromial bursitis", concept: "bursitis", text: "Hyperintense signal in the subacromial–subdeltoid bursa — bursitis.", titleFragment: "subacromial bursitis", sortOrder: 3 },
  { region: "Shoulder Joint", modality: "MR", label: "AC joint arthrosis", concept: "ac_joint", text: "Marginal osteophytes and diminution of the acromioclavicular joint space — degenerative changes.", sortOrder: 4 },
  { region: "Shoulder Joint", modality: "MR", label: "Joint effusion", concept: "effusion", text: "Minimal joint fluid / effusion is seen.", sortOrder: 5 },
  { region: "Shoulder Joint", modality: "MR", label: "Labral tear", concept: "labrum", text: "Tear of the antero-inferior glenoid labrum.", titleFragment: "labral tear", sortOrder: 6 },

  // ── MRI Elbow Joint ───────────────────────────────────────────────────
  { region: "Elbow Joint", modality: "MR", label: "Tennis elbow", concept: "tendons", text: "Tendinopathy / partial tear of the common extensor origin at the lateral epicondyle.", titleFragment: "tennis elbow", sortOrder: 1 },
  { region: "Elbow Joint", modality: "MR", label: "Joint effusion", concept: "effusion", text: "Joint effusion is seen.", sortOrder: 2 },

  // ── MRI Wrist Joint ───────────────────────────────────────────────────
  { region: "Wrist Joint", modality: "MR", label: "TFCC tear", concept: "tfcc", text: "Tear of the triangular fibrocartilage complex.", titleFragment: "tfcc tear", sortOrder: 1 },
  { region: "Wrist Joint", modality: "MR", label: "Carpal tunnel", concept: "carpal_tunnel", text: "The median nerve is flattened within the carpal tunnel — s/o carpal tunnel syndrome.", titleFragment: "carpal tunnel syndrome", sortOrder: 2 },
  { region: "Wrist Joint", modality: "MR", label: "Scapholunate tear", concept: "ligaments", text: "Tear of the scapholunate ligament with diastasis.", titleFragment: "scapholunate tear", sortOrder: 3 },

  // ── MRI Hip Joint ─────────────────────────────────────────────────────
  { region: "Hip Joint", modality: "MR", label: "AVN femoral head", concept: "avn", text: "Altered signal intensity with peripheral T2 hyperintense rim in the {laterality} femoral head — s/o avascular necrosis.", titleFragment: "femoral head avn", sortOrder: 1 },
  { region: "Hip Joint", modality: "MR", label: "Joint effusion", concept: "effusion", text: "Effusion is seen in the {laterality} hip joint.", sortOrder: 2 },
  { region: "Hip Joint", modality: "MR", label: "Labral tear", concept: "labrum", text: "Tear of the {laterality} acetabular labrum.", titleFragment: "labral tear", sortOrder: 3 },

  // ── MRI SI Joint ──────────────────────────────────────────────────────
  { region: "SI Joint", modality: "MR", label: "Sacroiliitis", concept: "sacroiliitis", text: "Evidence of T1 hypo & STIR hyperintensity with erosions in the {laterality} sacroiliac joint.", titleFragment: "sacroiliitis", sortOrder: 1 },
  { region: "SI Joint", modality: "MR", label: "Joint space normal", concept: "joint_space", text: "Joint space of the sacroiliac joints is normal.", sortOrder: 2 },

  // ── MRI Ankle Joint ───────────────────────────────────────────────────
  { region: "Ankle Joint", modality: "MR", label: "Achilles tendinopathy", concept: "achilles", text: "Thickening and increased signal within the Achilles tendon — tendinopathy.", titleFragment: "achilles tendinopathy", sortOrder: 1 },
  { region: "Ankle Joint", modality: "MR", label: "Achilles complete tear", concept: "achilles", text: "Disruption of the Achilles tendon fibers — s/o complete tear.", titleFragment: "achilles tendon tear", sortOrder: 2 },
  { region: "Ankle Joint", modality: "MR", label: "ATFL sprain", concept: "ligaments", text: "Hyperintense signal along the anterior talofibular ligament with wavy appearance — s/o grade I/II sprain.", titleFragment: "ligament sprain", sortOrder: 3 },
  { region: "Ankle Joint", modality: "MR", label: "Ankle effusion", concept: "effusion", text: "Mild tibiotalar joint effusion.", titleFragment: "joint effusion", sortOrder: 4 },

  // ── MRI Orbit ─────────────────────────────────────────────────────────
  { region: "Orbit", modality: "MR", label: "Optic nerve lesion", concept: "optic_nerves", text: "Thickening and abnormal signal of the {laterality} optic nerve.", titleFragment: "optic nerve lesion", sortOrder: 1 },
  { region: "Orbit", modality: "MR", label: "Intraconal mass", concept: "mass", text: "A well-defined intraconal mass lesion is noted in the {laterality} orbit.", titleFragment: "orbital mass", sortOrder: 2 },

  // ── MRI Mastoid ───────────────────────────────────────────────────────
  { region: "Mastoid", modality: "MR", label: "Mastoiditis", concept: "mastoid_cells", text: "Fluid / mucosal thickening in the mastoid air cells — s/o mastoiditis.", titleFragment: "mastoiditis", sortOrder: 1 },

  // ── MRI Brachial Plexus ───────────────────────────────────────────────
  { region: "Brachial Plexus", modality: "MR", label: "Root avulsion", concept: "avulsion", text: "Avulsion of exiting nerve roots with pseudomeningocele formation.", titleFragment: "brachial plexus avulsion", sortOrder: 1 },

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
  { region: "Brain", modality: "MR", text: "MRI brain performed using standard sequences: axial T1, T2, FLAIR, DWI, ADC and SWI. Images acquired on 3 Tesla scanner." },
  { region: "LS Spine", modality: "MR", text: "Multiplanar, multisequence MRI of the lumbar spine was performed without intravenous contrast." },
  { region: "Cervical Spine", modality: "MR", text: "Plain MRI study of the cervical spine was performed using T1, T2 and STIR sequences in multiple planes." },
  { region: "DL Spine", modality: "MR", text: "Plain MRI study of the dorsolumbar spine was performed using T1, T2 and STIR sequences in multiple planes." },
  { region: "Whole Spine Screening", modality: "MR", text: "Images are acquired in limited sections." },
  { region: "Knee Joint", modality: "MR", text: "Images are acquired using T1 & T2 axial, sagittal & coronal sequences." },
  { region: "Shoulder Joint", modality: "MR", text: "Plain MRI study of the shoulder was performed using T1, T2 and STIR sequences in multiple planes with a dedicated surface coil." },
  { region: "Elbow Joint", modality: "MR", text: "The elbow joint was examined in multiple planes using T1, T2 and STIR sequences." },
  { region: "Wrist Joint", modality: "MR", text: "MRI of the wrist was performed using T1, T2, STIR and gradient echo sequences in multiple planes." },
  { region: "Hip Joint", modality: "MR", text: "Multiplanar and multiparametric study of the hip joints was performed." },
  { region: "SI Joint", modality: "MR", text: "T1W and STIR coronal sequences of both sacroiliac joints were obtained." },
  { region: "Ankle Joint", modality: "MR", text: "MRI of the ankle was performed using T1, T2 and STIR sequences in axial, coronal and sagittal planes." },
  { region: "Orbit", modality: "MR", text: "MRI of the brain was performed using T1 and T2 weighted sequences in multiple planes. The orbits were subsequently scanned using high-resolution small FOV sequences." },
  { region: "Mastoid", modality: "MR", text: "Multiplanar, multisequence MRI of the temporal bones and mastoid regions was performed using T1-weighted, T2-weighted and post-contrast sequences." },
  { region: "Brachial Plexus", modality: "MR", text: "Multiplanar MRI of the brachial plexus was performed using T1, T2 and STIR sequences." },
  { region: "Whole Body Screening", modality: "MR", text: "Non-contrast screening of brain, cervical spine, dorsal spine, lumbar spine and chest has been done." },
  { region: "CT Head", modality: "CT", text: "Non-contrast axial CT of the head, 5 mm sections with bone and soft tissue window reconstruction." },
  { region: "CT Spine", modality: "CT", text: "Non-contrast axial and sagittal reformatted CT of the spine with bone and soft tissue windows." },
];

// ── Complete report formats ─────────────────────────────────────────────
// One tap fills the WHOLE report: study title, technique, findings,
// impression, recommendation. Formats expand to FindingRows so later
// phrase additions (e.g. "Chronic infarct") append to the findings and
// impression AND recompose the opening line.
// MRI formats are curated verbatim from the doctor's own library.

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

const CT_FORMAT_SEEDS: FormatSeed[] = [
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

export const FORMAT_SEEDS: FormatSeed[] = [
  ...MR_BRAIN_FORMATS,
  ...MR_BRAIN_PATHOLOGY_FORMATS,
  ...MR_SPINE_FORMATS,
  ...MR_JOINT_FORMATS,
  ...MR_OTHER_FORMATS,
  ...CT_FORMAT_SEEDS,
];
