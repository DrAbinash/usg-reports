/**
 * MRI Brain complete-report formats — curated from the doctor's own
 * report library (docs/mri-report-formats). Language kept verbatim
 * (typos normalized); every row occupies a semantic slot so later
 * phrase additions replace, never duplicate.
 */
import type { FormatSeed, FormatRowSeed } from "@/lib/seedData";

const T = {
  plain: "MRI brain performed using standard sequences: axial T1, T2, FLAIR, DWI, ADC and SWI. Images acquired on 3 Tesla scanner.",
  ce: "MRI brain performed on 3 Tesla scanner with standard multiplanar sequences before and after intravenous contrast.",
  epilepsy: "MRI brain with epilepsy protocol. Special oblique coronal, T1 inversion recovery (IR) and FLAIR oblique sequences obtained.",
  generic: "Multiplanar, multisequence MRI of the brain was performed.",
};

const R = (
  concept: string,
  text: string,
  extra: Partial<FormatRowSeed> = {},
): FormatRowSeed => ({ region: "Brain", concept, text, inImpression: false, ...extra });

/** Normal-impression line — auto-yields when a real finding enters the impression. */
const NI = (): FormatRowSeed => ({
  region: "Brain", concept: "normal_impression", text: "Normal study.",
  inImpression: true, impressionOnly: true,
});

