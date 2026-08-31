/**
 * MRI Joint complete-report formats — curated from the doctor's own
 * report library (knee / shoulder / elbow / wrist / hip / SI / ankle).
 */
import type { FormatSeed, FormatRowSeed } from "@/lib/seedData";

const T = {
  knee: "Images are acquired using T1 & T2 axial, sagittal & coronal sequences.",
  shoulder: "Plain MRI study of the shoulder was performed using T1, T2 and STIR sequences in multiple planes with a dedicated surface coil.",
  elbow: "The elbow joint was examined in multiple planes using T1, T2 and STIR sequences.",
  wrist: "MRI of the wrist was performed using T1, T2, STIR and gradient echo sequences in multiple planes.",
  hip: "Multiplanar and multiparametric study of the hip joints was performed.",
  si: "T1W and STIR coronal sequences of both sacroiliac joints were obtained.",
  ankle: "MRI of the ankle was performed using T1, T2 and STIR sequences in axial, coronal and sagittal planes.",
};

const j = (region: string) =>
  (concept: string, text: string, extra: Partial<FormatRowSeed> = {}): FormatRowSeed =>
    ({ region, concept, text, inImpression: false, ...extra });

const KNEE = j("Knee Joint");
const SHOULDER = j("Shoulder Joint");
const ELBOW = j("Elbow Joint");
const WRIST = j("Wrist Joint");
const HIP = j("Hip Joint");
const SI = j("SI Joint");
const ANKLE = j("Ankle Joint");

const NI = (region: string): FormatRowSeed => ({
  region, concept: "normal_impression", text: "Normal study.",
  inImpression: true, impressionOnly: true,
});

const KNEE_SCAFFOLD = (): FormatRowSeed[] => [
  KNEE("menisci", "Both menisci (including horns & body) appear normal in size, shape & signal intensity.", { newParagraph: true }),
  KNEE("bones", "Visualized bones show normal signal intensity. Femoral condyles & both plateaus of tibia show normal marrow signals.", { newParagraph: true }),
  KNEE("collateral", "Lateral & medial collateral ligaments are intact and show normal signal intensities.", { newParagraph: true }),
  KNEE("other_ligaments", "Transverse & meniscofemoral ligaments are normal in shape & signal intensities.", { newParagraph: true }),
  KNEE("soft_tissue", "Muscles & tendons around the joint are normal in shape & signal intensities. Tibiofibular joint is normal. Hoffa's fat pad and patellar tendon appear normal.", { newParagraph: true }),
];

