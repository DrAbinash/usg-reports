/**
 * Seed content — the doctor's real radiology language.
 * Phrases use {level} and {laterality} placeholders.
 * NOTE: facet arthropathy and ligamentum flavum hypertrophy are SEPARATE
 * concepts (they coexist clinically — lesson from the CARE R2 review).
 *
 * Complete-report formats live in ./formats/* — curated verbatim from
 * the doctor's own report library (docs/mri-report-formats).
 */

// Complete-report formats: MRI + CT + USG + X-ray seeds curated verbatim from
// the doctor's own libraries (docs/mri-report-formats + docs/report-formats/{ct,usg,xray}).
import { MR_BRAIN_FORMATS } from "@/lib/formats/mrBrain";
import { MR_BRAIN_PATHOLOGY_FORMATS } from "@/lib/formats/mrBrainPathology";
import { MR_SPINE_FORMATS } from "@/lib/formats/mrSpine";
import { MR_JOINT_FORMATS } from "@/lib/formats/mrJoints";
import { MR_OTHER_FORMATS } from "@/lib/formats/mrOther";
import { CT_BRAIN_FORMATS } from "@/lib/formats/ctBrain";
import { CT_SPINE_FORMATS } from "@/lib/formats/ctSpineMsk";
import { CT_BODY_FORMATS } from "@/lib/formats/ctBody";
import { USG_ABDOMEN_FORMATS } from "@/lib/formats/usgAbdomen";
import { USG_OBSGYN_FORMATS } from "@/lib/formats/usgObsGyn";
import { USG_SMALLPARTS_FORMATS } from "@/lib/formats/usgSmallParts";
import { XRAY_GENERAL_FORMATS } from "@/lib/formats/xrayGeneral";
import { XRAY_PROCEDURES_FORMATS } from "@/lib/formats/xrayProcedures";

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

  // ── CT Head (scaffold lines from the doctor's own NCCT format) ────────
  { region: "CT Head", modality: "CT", label: "Hemispheres normal", concept: "parenchyma", text: "Bilateral cerebral hemispheres are normal in attenuation.", sortOrder: 12 },
  { region: "CT Head", modality: "CT", label: "Ganglia normal", concept: "deep_gray", text: "Bilateral basal ganglia and thalamus are normal in attenuation.", sortOrder: 13 },
  { region: "CT Head", modality: "CT", label: "Post fossa normal", concept: "posterior_fossa", text: "Posterior fossa structures are normal in attenuation.", sortOrder: 14 },
  { region: "CT Head", modality: "CT", label: "Sulci normal", concept: "sulci", text: "Cortical sulci and sylvian fissures are normal.", sortOrder: 15 },
  { region: "CT Head", modality: "CT", label: "Ventricles normal", concept: "ventricles", text: "Ventricular system is normal.", sortOrder: 16 },
  { region: "CT Head", modality: "CT", label: "Falx central", concept: "midline", text: "Falx is central.", sortOrder: 17 },
  { region: "CT Head", modality: "CT", label: "No extra-axial collection", concept: "extra_axial", text: "There is no extra-axial collection.", sortOrder: 18 },
  { region: "CT Head", modality: "CT", label: "Calvarium intact", concept: "calvarium", text: "Bony calvarium is intact.", sortOrder: 19 },
  { region: "CT Head", modality: "CT", label: "Scalp oedema", concept: "soft_tissue", text: "Soft tissue swelling in {laterality} fronto-temporo-parietal region.", titleFragment: "scalp oedema", sortOrder: 20 },
  { region: "CT Head", modality: "CT", label: "Acute SAH", concept: "sah", text: "Hyperdense area of blood density in the interhemispheric fissure — S/O acute subarachnoid haemorrhage.", titleFragment: "subarachnoid haemorrhage", sortOrder: 21 },
  { region: "CT Head", modality: "CT", label: "Hydrocephalus", concept: "ventricles_dilated", text: "Dilated bilateral lateral, 3rd and 4th ventricles suggesting hydrocephalus.", titleFragment: "hydrocephalus", sortOrder: 22 },

  // ── CT Chest ──────────────────────────────────────────────────────────
  { region: "CT Chest", modality: "CT", label: "Koch's consolidation", concept: "consolidation", text: "Inhomogeneous air-space consolidation seen in apical segment of {laterality} upper lobe — ? tuberculous etiology.", titleFragment: "pulmonary koch's", sortOrder: 1 },
  { region: "CT Chest", modality: "CT", label: "Fibrotic densities", concept: "fibrosis", text: "Small fibrotic densities seen in the {laterality} upper lobe — old healed Koch's lesions.", titleFragment: "fibrotic densities", sortOrder: 2 },
  { region: "CT Chest", modality: "CT", label: "Pleural effusion", concept: "effusion", text: "Mild pleural effusion seen on {laterality} side.", titleFragment: "pleural effusion", sortOrder: 3 },
  { region: "CT Chest", modality: "CT", label: "Nodes normal", concept: "nodes", text: "No enlarged mediastinal or hilar lymphadenopathy seen.", sortOrder: 4 },

  // ── CT Abdomen ────────────────────────────────────────────────────────
  { region: "CT Abdomen", modality: "CT", label: "Fatty liver", concept: "liver", text: "Liver shows diffuse hypodensity — fatty infiltration.", titleFragment: "fatty liver", sortOrder: 1 },
  { region: "CT Abdomen", modality: "CT", label: "Hepatomegaly", concept: "liver", text: "Liver is enlarged in size.", titleFragment: "hepatomegaly", sortOrder: 2 },
  { region: "CT Abdomen", modality: "CT", label: "Renal calculus", concept: "kidneys", text: "A well defined hyperdense calculus in the {laterality} kidney.", titleFragment: "renal calculus", sortOrder: 3 },
  { region: "CT Abdomen", modality: "CT", label: "Free fluid", concept: "peritoneum", text: "Evidence of free fluid in the abdominal cavity.", titleFragment: "free fluid", sortOrder: 4 },

  // ── CT PNS ────────────────────────────────────────────────────────────
  { region: "CT PNS", modality: "CT", label: "Mucosal thickening", concept: "sinusitis", text: "Mucosal thickening noted in the {laterality} maxillary sinus.", titleFragment: "sinusitis", sortOrder: 1 },
  { region: "CT PNS", modality: "CT", label: "DNS", concept: "septum", text: "Deviated nasal septum towards {laterality} side.", titleFragment: "deviated nasal septum", sortOrder: 2 },
  { region: "CT PNS", modality: "CT", label: "OMC blocked", concept: "omc", text: "Osteomeatal complex on {laterality} side is blocked.", sortOrder: 3 },

  // ── CT Orbit ──────────────────────────────────────────────────────────
  { region: "CT Orbit", modality: "CT", label: "Proptosis", concept: "globes", text: "Proptosis of the {laterality} globe.", titleFragment: "proptosis", sortOrder: 1 },
  { region: "CT Orbit", modality: "CT", label: "Orbital mass", concept: "mass", text: "A well-defined mass lesion in the {laterality} orbit.", titleFragment: "orbital mass", sortOrder: 2 },

  // ── CT Neck ───────────────────────────────────────────────────────────
  { region: "CT Neck", modality: "CT", label: "Thyroid nodule", concept: "thyroid", text: "Thyroid nodule in the {laterality} lobe.", titleFragment: "thyroid nodule", sortOrder: 1 },
  { region: "CT Neck", modality: "CT", label: "Lymphadenopathy", concept: "nodes", text: "Multiple enlarged cervical lymphnodes in bilateral levels II, III and IV.", titleFragment: "cervical lymphadenopathy", sortOrder: 2 },

  // ── CT Face ───────────────────────────────────────────────────────────
  { region: "CT Face", modality: "CT", label: "Nasal bone fracture", concept: "fracture", text: "Fracture of the nasal bone.", titleFragment: "nasal bone fracture", sortOrder: 1 },
  { region: "CT Face", modality: "CT", label: "Maxillary fracture", concept: "fracture", text: "Fracture of the {laterality} maxillary wall.", titleFragment: "maxillary fracture", sortOrder: 2 },

  // ── USG Whole Abdomen — organ-slot replacement chips (the doctor's exact
  // scaffold lines; each chip replaces the normal line of its organ slot) ──
  { region: "USG Whole Abdomen", modality: "USG", label: "Fatty liver Gr I", concept: "liver", text: "Liver is enlarged in size and measures in mid-clavicular line ___ cm. Appears normal in morphology with mildly increased hepatic parenchymal echogenicity (Grade I fatty changes). No masses or focal pathology is noted.", titleFragment: "fatty changes", sortOrder: 1 },
  { region: "USG Whole Abdomen", modality: "USG", label: "Fatty liver Gr II", concept: "liver", text: "Liver is enlarged in size and measures in mid-clavicular line ___ cm. Shows moderately increased hepatic parenchymal echogenicity with mild attenuation and blurring of the portal vein radicles (Grade II fatty changes).", titleFragment: "grade ii fatty changes", sortOrder: 2 },
  { region: "USG Whole Abdomen", modality: "USG", label: "Hepatomegaly", concept: "liver", text: "Liver is enlarged in size and measures in mid-clavicular line ___ cm. Appears normal in morphology and parenchymal echogenicity. No masses or focal pathology is noted.", titleFragment: "hepatomegaly", sortOrder: 3 },
  { region: "USG Whole Abdomen", modality: "USG", label: "GB calculus", concept: "gb", text: "Gall bladder is normal in physiological distension. A well defined echogenic structure (___ cm) casting strong distal acoustic shadow is seen in the lumen of the gall bladder, suggestive of calculus. Wall thickness is normal.", titleFragment: "cholelithiasis", sortOrder: 4 },
  { region: "USG Whole Abdomen", modality: "USG", label: "GB wall thickened", concept: "gb", text: "Gall bladder wall is thickened and oedematous with positive sonographic Murphy's sign, S/o Cholecystitis. No pericholecystic collection.", titleFragment: "cholecystitis", sortOrder: 5 },
  { region: "USG Whole Abdomen", modality: "USG", label: "GB sludge", concept: "gb", text: "Gall bladder contains low-level echogenic sludge with gravity-dependent layering. No definitive calculus.", titleFragment: "gb sludge", sortOrder: 6 },
  { region: "USG Whole Abdomen", modality: "USG", label: "CBD dilated", concept: "cbd", text: "C.B.D is dilated and measures ___ cm in diameter. No evidence of intraluminal calculus.", titleFragment: "dilated cbd", sortOrder: 7 },
  { region: "USG Whole Abdomen", modality: "USG", label: "CBD calculus", concept: "cbd", text: "C.B.D is dilated and measures ___ cm in diameter. A well defined echogenic focus (___ cm) casting strong distal acoustic shadow is seen in the distal part of the C.B.D, S/o Choledocholithiasis.", titleFragment: "choledocholithiasis", sortOrder: 8 },
  { region: "USG Whole Abdomen", modality: "USG", label: "Fatty pancreas", concept: "pancreas", text: "Pancreas appears bulky and shows increased parenchymal echogenicity. Pancreatic duct is not dilated.", titleFragment: "fatty pancreas", sortOrder: 9 },
  { region: "USG Whole Abdomen", modality: "USG", label: "Splenomegaly", concept: "spleen", text: "Spleen is enlarged and measures ___ cm in length. Appears normal in morphology and parenchymal echogenicity.", titleFragment: "splenomegaly", sortOrder: 10 },
  { region: "USG Whole Abdomen", modality: "USG", label: "Right renal calculus", concept: "kidneys", text: "Right kidney is normal in shape, size & position. A well defined echogenic focus (___ cm) casting strong distal acoustic shadow is seen at the ___ calyx of the right kidney, S/o calculus. No hydronephrosis.", titleFragment: "right renal calculus", sortOrder: 11 },
  { region: "USG Whole Abdomen", modality: "USG", label: "Left renal calculus", concept: "kidneys_lt", text: "Left kidney is normal in shape, size & position. A well defined echogenic focus (___ cm) casting strong distal acoustic shadow is seen at the ___ calyx of the left kidney, S/o calculus. No hydronephrosis.", titleFragment: "left renal calculus", sortOrder: 12 },
  { region: "USG Whole Abdomen", modality: "USG", label: "Right hydronephrosis", concept: "kidneys", text: "Right kidney shows mild dilatation of the pelvicalyceal system (hydronephrosis). Calculus is not obvious in the right renal area.", titleFragment: "right hydronephrosis", sortOrder: 13 },
  { region: "USG Whole Abdomen", modality: "USG", label: "Left hydronephrosis", concept: "kidneys_lt", text: "Left kidney shows mild dilatation of the pelvicalyceal system (hydronephrosis). Calculus is not obvious in the left renal area.", titleFragment: "left hydronephrosis", sortOrder: 14 },
  { region: "USG Whole Abdomen", modality: "USG", label: "Renal cortical cyst", concept: "kidneys", text: "Right kidney is normal in shape, size & position. A well defined simple cortical cyst (___ x ___ cm) with thin wall and clear content is seen at the ___ pole of the right kidney. No internal echoes or septa.", titleFragment: "renal cortical cyst", sortOrder: 15 },
  { region: "USG Whole Abdomen", modality: "USG", label: "VUJ calculus", concept: "ureters", text: "A well defined echogenic focus (___ cm), casting strong distal acoustic shadow is seen at the ___ vesico-ureteric junction. ___ ureter is dilated upto the calculus, with mild hydroureteronephrosis.", titleFragment: "vuj calculus", sortOrder: 16 },
  { region: "USG Whole Abdomen", modality: "USG", label: "Distal ureteric calculus", concept: "ureters", text: "A well defined echogenic focus (___ cm), casting strong distal acoustic shadow is seen in the ___ distal ureter. ___ ureter is dilated upto the calculus.", titleFragment: "distal ureteric calculus", sortOrder: 17 },
  { region: "USG Whole Abdomen", modality: "USG", label: "Thickened UB wall", concept: "ub", text: "Urinary bladder is partially distended. Thickened U.B wall. No evidence of calculus, mass or diverticulum is seen.", titleFragment: "cystitis", sortOrder: 18 },
  { region: "USG Whole Abdomen", modality: "USG", label: "UB calculus", concept: "ub", text: "Urinary bladder is normal in outline and distension. A well defined echogenic focus (___ cm) casting strong distal acoustic shadow is seen in the urinary bladder, S/o calculus.", titleFragment: "bladder calculus", sortOrder: 19 },
  { region: "USG Whole Abdomen", modality: "USG", label: "Prostatomegaly", concept: "prostate", text: "Prostate is enlarged in size and measures ___ X ___ X ___ cm, corresponding to ___ gms (Grade ___ prostatomegaly). Median lobe is protruding into the urinary bladder base.", titleFragment: "prostatomegaly", sortOrder: 20 },
  { region: "USG Whole Abdomen", modality: "USG", label: "Acute appendicitis", concept: "rif", text: "A tubular, non-compressible, blind-ended structure with target configuration is seen in the right iliac fossa, measuring ___ cm in length and ___ cm in diameter. Wall is thickened with increased surrounding echogenicity of mesenteric fat. Strong probe tenderness present, S/o Acute Appendicitis.", titleFragment: "acute appendicitis", sortOrder: 21 },
  { region: "USG Whole Abdomen", modality: "USG", label: "Mesenteric nodes", concept: "others", text: "Few enlarged mesenteric lymph nodes (largest ___ x ___ cm) are seen in the right iliac fossa / peri-umbilical region.", titleFragment: "mesenteric lymphadenopathy", sortOrder: 22 },
  { region: "USG Whole Abdomen", modality: "USG", label: "Fluid & faeces loops", concept: "others", text: "Excessive bowel gas shadow. Fluid and faeces filled bowel loops.", titleFragment: "fluid and faeces filled bowel loops", sortOrder: 23 },
  { region: "USG Whole Abdomen", modality: "USG", label: "Free fluid", concept: "others", text: "Mild free peritoneal fluid is seen in the dependent parts.", titleFragment: "mild ascites", sortOrder: 24 },

  // ── USG Pregnancy / TVS ─────────────────────────────────────────────────
  { region: "USG Pregnancy", modality: "USG", label: "Fetal demise", concept: "fetus", text: "No fetal cardiac activity and no fetal somatic movements are seen.", titleFragment: "intrauterine death", sortOrder: 1 },
  { region: "USG TVS", modality: "USG", label: "Bulky uterus", concept: "uterus", text: "Uterus is bulky in size and measures ___ X ___ X ___ cm.", titleFragment: "bulky uterus", sortOrder: 1 },
  { region: "USG TVS", modality: "USG", label: "PCOD ovaries", concept: "adnexa", text: "Multiple small cystic structures (5-6 mm) are arranged at the periphery of both ovaries in pearl of string fashion. The central stroma is echogenic. Features are suggestive of Polycystic ovaries.", titleFragment: "polycystic ovaries", sortOrder: 2 },
  { region: "USG TVS", modality: "USG", label: "Fibroid uterus", concept: "uterus", text: "There is evidence of a well defined intramural lesion (measuring ___ x ___ cm) in the ___ uterine wall, suggestive of Fibroid.", titleFragment: "fibroid", sortOrder: 3 },
  { region: "USG TVS", modality: "USG", label: "Ovarian cyst", concept: "adnexa", text: "There is evidence of a well defined simple cyst (___ x ___ cm) arising from the ___ ovary. No internal echoes or septa.", titleFragment: "ovarian cyst", sortOrder: 4 },
  { region: "USG TVS", modality: "USG", label: "POD collection", concept: "pod", text: "Moderate collection with fine internal echoes is seen in the pouch of Douglas.", titleFragment: "pod collection", sortOrder: 5 },

  // ── USG Breast / Neck / Scrotum ─────────────────────────────────────────
  { region: "USG Breast", modality: "USG", label: "Fibroadenotic changes", concept: "tissue", text: "Fibro glandular tissue shows heterogeneous echotexture with multiple small hypoechoic areas and cystic changes, S/o Fibroadenotic changes.", titleFragment: "fibroadenotic changes", sortOrder: 1 },
  { region: "USG Breast", modality: "USG", label: "Fibroadenoma", concept: "lesion", text: "A well defined hypoechoic mobile mass (size ___ x ___ cm) with lobulated margin is seen in the ___ quadrant. Colour doppler shows mild internal vascularity.", titleFragment: "fibroadenoma", sortOrder: 2 },
  { region: "USG Neck", modality: "USG", label: "Thyroiditis", concept: "thyroid_rt", text: "Right lobe is enlarged in size and measures ___ cm in AP diameter. Parenchymal echogenicity is reduced with heterogeneous echotexture. Colour doppler shows increased blood flow.", titleFragment: "thyroiditis", sortOrder: 1 },
  { region: "USG Neck", modality: "USG", label: "MNG", concept: "thyroid_rt", text: "Right lobe is enlarged and shows multiple nodules of varying sizes with cystic degeneration and calcification.", titleFragment: "multinodular goitre", sortOrder: 2 },
  { region: "USG Neck", modality: "USG", label: "Colloid cyst", concept: "thyroid_rt", text: "A well defined anechoic cystic lesion (___ x ___ cm) with comet-tail artefacts is seen in the right lobe, S/o Colloid cyst.", titleFragment: "colloid cyst", sortOrder: 3 },
  { region: "USG Scrotum", modality: "USG", label: "Hydrocele", concept: "collection", text: "Moderate collection is seen in the ___ scrotal sac, S/o Hydrocele.", titleFragment: "hydrocele", sortOrder: 1 },
  { region: "USG Scrotum", modality: "USG", label: "Varicocele", concept: "inguinal", text: "___ pampiniform plexus of veins are dilated (largest ___ mm) with positive Valsalva test, S/o Varicocele.", titleFragment: "varicocele", sortOrder: 2 },
  { region: "USG Scrotum", modality: "USG", label: "Epididymo-orchitis", concept: "testis_lt", text: "Left testis is enlarged with decreased echogenicity. Head, body and tail of epididymis are enlarged, heterogeneous in echotexture. Colour doppler shows increased vascularity.", titleFragment: "epididymo-orchitis", sortOrder: 3 },

  // ── X-Ray Chest / Spine / KUB / PNS ──────────────────────────────────────
  { region: "X-Ray Chest", modality: "X-Ray", label: "Infiltrates", concept: "infiltrates", text: "Parenchymal infiltrates are seen in the ___ zone of the ___ lung field.", titleFragment: "parenchymal infiltrates", sortOrder: 1 },
  { region: "X-Ray Chest", modality: "X-Ray", label: "Patchy opacities", concept: "infiltrates", text: "Patchy parenchymal opacities are seen in the ___ zone of the ___ lung field, S/o pneumonitis.", titleFragment: "pneumonitis", sortOrder: 2 },
  { region: "X-Ray Chest", modality: "X-Ray", label: "Pleural effusion", concept: "effusion", text: "Homogeneous opacity in the ___ lower zone with obscuration of the ___ costo-phrenic angle and hemidiaphragm, S/o pleural effusion.", titleFragment: "pleural effusion", sortOrder: 3 },
  { region: "X-Ray Chest", modality: "X-Ray", label: "Cardiomegaly", concept: "ctr", text: "Increased cardio-thoracic ratio with ___ ventricular type of apex.", titleFragment: "cardiomegaly", sortOrder: 4 },
  { region: "X-Ray Spine", modality: "X-Ray", label: "Reduced disc space", concept: "disc", text: "Reduced ___ intervertebral disc space.", titleFragment: "reduced disc space", sortOrder: 1 },
  { region: "X-Ray Spine", modality: "X-Ray", label: "Osteophytes", concept: "osteophytes", text: "Degenerative changes as evident by osteophyte formation at ___ vertebral levels.", titleFragment: "degenerative changes", sortOrder: 2 },
  { region: "X-Ray Spine", modality: "X-Ray", label: "Anterolisthesis", concept: "listhesis", text: "Anterolisthesis of ___ over ___ vertebra.", titleFragment: "anterolisthesis", sortOrder: 3 },
  { region: "X-Ray Spine", modality: "X-Ray", label: "Wedge compression", concept: "wedge", text: "Anterior wedging of the ___ vertebral body.", titleFragment: "wedge compression", sortOrder: 4 },
  { region: "X-Ray Spine", modality: "X-Ray", label: "Sacroiliitis", concept: "sacroiliac", text: "Sclerosis at the articulating margins of bilateral sacroiliac joints with loss of joint space, S/o Bilateral sacroiliitis.", titleFragment: "bilateral sacroiliitis", sortOrder: 5 },
  { region: "X-Ray KUB", modality: "X-Ray", label: "Ureteric calculus", concept: "calculus", text: "A well defined oval radiopaque shadow overlying the ___ of the ___ vertebra, S/o Ureteric calculus.", titleFragment: "ureteric calculus", sortOrder: 1 },
  { region: "X-Ray PNS", modality: "X-Ray", label: "Maxillary sinusitis", concept: "maxillary", text: "Haziness is seen in the ___ maxillary sinus, S/o Sinusitis.", titleFragment: "sinusitis", sortOrder: 1 },
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
  { region: "CT Head", modality: "CT", text: "Serial transaxial scans were performed starting from the base of skull in the infratentorial and supratentorial compartment." },
  { region: "CT Head", modality: "CT", text: "NCCT followed by CECT of head by taking (5 x 5 mm) axial sections from the base of skull up to the vertex." },
  { region: "CT Spine", modality: "CT", text: "The lumbar spine was studied with 3 x 2 mm sections in helical mode taken from T12 to S1 vertebrae." },
  { region: "CT Spine", modality: "CT", text: "Non-contrast axial and sagittal reformatted CT of the spine with bone and soft tissue windows." },
  { region: "CT Chest", modality: "CT", text: "Plain and (non-ionic) contrast CT scan of thorax performed using 5 mm contiguous slices with thin coronal and sagittal 1.25 mm reformation images." },
  { region: "CT Abdomen", modality: "CT", text: "Contrast enhanced CT scan of whole abdomen performed (after introduction of oral and IV contrast to outline the gastrointestinal tract)." },
  { region: "CT PNS", modality: "CT", text: "NCCT PNS done by taking 5 x 5 mm coronal sections." },
  { region: "CT Orbit", modality: "CT", text: "Non-contrast axial and coronal CT of the orbits with soft tissue and bone window reconstruction." },
  { region: "CT Neck", modality: "CT", text: "3 mm sections were taken through the neck region in sequential mode after administration of IV contrast." },
  { region: "CT Temporal Bone", modality: "CT", text: "A plain high resolution spiral CT study of the temporal bones was performed in the axial and coronal planes." },
  { region: "CT Face", modality: "CT", text: "Non-contrast axial and coronal CT of the facial bones with 3D reconstruction." },

  // USG / X-ray (the doctor's own USG + X-ray libraries)
  { region: "USG Whole Abdomen", modality: "USG", text: "Ultrasonography of the whole abdomen was performed in supine position using a curvilinear 3.5 MHz transducer." },
  { region: "USG Whole Abdomen", modality: "USG", text: "Ultrasonography of the whole abdomen was performed on the GE Voluson Pro 4-D USG machine." },
  { region: "USG Pregnancy", modality: "USG", text: "Obstetric ultrasonography was performed using a curvilinear 3.5 MHz transducer." },
  { region: "USG Pregnancy", modality: "USG", text: "Transvaginal sonography was performed with an empty bladder using a 7.5 MHz endocavitary transducer." },
  { region: "USG TVS", modality: "USG", text: "Transvaginal sonography was performed with an empty bladder using a 7.5 MHz endocavitary transducer." },
  { region: "USG Breast", modality: "USG", text: "High frequency (7.5-12 MHz) linear transducer was used to scan both breasts." },
  { region: "USG Neck", modality: "USG", text: "High frequency (7.5-12 MHz) linear transducer was used to scan the neck." },
  { region: "USG Scrotum", modality: "USG", text: "High frequency (7.5-12 MHz) linear transducer with colour doppler was used to scan the scrotum." },
  { region: "USG Doppler", modality: "USG", text: "Bilateral lower limb venous doppler was performed with the patient supine, using a linear transducer with graded compression." },
  { region: "2D Echo", modality: "USG", text: "M-mode, 2D and colour doppler echocardiography was performed in left lateral decubitus position." },
  { region: "X-Ray Chest", modality: "X-Ray", text: "Standard postero-anterior radiograph of the chest was obtained in erect position." },
  { region: "X-Ray Chest", modality: "X-Ray", text: "Antero-posterior radiograph of the chest was obtained in erect position." },
  { region: "X-Ray Spine", modality: "X-Ray", text: "Antero-posterior and lateral radiographs of the spine were obtained." },
  { region: "X-Ray Abdomen", modality: "X-Ray", text: "Erect radiograph of the abdomen was obtained." },
  { region: "X-Ray KUB", modality: "X-Ray", text: "Supine radiograph of the kidney, ureter and bladder region was obtained." },
  { region: "X-Ray PNS", modality: "X-Ray", text: "Open-mouth Water's view radiograph of the paranasal sinuses was obtained." },
  { region: "X-Ray Bones", modality: "X-Ray", text: "Radiographs of the region were obtained in standard projections." },
  { region: "X-Ray IVU", modality: "X-Ray", text: "50 ml non-ionic contrast medium was injected intravenously and serial films were taken. No immediate complications seen." },
  { region: "X-Ray HSG", modality: "X-Ray", text: "Hysterosalpingography was done under full aseptic precautions. Approximately 12 ml of non-ionic contrast was injected through the cannula. The procedure was uneventful." },
  { region: "X-Ray MCU", modality: "X-Ray", text: "The MCU examination was done after injecting water-soluble contrast media into the urinary bladder (Urograffin-76%)." },
  { region: "X-Ray Barium", modality: "X-Ray", text: "Barium study was performed after oral/rectal administration of barium suspension with serial films." },
  { region: "X-Ray Fistulogram", modality: "X-Ray", text: "Water-soluble contrast was injected through the external opening of the sinus under aseptic precautions and films were taken." },
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

export const FORMAT_SEEDS: FormatSeed[] = [
  ...MR_BRAIN_FORMATS,
  ...MR_BRAIN_PATHOLOGY_FORMATS,
  ...MR_SPINE_FORMATS,
  ...MR_JOINT_FORMATS,
  ...MR_OTHER_FORMATS,
  // The doctor's own CT library — curated verbatim from
  // care-erp docs/report-formats/ct (brain, spine/MSK, body, head-neck)
  ...CT_BRAIN_FORMATS,
  ...CT_SPINE_FORMATS,
  ...CT_BODY_FORMATS,
  // The doctor's own USG + X-ray libraries — curated verbatim from
  // care-erp docs/report-formats/usg + xray (whole abdomen, obs-gyn,
  // small parts/vascular/echo, X-ray general + procedures)
  ...USG_ABDOMEN_FORMATS,
  ...USG_OBSGYN_FORMATS,
  ...USG_SMALLPARTS_FORMATS,
  ...XRAY_GENERAL_FORMATS,
  ...XRAY_PROCEDURES_FORMATS,
];
