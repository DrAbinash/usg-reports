/**
 * Other MRI complete-report formats — orbit, pituitary, mastoid,
 * brachial plexus and whole-body screening (doctor's library).
 */
import type { FormatSeed, FormatRowSeed } from "@/lib/seedData";

const o = (region: string) =>
  (concept: string, text: string, extra: Partial<FormatRowSeed> = {}): FormatRowSeed =>
    ({ region, concept, text, inImpression: false, ...extra });

const ORBIT = o("Orbit");
const BRAIN = o("Brain");
const MASTOID = o("Mastoid");
const PLEXUS = o("Brachial Plexus");
const WB = o("Whole Body Screening");

const NI = (region: string): FormatRowSeed => ({
  region, concept: "normal_impression", text: "Normal study.",
  inImpression: true, impressionOnly: true,
});

const IMP = (region: string, text: string): FormatRowSeed => ({
  region, concept: "impression_summary", text,
  inImpression: true, impressionOnly: true,
});

export const MR_OTHER_FORMATS: FormatSeed[] = [
  {
    key: "mr-orbit-normal", modality: "MR", region: "Orbit",
    name: "Normal", studyTitle: "MRI ORBITS", titleSuffix: "",
    technique: "MRI of the brain was performed using T1 and T2 weighted sequences in multiple planes. The orbits were subsequently scanned using high-resolution small FOV sequences.",
    recommendation: "Clinico-pathological correlation. Follow-up study if clinically indicated.",
    isNormal: true, sortOrder: 1,
    rows: [
      ORBIT("mass", "There is no evidence of any abnormal soft tissue intensity mass within the orbits."),
      ORBIT("globes", "The retrobulbar fat is normal. The globes on either side reveal normal signal intensity and appear unremarkable.", { newParagraph: true }),
      ORBIT("optic_nerves", "Both optic nerves are well visualized and reveal normal signal intensity. There is no compression or displacement.", { newParagraph: true }),
      ORBIT("bones_muscles", "The bony walls of the orbit are intact. Extraocular muscles are bilaterally symmetrical and appear normal in thickness and signal intensity.", { newParagraph: true }),
      ORBIT("vessels", "The superior ophthalmic veins are normal in course and calibre.", { newParagraph: true }),
      ORBIT("sella", "The sellar and juxtasellar structures appear normal.", { newParagraph: true }),
      NI("Orbit"),
    ],
  },
  {
    key: "mr-pituitary-macroadenoma", modality: "MR", region: "Brain",
    name: "Pituitary Macroadenoma", studyTitle: "MRI BRAIN (SELLAR SECTIONS)",
    titleSuffix: "pituitary macroadenoma",
    technique: "Multiplanar, multisequence MRI of the brain was performed. Dedicated high-resolution thin-section sagittal and coronal imaging of the sella was obtained.",
    recommendation: "Dedicated dynamic contrast-enhanced MRI pituitary protocol for definitive characterization. Endocrinological correlation (prolactin, IGF-1, cortisol). Ophthalmologic evaluation including formal visual field testing.",
    isNormal: false, sortOrder: 26,
    rows: [
      BRAIN("sella_mass", "Sellar and parasellar region — there is a well-circumscribed, solid mass within the sella turcica measuring approximately 12.7 x 10.8 mm. The lesion is T1 hypointense, T2 hyperintense and FLAIR hypointense relative to the adjacent brain parenchyma. There is mild expansion and remodeling of the sella turcica. Normal adenohypophyseal tissue is not clearly delineated from the mass. The posterior pituitary bright spot is not confidently identified.", { inImpression: true }),
      BRAIN("mass_effect", "Mass effect and extension — mild suprasellar extension is noted. The optic chiasm is maintained in its expected position with no evidence of compression, elevation or signal abnormality. The suprasellar cistern remains patent. The pituitary stalk is mildly deviated due to mass effect. The cavernous sinuses appear symmetric with no convincing evidence of cavernous sinus invasion or encasement of the cavernous ICA segments. Flow voids of the internal carotid arteries are preserved.", { newParagraph: true }),
      BRAIN("parenchyma", "Brain parenchyma and extra-axial spaces — no focal intra-axial mass lesions, areas of restricted diffusion or acute intracranial hemorrhages. Gray-white matter differentiation is preserved. The ventricles and sulci are normal in size and configuration. No midline shift or evidence of obstructive hydrocephalus. The brainstem and cerebellum are unremarkable. The craniovertebral junction is intact. Basal cisterns are patent.", { newParagraph: true }),
      IMP("Brain", "Pituitary macroadenoma measuring approximately 12.7 x 10.8 mm with mild suprasellar extension and remodeling of the sella turcica. No evidence of optic chiasm compression on the current study. No definitive cavernous sinus invasion identified."),
    ],
  },
  {
    key: "mr-mastoid-normal", modality: "MR", region: "Mastoid",
    name: "Normal", studyTitle: "MRI MASTOID", titleSuffix: "",
    technique: "Multiplanar, multisequence MRI of the temporal bones and mastoid regions was performed using T1-weighted, T2-weighted and post-contrast sequences in axial, coronal and sagittal planes. Protocol: axial T1, T2, FLAIR; sagittal T1; coronal T2.",
    recommendation: "Clinico-pathological correlation.",
    isNormal: true, sortOrder: 1,
    rows: [
      MASTOID("mastoid_cells", "Mastoid air cells are well-aerated bilaterally. No evidence of fluid, mucosal thickening or opacification. Cortical margins intact. No erosions."),
      MASTOID("middle_ear", "Middle ear cavity shows normal aeration. Ossicular chain intact and normally aligned. No soft tissue mass or abnormal enhancement.", { newParagraph: true }),
      MASTOID("inner_ear", "Cochlea, vestibule and semicircular canals appear normal in morphology and signal intensity. No abnormal enhancement.", { newParagraph: true }),
      MASTOID("facial_nerve", "Facial nerve canal shows normal course and calibre. No abnormal signal or enhancement.", { newParagraph: true }),
      MASTOID("adjacent", "No abnormal mass, collection or edema in the adjacent soft tissues and skull base. Jugular bulb, sigmoid sinus and adjacent vascular structures are normal in flow voids and calibre.", { newParagraph: true }),
      MASTOID("brain_screen", "No abnormality detected in the screened portions of the brain parenchyma or CPA cisterns.", { newParagraph: true }),
      IMP("Mastoid", "Normal MRI of the mastoid region. Well-aerated mastoid air cells with no evidence of mastoiditis, cholesteatoma or other pathology."),
    ],
  },
  {
    key: "mr-brachial-plexus-avulsion", modality: "MR", region: "Brachial Plexus",
    name: "Root Avulsion (Trauma)", studyTitle: "MRI BRACHIAL PLEXUS",
    titleSuffix: "brachial plexus avulsion",
    technique: "Multiplanar MRI of the brachial plexus was performed using T1, T2 and STIR sequences.",
    recommendation: "Please correlate clinically and with related investigations.",
    isNormal: false, sortOrder: 1,
    rows: [
      PLEXUS("avulsion", "There is evidence of avulsion of exiting nerve roots with pseudomeningocele formation in right-sided C5-6 and C6-7 neural foramina — likely traumatic.", { inImpression: true }),
      PLEXUS("trunks", "The trunks and cords of the opposite side are fairly defined and appear normal.", { newParagraph: true }),
      PLEXUS("vertebrae", "The vertebral bodies are normal in size, shape, height and signal intensity.", { newParagraph: true }),
      PLEXUS("cord", "Cervical cord appears normal. No intraspinal mass is seen. No pre- or paravertebral collection seen.", { newParagraph: true }),
    ],
  },
  {
    key: "mr-whole-body-screening", modality: "MR", region: "Whole Body Screening",
    name: "Screening — Normal", studyTitle: "MRI WHOLE BODY SCREENING", titleSuffix: "",
    technique: "Non-contrast screening of brain, cervical spine, dorsal spine, lumbar spine and chest has been done.",
    recommendation: "Clinico-pathological correlation.",
    isNormal: true, sortOrder: 1,
    rows: [
      WB("brain", "BRAIN — both cerebral hemispheres show normal MR morphology, signal intensity and gray-white matter differentiation. The basal nuclei, thalami and corpus callosum show normal signal intensity pattern. Lateral and third ventricles are normal in size, shape and outline. Septum pellucidum and falx cerebri are in midline. No mass effect or midline shift. Brainstem and cerebellar hemispheres show normal morphology, signal intensity and outline. Fourth ventricle is normal in size and midline in position. Major intracranial dural venous sinuses show normal outline and flow void. Sella, supra-sellar and para-sellar structures are normally visualized. Region of bilateral internal acoustic meatus and cerebellopontine angle are normal."),
      WB("spine", "CERVICAL, DORSAL & LUMBAR SPINE — vertebrae show normal size, signal intensity and alignment. Intervertebral discs are normal in height and signal intensity. Neuroforamina are normal. Facet joints and ligamentum flavum are normal. Paraspinal structures are normal in size and shape with normal signal intensity. The vascular structures appear normal.", { newParagraph: true }),
      WB("chest", "CHEST — normal parenchymal signal intensity and bronchovascular distribution in both lungs. No focal parenchymal lesion. Trachea is central with normal bifurcation at carina. Major bronchi are normal in calibre. Arch of aorta and great vessels are normal. Cardiac chambers are normal. No pericardial effusion. No free or encysted pleural collection. Mediastinal and hilar fat planes are maintained with no significant lymphadenopathy. Pleura is not thickened.", { newParagraph: true }),
      IMP("Whole Body Screening", "Screening of whole body MRI doesn't reveal any significant abnormality."),
    ],
  },
];