export const MR_JOINT_FORMATS: FormatSeed[] = [
  {
    key: "mr-knee-normal", modality: "MR", region: "Knee Joint",
    name: "Normal", studyTitle: "MRI KNEE JOINT", titleSuffix: "",
    technique: T.knee, recommendation: "Clinico-pathological correlation.",
    isNormal: true, sortOrder: 1,
    rows: [
      KNEE("cruciate", "Both cruciate ligaments appear normal in size, shape & intensity."),
      ...KNEE_SCAFFOLD(),
      NI("Knee Joint"),
    ],
  },
  {
    key: "mr-knee-effusion", modality: "MR", region: "Knee Joint",
    name: "Minimal Joint Effusion", studyTitle: "MRI KNEE JOINT",
    titleSuffix: "joint effusion",
    technique: T.knee, recommendation: "Clinico-pathological correlation.",
    isNormal: false, sortOrder: 2,
    rows: [
      KNEE("effusion", "Minimal joint effusion.", { inImpression: true }),
      KNEE("cruciate", "Both cruciate ligaments appear normal in size, shape & intensity.", { newParagraph: true }),
      ...KNEE_SCAFFOLD(),
    ],
  },
  {
    key: "mr-shoulder-normal", modality: "MR", region: "Shoulder Joint",
    name: "Normal", studyTitle: "MRI SHOULDER JOINT", titleSuffix: "",
    technique: T.shoulder, recommendation: "Please correlate clinically.",
    isNormal: true, sortOrder: 1,
    rows: [
      SHOULDER("joint_space", "The shoulder joint space appears normal, without any evidence of erosion or destruction."),
      SHOULDER("bones", "Articular margins are intact. Acromioclavicular joint also appears normal. The bones around the shoulder joint reveal normal intensity.", { newParagraph: true }),
      SHOULDER("muscles", "The muscles and their attachments appear normal.", { newParagraph: true }),
      SHOULDER("rotator_cuff", "Rotator cuff is well demonstrated on coronal T1/T2 weighted images. There is no evidence of edema / tear.", { newParagraph: true }),
      NI("Shoulder Joint"),
    ],
  },
  {
    key: "mr-shoulder-bursitis", modality: "MR", region: "Shoulder Joint",
    name: "Subacromial Bursitis", studyTitle: "MRI SHOULDER JOINT",
    titleSuffix: "subacromial bursitis",
    technique: T.shoulder,
    recommendation: "Clinical correlation and further evaluation by relevant investigations.",
    isNormal: false, sortOrder: 2,
    rows: [
      SHOULDER("bursitis", "Hyperintense signal intensity is noted in the subacromial and subclavicular region — ? bursitis.", { inImpression: true }),
      SHOULDER("bones", "Humeral head and bone around the joint appear normal.", { newParagraph: true }),
      SHOULDER("labrum", "Bony as well as cartilaginous glenoid labrum appears normal.", { newParagraph: true }),
      SHOULDER("rotator_cuff", "No evidence of abnormal signal intensity is noted in the rotator cuff (supraspinatus, infraspinatus, subscapularis and teres minor), biceps tendon and deltoid muscles as well as the visualized rest of the muscles.", { newParagraph: true }),
      SHOULDER("alignment", "Alignment of the articulating bones of the shoulder joint appears essentially normal with no obvious subluxation / dislocation. The shaft of humerus under view appears normal. Scapula including its spine & the coracoid process appear unremarkable.", { newParagraph: true }),
      SHOULDER("effusion", "No obvious joint effusion seen. Supporting ligaments around the joint appear normal.", { newParagraph: true }),
      SHOULDER("nvb", "Neurovascular bundles around the joint appear normal. No obvious Hill-Sachs and Bankart lesion seen. Acromioclavicular joint appears normal.", { newParagraph: true }),
    ],
  },
  {
    key: "mr-shoulder-supraspinatus", modality: "MR", region: "Shoulder Joint",
    name: "Supraspinatus Tear + Atrophy", studyTitle: "MRI SHOULDER JOINT",
    titleSuffix: "supraspinatus tear",
    technique: T.shoulder, recommendation: "Please correlate clinically.",
    isNormal: false, sortOrder: 3,
    rows: [
      SHOULDER("rotator_cuff", "The central tendon of the supraspinatus muscle is interrupted by an ill-defined area of increased signal — s/o tear.", { inImpression: true }),
      SHOULDER("atrophy", "Mildly atrophied supraspinatus and infraspinatus muscles with muscle and tendon retracted to the glenoid — s/o atrophy.", { inImpression: true, newParagraph: true }),
      SHOULDER("bone_edema", "On STIR sequence, hyperintensity is noted in the head and surgical neck of humerus — ? edema / contusion.", { inImpression: true, newParagraph: true }),
      SHOULDER("joint_space", "The shoulder joint space appears normal, without any evidence of erosion or destruction.", { newParagraph: true }),
      SHOULDER("bones", "Articular margins are intact. Acromioclavicular joint also appears normal. Rest of the bones around the shoulder joint reveal normal intensity.", { newParagraph: true }),
      SHOULDER("muscles", "Rest of the muscles and their attachments appear normal.", { newParagraph: true }),
    ],
  },
  {
    key: "mr-elbow-normal", modality: "MR", region: "Elbow Joint",
    name: "Normal", studyTitle: "MRI ELBOW JOINT", titleSuffix: "",
    technique: T.elbow, recommendation: "Clinico-pathological correlation.",
    isNormal: true, sortOrder: 1,
    rows: [
      ELBOW("bones", "There is no abnormal marrow signal or erosion in the distal humerus and proximal radius / ulna."),
      ELBOW("joint", "The articular surfaces in the elbow joint are normal and there is no evidence of effusion. There is no displacement of the joint structures.", { newParagraph: true }),
      ELBOW("tendons", "The common flexor and extensor origins, and the epicondyles show normal signal.", { newParagraph: true }),
      ELBOW("soft_tissue", "There is no soft tissue signal abnormality or subcutaneous edema.", { newParagraph: true }),
      NI("Elbow Joint"),
    ],
  },
  {
    key: "mr-wrist-normal", modality: "MR", region: "Wrist Joint",
    name: "Normal", studyTitle: "MRI WRIST JOINT", titleSuffix: "",
    technique: T.wrist, recommendation: "Clinico-pathological correlation. Not for medico-legal purpose.",
    isNormal: true, sortOrder: 1,
    rows: [
      WRIST("bones", "The distal radius and ulna, carpal bones and metacarpal bases show normal alignment, cortical outline and marrow signal intensity."),
      WRIST("tfcc", "The triangular fibrocartilage complex (TFCC) is intact with normal signal intensity.", { newParagraph: true }),
      WRIST("ligaments", "The intrinsic (scapholunate and lunotriquetral) and extrinsic carpal ligaments are intact.", { newParagraph: true }),
      WRIST("tendons", "The extensor and flexor tendons at the wrist show normal course, calibre and signal intensity.", { newParagraph: true }),
      WRIST("carpal_tunnel", "The median nerve in the carpal tunnel shows normal calibre and signal intensity. No evidence of tenosynovitis.", { newParagraph: true }),
      WRIST("joints", "The radiocarpal, intercarpal and carpometacarpal joints are normal with no effusion.", { newParagraph: true }),
      WRIST("soft_tissue", "No focal soft tissue mass or abnormality is seen.", { newParagraph: true }),
      NI("Wrist Joint"),
    ],
  },
  {
    key: "mr-hip-screening", modality: "MR", region: "Hip Joint",
    name: "Screening — Normal", studyTitle: "MRI SCREENING BOTH HIP JOINTS", titleSuffix: "",
    technique: T.hip, recommendation: "Clinico-pathological correlation.",
    isNormal: true, sortOrder: 1,
    rows: [
      HIP("bones", "The bones at both hip joints show normal alignment. The femoral head and the acetabular articular margins appear normal. No focal or diffuse area of altered signal abnormality is seen."),
      HIP("synovium", "No capsular or synovial thickening is seen. No joint effusion is seen.", { newParagraph: true }),
      HIP("soft_tissue", "No abnormal periarticular soft tissue is seen. Visualized pelvic soft tissue structures are normal.", { newParagraph: true }),
      NI("Hip Joint"),
    ],
  },
  {
    key: "mr-hip-avn", modality: "MR", region: "Hip Joint",
    name: "Femoral Head AVN", studyTitle: "MRI HIP JOINTS",
    titleSuffix: "femoral head avn",
    technique: T.hip, recommendation: "Clinico-pathological correlation.",
    isNormal: false, sortOrder: 2,
    rows: [
      HIP("effusion", "Effusion is seen in right hip joint.", { inImpression: true }),
      HIP("avn", "Altered signal intensity with peripheral T2 hyperintense rim is seen in the right femoral head with sparing of a small area posteriorly — approximately 90% involvement. On sagittal T2 images, small linear T2 hyperintensity is seen in the subchondral region, suggestive of subchondral collapse; flattening of the head is noted anteriorly.", { inImpression: true, laterality: "right", newParagraph: true }),
      HIP("marrow", "Mild edema is seen in right femoral neck and intertrochanteric region. Left femoral head is normal. No abnormality seen in left femoral neck and bilateral femoral shafts.", { newParagraph: true }),
      HIP("acetabulum", "The acetabulum is normal.", { newParagraph: true }),
      HIP("soft_tissue", "The muscles and neurovascular bundles are normal. Both iliac bones are normal. The sacroiliac joints are normal.", { newParagraph: true }),
      HIP("impression_summary", "MR appearance is suggestive of right femoral head AVN, Ficat-Arlet Stage IIIC.", { inImpression: true, impressionOnly: true }),
    ],
  },
  {
    key: "mr-si-sacroiliitis", modality: "MR", region: "SI Joint",
    name: "Sacroiliitis", studyTitle: "MRI SCREENING SI JOINTS",
    titleSuffix: "sacroiliitis",
    technique: T.si, recommendation: "Suggested: detailed CE MRI of SI joints. Clinico-pathological correlation.",
    isNormal: false, sortOrder: 1,
    rows: [
      SI("sacroiliitis", "Evidence of T1 hypo & STIR hyperintensity in the articulation along with mild erosions of the bilateral sacroiliac joints.", { inImpression: true }),
      SI("joint_space", "Joint space of bilateral sacroiliac joints is normal.", { newParagraph: true }),
      SI("soft_tissue", "Presacral soft tissue appears normal. No significant fluid collection is seen.", { newParagraph: true }),
      SI("bones", "Sacral wings appear normal. Sacral foramina appear normal.", { newParagraph: true }),
    ],
  },
  {
    key: "mr-ankle-achilles", modality: "MR", region: "Ankle Joint",
    name: "Achilles Tendon Tear", studyTitle: "MRI ANKLE JOINT",
    titleSuffix: "achilles tendon tear",
    technique: T.ankle,
    recommendation: "Clinico-pathological correlation. Not for medico-legal purpose.",
    isNormal: false, sortOrder: 1,
    rows: [
      ANKLE("achilles", "Increased signal intensity is seen in soft tissue posterior to calcaneum with thickening and heterogeneous signal intensity in the visualized Achilles tendon and disruption of the Achilles tendon from its calcaneal attachment. The tear is approx. 24 mm proximal to its attachment at calcaneum — suggestive of complete tear.", { inImpression: true }),
      ANKLE("inflammation", "Increased signal intensity is also seen in soft tissue around the ankle joint — suggestive of inflammatory reaction.", { inImpression: true, newParagraph: true }),
      ANKLE("bursa", "Free fluid with distension noted in retrocalcaneal bursa.", { inImpression: true, newParagraph: true }),
      ANKLE("joints", "Rest of the subtalar joint and the tarsometatarsal joints appear unremarkable.", { newParagraph: true }),
      ANKLE("bones", "The visualized lower tibia and fibula, talus and the metatarsal bones show normal signal intensity.", { newParagraph: true }),
      ANKLE("soft_tissue", "Rest of the tendons, ligaments, muscles and neurovascular structures appear normal.", { newParagraph: true }),
    ],
  },
];
