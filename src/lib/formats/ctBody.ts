/**
 * CT Body / Head-Neck complete-report formats — curated verbatim from the
 * doctor's own CT report library (care-erp docs/report-formats/ct):
 * chest, abdomen, PNS, orbit, neck, temporal bone, face.
 */
import type { FormatSeed, FormatRowSeed } from "@/lib/seedData";

const REC = "Clinico-pathological correlation. Not for medico-legal purpose.";

const row = (region: string) => (
  concept: string,
  text: string,
  extra: Partial<FormatRowSeed> = {},
): FormatRowSeed => ({ region, concept, text, inImpression: false, ...extra });

const NI = (region: string, text = "No significant abnormality seen."): FormatRowSeed => ({
  region, concept: "normal_impression", text,
  inImpression: true, impressionOnly: true,
});

const C = row("CT Chest");
const A = row("CT Abdomen");
const P = row("CT PNS");
const O = row("CT Orbit");
const N = row("CT Neck");
const TB = row("CT Temporal Bone");
const F = row("CT Face");

export const CT_BODY_FORMATS: FormatSeed[] = [
  // ── CT CHEST ──────────────────────────────────────────────────────────────
  {
    key: "ct-chest-normal", modality: "CT", region: "CT Chest",
    name: "Normal", studyTitle: "CT CHEST", titleSuffix: "",
    technique: "Plain and (non-ionic) contrast CT scan of thorax performed using 5 mm contiguous slices with thin coronal and sagittal 1.25 mm reformation images. Digital scanogram taken in supine and frontal projection.",
    recommendation: REC, isNormal: true, sortOrder: 1,
    rows: [
      C("lung", "Both lungs are normal in attenuation. No mass lesion or ground glass attenuation is seen."),
      C("mediastinum", "The mediastinum is central. Heart and great vessels of the mediastinum are grossly normal. The trachea and bronchi are normal. No enlarged mediastinal or hilar lymphadenopathy is seen."),
      C("pleura", "The pleura are normal on either side. No evidence of pleural effusion, thickening or calcification is seen."),
      C("chest_wall", "The bones under review are normal. The muscles and soft tissue of the thoracic wall under review are unremarkable."),
      NI("CT Chest", "CT scan of chest shows no significant abnormality."),
    ],
  },
  {
    key: "ct-chest-kochs", modality: "CT", region: "CT Chest",
    name: "Koch's — Consolidation + Fibrosis", studyTitle: "CECT CHEST",
    titleSuffix: "pulmonary koch's",
    technique: "NCCT followed by CECT of the chest done by taking 7 x 7 mm axial sections from the level of thoracic inlet up to the upper abdomen.",
    recommendation: "Clinical and lab correlation. Not for medico-legal purpose.", isNormal: false, sortOrder: 2,
    rows: [
      C("consolidation", "Inhomogeneous non-enhancing air-space consolidation seen in apical segment of right upper lobe — ? pneumonitis (possibly of tuberculous etiology).", { inImpression: true }),
      C("fibrosis", "Small fibrotic densities are seen in the rest of the right upper lobe — old healed Koch's lesions.", { inImpression: true }),
      C("lung", "The rest of the lungs show no significant abnormality. No mass lesion / ground glass attenuations are seen."),
      C("effusion", "Mild pleural effusion seen on right side.", { inImpression: true }),
      C("mediastinum", "The mediastinal structures in view show no significant abnormality. No significant mediastinal or hilar lymphadenopathy seen. No mediastinal mass or collection noted."),
      C("upper_abd", "Upper abdomen in view appears unremarkable.", { newParagraph: true }),
    ],
  },
  {
    key: "ct-chest-pleural-effusion", modality: "CT", region: "CT Chest",
    name: "Pleural Effusion", studyTitle: "CT CHEST",
    titleSuffix: "pleural effusion",
    technique: "Plain and contrast CT scan of thorax performed using contiguous axial slices with coronal and sagittal reformation images.",
    recommendation: REC, isNormal: false, sortOrder: 3,
    rows: [
      C("effusion", "Gross pleural effusion seen on the right side with passive atelectasis of the underlying lung.", { inImpression: true }),
      C("lung", "The rest of the lungs show no significant abnormality. No mass lesion is seen."),
      C("mediastinum", "The mediastinum is central. Heart and great vessels are grossly normal. No enlarged mediastinal or hilar lymphadenopathy is seen."),
      C("chest_wall", "The bones under review are normal."),
    ],
  },
  {
    key: "ct-chest-ca-lung", modality: "CT", region: "CT Chest",
    name: "Ca Lung — Mass + Nodes", studyTitle: "CECT CHEST",
    titleSuffix: "lung mass with lymphadenopathy",
    technique: "NCCT followed by CECT of the chest done by taking contiguous axial sections from the level of thoracic inlet up to the upper abdomen.",
    recommendation: "Kindly correlate with clinical findings.", isNormal: false, sortOrder: 4,
    rows: [
      C("mass", "There is evidence of wedge shape soft tissue density area (HU 18-43) noted involving apical and posterior segments of right upper lobe and medial segment of right middle lobe. Few air bronchograms are noted along the margins. No cavitation / calcification seen.", { inImpression: true }),
      C("nodules", "Multiple tiny air space nodules are noted in right lung in peri-bronchovascular region.", { inImpression: true }),
      C("pericardium", "There is evidence of gross pericardial effusion seen. No evidence of pericardial thickening is noted.", { inImpression: true }),
      C("nodes", "There are multiple enlarged lymphnodes seen at bilateral supra-clavicular and pretracheal stations.", { inImpression: true }),
      C("airway", "The trachea and main bronchi are central and normal. There is no hilar lymphadenopathy seen."),
      C("pleura", "There is no pleural effusion seen on either side."),
      C("mediastinum", "The cardiac chambers and rest of the mediastinal structures including the oesophagus are normal."),
    ],
  },

  // ── CT ABDOMEN ────────────────────────────────────────────────────────────
  {
    key: "ct-whole-abd-male-normal", modality: "CT", region: "CT Abdomen",
    name: "Normal (Whole Abdomen — Male)", studyTitle: "CECT WHOLE ABDOMEN", titleSuffix: "",
    technique: "Contrast enhanced CT scan of whole abdomen performed (after introduction of oral and IV contrast to outline the gastrointestinal tract).",
    recommendation: "Please correlate clinically. Not for medico-legal purpose.", isNormal: true, sortOrder: 1,
    rows: [
      A("liver", "Liver shows normal shape, size, attenuation pattern and contrast enhancement with smooth outline. Intrahepatic biliary radicles are not dilated. No intrahepatic SOL noted."),
      A("gallbladder", "Gall bladder is normal in shape, size and outline, attenuation pattern and contrast enhancement. No obvious intraluminal calculi or SOL noted."),
      A("cbd", "CBD is not dilated."),
      A("pancreas", "Pancreas is normal in shape, size, attenuation pattern and contrast enhancement. No focal parenchymal abnormal enhancement noted. No parenchymal cyst formation or calcification noted. Pancreatic duct is normal."),
      A("spleen", "Spleen is normal in shape, size, attenuation and contrast enhancement with smooth outline."),
      A("adrenals", "Suprarenal glands appear normal on both sides."),
      A("peritoneum", "Peritoneum and pleural spaces: no evidence of collection of fluid noted."),
      A("kidneys", "Both kidneys showing normal morphology and excretion of contrast. No evidence of calculi, SOL or hydronephrotic changes noted."),
      A("ureters", "Ureters are not dilated. No calculi seen."),
      A("bladder", "Urinary bladder shows no evidence of calculi or SOL noted. The bladder wall is normal."),
      A("aorta_ivc", "Aorta and IVC are normal."),
      A("stomach_duodenum", "Stomach and duodenum are normal in position. No SOL noted."),
      A("bowel", "Small and large intestine show no evidence of SOL or obstruction noted. Ileo-caecal region shows no evidence of stricture or SOL noted. Appendix appears to be normal."),
      A("retroperitoneum", "No enlarged retroperitoneal lymph node noted."),
      A("prostate", "Prostate is normal in size, shape and attenuation. No evidence of enlargement or SOL noted. Seminal vesicles appear to be normal."),
      NI("CT Abdomen", "The CT scan of whole abdomen shows no significant abnormality."),
    ],
  },
  {
    key: "ct-whole-abd-female-normal", modality: "CT", region: "CT Abdomen",
    name: "Normal (Whole Abdomen — Female)", studyTitle: "CECT WHOLE ABDOMEN", titleSuffix: "",
    technique: "Oral and IV contrast enhanced CT scan of whole abdomen performed.",
    recommendation: "Please correlate clinically. Not for medico-legal purpose.", isNormal: true, sortOrder: 2,
    rows: [
      A("liver", "Liver shows normal shape, size, attenuation pattern and contrast enhancement with smooth outline. Intrahepatic biliary radicles are not dilated. No intrahepatic SOL noted."),
      A("gallbladder", "Gall bladder is normal in shape, size and outline, attenuation pattern and contrast enhancement. No obvious intraluminal calculi or SOL noted."),
      A("cbd", "CBD is not dilated."),
      A("pancreas", "Pancreas is normal in shape, size, attenuation pattern and contrast enhancement. No focal parenchymal abnormal enhancement noted. No parenchymal cyst formation or calcification noted. Pancreatic duct is normal."),
      A("spleen", "Spleen is normal in shape, size, attenuation and contrast enhancement with smooth outline."),
      A("adrenals", "Suprarenal glands appear normal on both sides."),
      A("peritoneum", "Peritoneum and pleural spaces: no collection."),
      A("kidneys", "Both kidneys showing normal morphology and excretion of contrast. No evidence of calculi, SOL or hydronephrotic changes noted."),
      A("ureters", "Ureters are not dilated. No calculi seen."),
      A("bladder", "Urinary bladder is normal."),
      A("aorta_ivc", "Aorta and IVC are normal."),
      A("bowel", "Stomach and duodenum are normal in position. Small and large intestine show no evidence of SOL or obstruction noted. Ileo-caecal region shows no evidence of stricture or SOL noted."),
      A("retroperitoneum", "No enlarged retroperitoneal lymph node noted."),
      A("uterus", "Uterus is normal in size and shape and texture."),
      A("adnexa", "Adnexa are normal in size and shape and texture."),
      NI("CT Abdomen", "The CT scan of whole abdomen shows no significant abnormality."),
    ],
  },
  {
    key: "ct-abd-acute-pancreatitis", modality: "CT", region: "CT Abdomen",
    name: "Acute Pancreatitis", studyTitle: "CECT UPPER ABDOMEN",
    titleSuffix: "acute pancreatitis",
    technique: "NCCT abdomen with oral contrast followed by CECT with oral and IV contrast done by taking 7 x 7 mm axial sections from dome of the diaphragm up to the iliac crest.",
    recommendation: "Please correlate clinically.", isNormal: false, sortOrder: 3,
    rows: [
      A("pancreatitis", "Bulky head of pancreas with focal hypodense area. Mild peripancreatic collection and fat stranding adjacent to the head of pancreas. No focal SOL or calcification seen. Main pancreatic duct not dilated.", { inImpression: true }),
      A("liver", "Liver mildly enlarged. Normal in shape, attenuation and enhancement. No focal SOL or calcification seen. Hepatic veins and portal veins are normal. IHBR not dilated."),
      A("gallbladder", "Distended. Wall thickness is normal. Mild non enhancing sludge at GB neck."),
      A("cbd", "Normal in course and caliber. Lumen is clear."),
      A("spleen", "Normal in shape, size, position, attenuation and enhancement. No focal SOL seen. Splenic vein is normal."),
      A("kidneys", "Both kidneys normal in position, shape, size, outline, attenuation and enhancement. No focal SOL seen. Pelvicalyceal system not dilated. No calculus seen."),
      A("adrenals", "Both adrenal glands are normal."),
      A("bladder", "Normal in outline and wall thickness. Lumen is clear."),
      A("peritoneum", "No evidence of free fluid in the abdominal cavity."),
      A("nodes", "No evidence of enlarged intra-abdominal lymph nodes."),
      A("vessels", "Great vessels of abdomen are normal."),
      A("bowel", "Visualized opacified bowel loops are normal."),
    ],
  },
  {
    key: "ct-abd-chronic-pancreatitis", modality: "CT", region: "CT Abdomen",
    name: "Chronic Pancreatitis", studyTitle: "CECT UPPER ABDOMEN",
    titleSuffix: "chronic pancreatitis",
    technique: "NCCT abdomen with oral contrast followed by CECT with oral and IV contrast done by taking 7 x 7 mm axial sections from dome of the diaphragm up to the iliac crest.",
    recommendation: "Please correlate clinically.", isNormal: false, sortOrder: 4,
    rows: [
      A("pancreatitis", "CT scan through the pancreas shows granular calcification in the pancreas, and foci of coarse calcification at the head of pancreas. No peripancreatic collection or fat stranding adjacent to the head of pancreas. Main pancreatic duct is mildly dilated.", { inImpression: true }),
      A("liver", "Liver normal in size, shape, attenuation and enhancement. No focal SOL or calcification seen. Hepatic veins and portal veins are normal. IHBR not dilated."),
      A("gallbladder", "Normal in physiological distension. Wall thickness is normal."),
      A("cbd", "Normal in course and caliber. Lumen is clear."),
      A("spleen", "Normal in shape, size, position, attenuation and enhancement. No focal SOL seen. Splenic vein is normal."),
      A("kidneys", "Both kidneys normal in position, shape, size, outline, attenuation and enhancement. No focal SOL seen. Pelvicalyceal system not dilated."),
      A("adrenals", "Both adrenal glands are normal."),
      A("bladder", "Normal in outline and wall thickness. Lumen is clear."),
      A("peritoneum", "No evidence of free fluid in the abdominal cavity."),
      A("nodes", "No evidence of enlarged intra-abdominal lymph nodes."),
      A("bowel", "Visualized opacified bowel loops are normal."),
    ],
  },
  {
    key: "ct-abd-acute-appendicitis", modality: "CT", region: "CT Abdomen",
    name: "Acute Appendicitis", studyTitle: "CECT WHOLE ABDOMEN",
    titleSuffix: "acute appendicitis",
    technique: "Contrast enhanced CT scan of whole abdomen performed (after introduction of oral and IV contrast to outline the gastrointestinal tract).",
    recommendation: "Please correlate clinically.", isNormal: false, sortOrder: 5,
    rows: [
      A("appendicitis", "There is evidence of thickening of the appendiceal wall with oral contrast in the lumen and periappendiceal fat stranding. The appendix measures 1.2 cm in diameter wall to wall. There is evidence of reactionary sub-centimeter lymph nodes and thickening of the caecal wall at the appendiceal attachment. There is evidence of some extraluminal air — suspicious of a perforated appendix.", { inImpression: true }),
      A("liver", "Liver shows normal shape, size, attenuation pattern and contrast enhancement with smooth outline. Intrahepatic biliary radicles are not dilated. No intrahepatic SOL noted."),
      A("gallbladder", "Gall bladder is normal in shape, size and outline, attenuation pattern and contrast enhancement."),
      A("cbd", "Not dilated."),
      A("pancreas", "Pancreas is normal in shape, size, attenuation pattern and contrast enhancement."),
      A("spleen", "Spleen is normal in shape, size, attenuation and contrast enhancement with smooth outline."),
      A("kidneys", "Both kidneys showing normal morphology and excretion of contrast. No evidence of calculi, SOL or hydronephrotic changes noted."),
      A("bowel", "Small and large intestine show no evidence of SOL or obstruction noted."),
    ],
  },

  // ── CT PNS ────────────────────────────────────────────────────────────────
  {
    key: "ct-pns-normal", modality: "CT", region: "CT PNS",
    name: "Normal", studyTitle: "NCCT PNS", titleSuffix: "",
    technique: "NCCT PNS done by taking 5 x 5 mm coronal sections.",
    recommendation: REC, isNormal: true, sortOrder: 1,
    rows: [
      P("sinuses", "Visualized paranasal sinuses are clear."),
      P("omc", "Bilateral osteomeatal complexes (OMC) are normal."),
      P("turbinates", "Nasal turbinates are normal."),
      P("septum", "Nasal septum is central."),
      P("bone", "No evidence of bony erosion."),
      P("orbit", "Visualized bilateral orbits and contents are normal."),
      P("pharynx", "Visualized nasopharynx and oropharynx are normal."),
      P("brain", "Visualized brain parenchyma is normal."),
      NI("CT PNS", "Normal scan."),
    ],
  },
  {
    key: "ct-pns-polyposis", modality: "CT", region: "CT PNS",
    name: "Sinonasal Polyposis", studyTitle: "CECT PNS",
    titleSuffix: "sinonasal polyposis",
    technique: "Contrast enhanced CT scan of PNS performed in axial and coronal planes.",
    recommendation: "Histopathological correlation. Not for medico-legal purpose.", isNormal: false, sortOrder: 2,
    rows: [
      P("polyps", "Soft tissue density mass lesion involving left maxillary, ethmoid and frontal sinus, sphenoid sinus and nasal cavity extending through osteomeatal complex on left. There is linear calcification in nasal cavity on left side within the lesion. No evidence of bone erosion or destruction. It is showing marginal post contrast enhancement.", { inImpression: true }),
      P("sinuses", "Otherwise normal pneumatization of paranasal sinuses."),
      P("bone", "Bony walls of maxillary, ethmoid, sphenoid and frontal sinuses are intact and do not show any lytic or sclerotic lesion."),
      P("omc", "Right osteomeatal unit appears normal."),
      P("turbinates", "The nasal turbinates show normal configuration."),
      P("septum", "The nasal septum is more or less in midline. Both pterygoid plates and pterygoid fossa are normal."),
      P("tmj", "Both TM joints are normal.", { newParagraph: true }),
    ],
  },
  {
    key: "ct-pns-fungal", modality: "CT", region: "CT PNS",
    name: "Sinusitis ? Fungal", studyTitle: "CT PNS WITH CONTRAST",
    titleSuffix: "sinusitis ? fungal infection",
    technique: "Plain and contrast enhanced CT scan of PNS performed in axial and coronal planes.",
    recommendation: "Follow-up and histopathological correlation to rule out neoplastic lesion. Not for medico-legal purpose.", isNormal: false, sortOrder: 3,
    rows: [
      P("septum", "Mild deviation of nasal septum to left side.", { inImpression: true }),
      P("sinusitis", "Mucosal thickening / collection noted in right maxillary sinus with calcification and minimal enhancement in medial aspect, extending through the ostium in nasal cavity — likely sinonasal polyposis with secondary fungal infection.", { inImpression: true }),
      P("sinuses", "Left maxillary sinus is normal. Mucosal thickening noted in bilateral frontal sinus and ethmoid air cells."),
      P("omc", "Bilateral infundibula and osteomeatal complexes are normal."),
      P("sphenoid", "Bilateral sphenoid sinuses show normal pneumatization."),
      P("nasal_fossae", "Both nasal fossae and nasal turbinates appear normal."),
    ],
  },

  // ── CT ORBIT ──────────────────────────────────────────────────────────────
  {
    key: "ct-orbit-normal", modality: "CT", region: "CT Orbit",
    name: "Normal", studyTitle: "NCCT ORBIT", titleSuffix: "",
    technique: "Non-contrast axial and coronal CT of the orbits with soft tissue and bone window reconstruction.",
    recommendation: REC, isNormal: true, sortOrder: 1,
    rows: [
      O("globes", "The globes are normal in size and shape. No intra-ocular mass or calcification seen. No evidence of proptosis noted."),
      O("bony_orbit", "The bony orbit is normal."),
      O("compartments", "The intraconal, extraconal and preseptal compartments are normal. The extra-ocular muscles are normal in thickness and attenuation."),
      O("optic_nerve", "The retro-ocular fat planes are normal in course, calibre and attenuation. The optic nerve is within normal limits."),
      O("lacrimal", "Both lacrimal glands are normal."),
      O("septum", "Bony septum lies in the midline."),
      O("brain", "Brain window is within normal limits."),
      NI("CT Orbit", "No significant abnormality seen in CT scan of orbit."),
    ],
  },

  // ── CT NECK ───────────────────────────────────────────────────────────────
  {
    key: "ct-neck-normal", modality: "CT", region: "CT Neck",
    name: "Normal", studyTitle: "CECT NECK", titleSuffix: "",
    technique: "3 mm sections were taken through the neck region in sequential mode after administration of IV contrast.",
    recommendation: "Clinical correlation.", isNormal: true, sortOrder: 1,
    rows: [
      N("thyroid", "The density of both thyroid lobes is equal and normal."),
      N("carotid", "The carotid sheaths on both sides of the neck are unremarkable."),
      N("airway", "The larynx, upper trachea, and laryngopharynx are normal."),
      N("soft_tissue", "No definite abnormal soft tissue or vascular anomaly is identified."),
      N("nodes", "No abnormal cervical lymphadenopathy seen."),
      N("bone", "There is no bony abnormality or erosion seen."),
      NI("CT Neck"),
    ],
  },
  {
    key: "ct-neck-mng", modality: "CT", region: "CT Neck",
    name: "Multinodular Goiter", studyTitle: "CECT NECK",
    titleSuffix: "multinodular goiter",
    technique: "3 mm sections were taken through the neck region in sequential mode after administration of IV contrast.",
    recommendation: "Clinical correlation.", isNormal: false, sortOrder: 2,
    rows: [
      N("thyroid", "Both lobes of thyroid appear bulky and show heterogeneous density with few hypodense areas within. Few calcific areas are seen within. The right lobe of thyroid measures 5 x 4.3 cm and left lobe of thyroid measures 4.3 x 4.6 cm.", { inImpression: true }),
      N("carotid", "The carotid sheaths on both sides of the neck are unremarkable."),
      N("airway", "The larynx, upper trachea, and laryngopharynx are normal."),
      N("soft_tissue", "No definite vascular anomaly is identified."),
      N("nodes", "No abnormal cervical lymphadenopathy seen."),
      N("bone", "There is no bony abnormality or erosion seen."),
    ],
  },
  {
    key: "ct-neck-tb-nodes", modality: "CT", region: "CT Neck",
    name: "Lymphadenopathy ? TB", studyTitle: "CECT NECK",
    titleSuffix: "cervical lymphadenopathy",
    technique: "Plain and contrast CT scan of neck was performed taking 5 mm sections in axial planes.",
    recommendation: "FNAC suggested to rule out tubercular lymphadenopathy. Clinical correlation.", isNormal: false, sortOrder: 3,
    rows: [
      N("nodes", "Multiple enlarged bilateral submandibular, submental, parotid and cervical lymphnodes noted in bilateral levels II, III and IV (largest measuring 2.0 x 1.8 cm in left submandibular region) with heterogeneous enhancement.", { inImpression: true }),
      N("salivary", "Both the parotid and submandibular glands are normal in size, shape, position and contour."),
      N("airway", "The glottis, epiglottis, valleculae, pyriform sinuses and vocal cords are normal."),
      N("carotid", "The carotid space and posterior triangle are clear."),
      N("spaces", "The visualized prepharyngeal and parapharyngeal spaces appear normal. The fat planes are well demarcated."),
      N("sinuses", "Visualized paranasal sinuses are normal."),
      N("thyroid", "The thyroid gland is normal."),
      N("airway2", "The visualized trachea and oesophagus do not reveal any abnormality."),
    ],
  },

  // ── CT TEMPORAL BONE ──────────────────────────────────────────────────────
  {
    key: "ct-csom-mastoiditis", modality: "CT", region: "CT Temporal Bone",
    name: "CSOM — Mastoiditis", studyTitle: "CT BOTH TEMPORAL BONES",
    titleSuffix: "csom with mastoiditis",
    technique: "A plain high resolution spiral CT study of the temporal bones was performed in the axial and coronal planes. Images are documented at soft and bony window settings.",
    recommendation: "Please correlate clinically. Not for medico-legal purpose.", isNormal: false, sortOrder: 1,
    rows: [
      TB("csom", "There is soft tissue and fluid within the left mastoid air cells. There is evidence of fluid seen in the left mastoid air cells as well as soft tissue seen in the left middle ear cavity. No erosion of the roof of the middle ear cavity or the ossicles.", { inImpression: true }),
      TB("right_ear", "The right mastoid air cells reveal no abnormality. No bony erosion or abnormal soft tissue is seen. No soft tissue is seen in the right middle ear cavity."),
      TB("iam", "The internal auditory meati reveal no abnormality."),
      TB("inner_ear", "No evidence of involvement of the inner ear or erosion of the ossicles or the roof of the left middle ear cavity."),
    ],
  },

  // ── CT FACE ───────────────────────────────────────────────────────────────
  {
    key: "ct-face-normal", modality: "CT", region: "CT Face",
    name: "Normal", studyTitle: "CT FACE", titleSuffix: "",
    technique: "Non-contrast axial and coronal CT of the facial bones with 3D reconstruction.",
    recommendation: REC, isNormal: true, sortOrder: 1,
    rows: [
      F("bones", "Facial bones are normal. No evidence of fracture."),
      F("sinuses", "Visualized paranasal sinuses are well-aerated. No evidence of abnormal air-fluid levels."),
      F("mastoid", "Bilateral mastoids also appear unremarkable."),
      F("globes", "Both globes, extra-ocular muscles, optic nerves and retrobulbar fat appear normal."),
      F("tmj", "Bilateral temporomandibular joints appear normal."),
      NI("CT Face", "No significant abnormality detected."),
    ],
  },
  {
    key: "ct-face-zygomatic-fracture", modality: "CT", region: "CT Face",
    name: "Zygomatic Complex Fracture", studyTitle: "CT FACE",
    titleSuffix: "zygomatic complex fracture",
    technique: "Non-contrast axial and coronal CT of the facial bones with 3D reconstruction.",
    recommendation: REC, isNormal: false, sortOrder: 2,
    rows: [
      F("fracture", "Undisplaced fracture of the right zygomatic bone including the inferior orbital wall with small part of inferior rectus muscle herniated into right antrum; fracture of right lateral orbital wall at the zygomatico-sphenoid suture. Fracture of the right maxillary wall including the posterior wall of maxillary sinus with mild haemosinus.", { inImpression: true }),
      F("sinuses", "Rest of the visualized paranasal sinuses are well-aerated."),
      F("septum", "Nasal septum is mildly deviated towards left."),
      F("mastoid", "Bilateral mastoids also appear unremarkable."),
      F("globes", "Both globes, optic nerves and retrobulbar fat appear normal."),
      F("tmj", "Bilateral temporomandibular joints appear normal."),
    ],
  },
];