export const MR_BRAIN_FORMATS: FormatSeed[] = [
  {
    key: "mr-brain-normal", modality: "MR", region: "Brain",
    name: "Normal (3T)", studyTitle: "MRI BRAIN", titleSuffix: "",
    technique: T.plain,
    recommendation: "Clinico-pathological correlation. Follow-up study with contrast if clinically indicated.",
    isNormal: true, sortOrder: 1,
    rows: [
      R("parenchyma", "Both cerebral hemispheres show normal MR morphology, signal intensity and gray-white matter differentiation. The basal nuclei, thalami and corpus callosum are showing normal signal intensity pattern."),
      R("ventricles", "Septum pellucidum and falx cerebri are in midline. No mass effect or midline shift is seen. Ventricular system & supratentorial sulcal and cisternal spaces are normal.", { newParagraph: true }),
      R("posterior_fossa", "Brainstem and cerebellar hemispheres are showing normal morphology, signal intensity and outline. Fourth ventricle is normal in size and midline in position.", { newParagraph: true }),
      R("signal", "No focal or diffuse area of altered signal intensity is seen. No obvious intra / extra-axial space-occupying lesion is observed.", { newParagraph: true }),
      R("vessels", "Major intracranial dural venous sinuses are showing normal outline and flow void.", { newParagraph: true }),
      R("sella", "Sella, supra-sellar and para-sellar structures are normally visualized.", { newParagraph: true }),
      R("cpa", "Region of bilateral internal acoustic meatus and cerebellopontine angle are normal.", { newParagraph: true }),
      NI(),
    ],
  },
  {
    key: "mr-brain-normal-epilepsy", modality: "MR", region: "Brain",
    name: "Normal — Epilepsy Protocol", studyTitle: "MRI BRAIN WITH EPILEPSY PROTOCOL", titleSuffix: "",
    technique: T.epilepsy,
    recommendation: "Clinico-radiological correlation and follow-up EEG if clinically indicated.",
    isNormal: true, sortOrder: 2,
    rows: [
      R("parenchyma", "Cerebral hemispheres: normal morphology, signal intensity and gray-white matter differentiation."),
      R("deep_gray", "Basal ganglia, thalami and corpus callosum show normal signal.", { newParagraph: true }),
      R("mesial_temporal", "Mesial temporal structures: hippocampi are symmetrical with normal signal. Mammillary bodies, fornices, amygdala and cingulate gyri are unremarkable. No evidence of scarring or atrophy in bilateral temporal lobes.", { newParagraph: true }),
      R("dwi", "Diffusion imaging (DWI): no restricted diffusion noted.", { newParagraph: true }),
      R("swi", "Susceptibility imaging (SWI): no abnormal magnetic susceptibility.", { newParagraph: true }),
      R("ventricles", "Ventricular system & midline structures: lateral and third ventricles are normal in size and shape. Septum pellucidum and falx cerebri are midline. No mass effect or midline shift. Supratentorial sulci and cisterns are normal.", { newParagraph: true }),
      R("posterior_fossa", "Posterior fossa: brainstem and cerebellar hemispheres are normal. Fourth ventricle is midline and normal in size.", { newParagraph: true }),
      R("vessels", "Vascular structures: major intracranial dural venous sinuses show normal outline and flow voids.", { newParagraph: true }),
      R("sella", "Sellar & parasellar region: sella, suprasellar and parasellar structures are normal.", { newParagraph: true }),
      NI(),
    ],
  },
  {
    key: "mr-brain-ce-normal", modality: "MR", region: "Brain",
    name: "Normal — CE Study", studyTitle: "CE-MRI BRAIN", titleSuffix: "",
    technique: T.ce,
    recommendation: "Clinico-radiological correlation. Follow-up study if clinically indicated.",
    isNormal: true, sortOrder: 3,
    rows: [
      R("parenchyma", "Cerebral hemispheres: normal morphology and signal characteristics. Gray-white matter differentiation preserved."),
      R("deep_gray", "Deep gray matter structures: basal ganglia, thalami and corpus callosum appear normal in signal and structure.", { newParagraph: true }),
      R("midline", "Midline structures: septum pellucidum and falx cerebri are in midline. No evidence of mass effect or midline shift.", { newParagraph: true }),
      R("ventricles", "Ventricular system & CSF spaces: lateral, third and fourth ventricles normal in size and configuration. Supratentorial sulci and cisterns within normal limits.", { newParagraph: true }),
      R("posterior_fossa", "Posterior fossa: brainstem and cerebellar hemispheres show normal morphology and signal intensity. Fourth ventricle midline and normal in size.", { newParagraph: true }),
      R("signal", "Parenchymal signal: no focal or diffuse areas of altered signal intensity. No intra- or extra-axial space-occupying lesions identified.", { newParagraph: true }),
      R("vessels", "Venous sinuses: major intracranial dural venous sinuses demonstrate normal flow voids and outline.", { newParagraph: true }),
      R("sella", "Sellar & parasellar region: sella turcica, suprasellar and parasellar structures unremarkable.", { newParagraph: true }),
      R("cpa", "Internal auditory canals & CP angles: bilateral internal acoustic meatus and cerebellopontine angles normal.", { newParagraph: true }),
      NI(),
    ],
  },
  {
    key: "mr-brain-fazekas1", modality: "MR", region: "Brain",
    name: "Fazekas Gr I", studyTitle: "MRI BRAIN",
    titleSuffix: "fazekas grade 1 changes",
    technique: T.plain, recommendation: "Clinical correlation. Follow-up study if clinically indicated.",
    isNormal: false, sortOrder: 4,
    rows: [
      R("wmh", "Few punctate T2/FLAIR hyperintensities in the periventricular, deep and subcortical white matter, consistent with Fazekas Grade I small vessel ischemic changes.", { inImpression: true }),
      R("parenchyma", "Cerebral hemispheres show normal morphology and signal characteristics. Gray-white matter differentiation is preserved.", { newParagraph: true }),
      R("basal_ganglia", "Basal ganglia and thalami show normal morphology and signal intensity. No evidence of hemorrhage or calcification.", { newParagraph: true }),
      R("posterior_fossa", "Brainstem appears normal. No mass lesion, midline shift or hydrocephalus.", { newParagraph: true }),
      R("swi", "No abnormal susceptibility foci on SWI. No extra-axial fluid collections. No diffusion restriction to suggest acute infarction.", { newParagraph: true }),
    ],
  },
  {
    key: "mr-brain-fazekas1-senile", modality: "MR", region: "Brain",
    name: "Fazekas Gr I + Senile Changes", studyTitle: "MRI BRAIN",
    titleSuffix: "fazekas grade 1 changes and senile changes",
    technique: T.plain, recommendation: "Clinical correlation. CE study if clinically indicated / follow-up study.",
    isNormal: false, sortOrder: 5,
    rows: [
      R("parenchyma", "Cerebral hemispheres show normal morphology, signal intensity and gray-white matter differentiation."),
      R("wmh", "Few punctate T2/FLAIR hyperintensities noted in the periventricular and deep white matter — suggestive of mild chronic microvascular ischemic changes (Fazekas Grade I).", { inImpression: true, newParagraph: true }),
      // Same slot as the normal ventricles line — prominence replaces it
      R("ventricles", "Mild prominence of ventricles, cortical sulci and CSF spaces, consistent with involutional (senile) changes. No midline shift or hydrocephalus.", { inImpression: true, newParagraph: true }),
      R("basal_ganglia", "Basal ganglia and thalami show normal signal intensity. No focal lesion.", { newParagraph: true }),
      R("brainstem_cerebellum", "Brainstem and cerebellum show normal morphology and signal characteristics. No focal abnormality.", { newParagraph: true }),
      R("corpus_callosum", "Corpus callosum intact, with normal thickness and signal.", { newParagraph: true }),
      R("sella", "Pituitary gland, infundibulum and suprasellar cistern appear normal.", { newParagraph: true }),
      R("dwi", "No evidence of acute infarct (DWI/ADC negative).", { newParagraph: true }),
      R("swi", "No evidence of hemorrhage (GRE/SWI negative). No focal mass lesion or space-occupying lesion identified.", { newParagraph: true }),
    ],
  },
  {
    key: "mr-brain-fazekas2", modality: "MR", region: "Brain",
    name: "Fazekas Gr II + Senile Changes", studyTitle: "MRI BRAIN",
    titleSuffix: "fazekas grade 2 changes and senile changes",
    technique: T.plain, recommendation: "Clinical correlation. CE study if clinically indicated / follow-up study.",
    isNormal: false, sortOrder: 6,
    rows: [
      R("ventricles", "There is mild, symmetric prominence of the lateral, third and fourth ventricles. The cortical sulci, sylvian fissures and basal cisterns appear mildly prominent, consistent with age-related involutional changes.", { inImpression: true }),
      R("wmh", "Multiple discrete and confluent areas of T2/FLAIR hyperintensity involving the deep white matter, consistent with Fazekas Grade 2 changes, suggesting moderate chronic small vessel ischemic disease.", { inImpression: true, newParagraph: true }),
      R("hemorrhage", "No evidence of acute intracranial hemorrhage, large territory cortical infarction or space-occupying lesions.", { newParagraph: true }),
      R("dwi", "No restricted diffusion on DWI/ADC sequences to suggest acute ischemia.", { newParagraph: true }),
      R("midline", "The midline structures are central with no evidence of shift or herniation.", { newParagraph: true }),
      R("corpus_callosum", "The corpus callosum and brainstem appear normal in morphology and signal intensity.", { newParagraph: true }),
      R("sinuses", "The visualized portions of the orbits and paranasal sinuses are unremarkable.", { newParagraph: true }),
      R("vessels", "The flow voids of the major intracranial internal carotid and vertebrobasilar arteries are preserved.", { newParagraph: true }),
    ],
  },
  {
    key: "mr-brain-fazekas2-lacunar", modality: "MR", region: "Brain",
    name: "Fazekas Gr II + Lacunar Infarcts", studyTitle: "MRI BRAIN",
    titleSuffix: "fazekas grade 2 changes and lacunar infarcts",
    technique: T.plain, recommendation: "Recommend follow-up imaging. Clinico-pathological correlation.",
    isNormal: false, sortOrder: 7,
    rows: [
      R("wmh", "Multiple hyperintense foci in the periventricular, deep and subcortical white matter on FLAIR and T2-weighted sequences, consistent with Fazekas Grade II small vessel ischemic changes.", { inImpression: true }),
      R("basal_ganglia", "Chronic lacunar infarcts are noted in the bilateral basal ganglia. Otherwise, morphology and signal intensity are preserved. No evidence of acute hemorrhage or calcification.", { inImpression: true, newParagraph: true }),
      R("parenchyma", "Cerebral hemispheres show normal morphology and signal characteristics. Gray-white matter differentiation is preserved.", { newParagraph: true }),
      R("dwi", "No diffusion restriction is present to suggest acute infarction.", { newParagraph: true }),
      R("posterior_fossa", "Brainstem is normal. Mild cerebellar atrophy is noted.", { inImpression: true, newParagraph: true }),
      R("mass", "No mass lesion, midline shift or hydrocephalus. No abnormal susceptibility foci on SWI. No extra-axial fluid collections.", { newParagraph: true }),
    ],
  },
  {
    key: "mr-brain-fazekas3", modality: "MR", region: "Brain",
    name: "Fazekas Gr III", studyTitle: "MRI BRAIN",
    titleSuffix: "fazekas grade 3 changes",
    technique: T.plain, recommendation: "Clinical correlation. Follow-up study if clinically indicated.",
    isNormal: false, sortOrder: 8,
    rows: [
      R("wmh", "Extensive confluent T2/FLAIR hyperintensities involving the periventricular and deep cerebral white matter — consistent with Fazekas Grade III changes, suggesting severe chronic small vessel ischemic disease.", { inImpression: true }),
      R("ventricles", "Prominence of ventricular system and cortical sulci consistent with involutional changes.", { inImpression: true, newParagraph: true }),
      R("parenchyma", "No mass effect or midline shift. Gray-white matter differentiation is preserved.", { newParagraph: true }),
      R("dwi", "No restricted diffusion on DWI/ADC to suggest acute ischemia.", { newParagraph: true }),
      R("posterior_fossa", "Brainstem and cerebellum appear normal.", { newParagraph: true }),
      R("vessels", "Major intracranial dural venous sinuses show normal outline and flow void.", { newParagraph: true }),
    ],
  },
];
