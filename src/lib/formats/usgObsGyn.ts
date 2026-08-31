/**
 * USG Obstetrics + Gynaecology (TVS) formats — curated verbatim from the
 * doctor's own library (docs/report-formats/usg: Pregnancy/, TVS/,
 * Female Lower/). Antenatal formats carry the PCPNDT declaration.
 */
import type { FormatSeed, FormatRowSeed } from "@/lib/seedData";

const REC = "Please correlate with clinical features.";
const PCPNDT =
  "DECLARATION OF DOCTOR PERFORMING ULTRASONOGRAPHY: I, Dr. ___, MD declare that while conducting USG on the above patient, I have neither detected nor disclosed the sex of the foetus to anybody in any manner.";

const row = (region: string) => (concept: string, text: string, extra: Partial<FormatRowSeed> = {}): FormatRowSeed => ({
  region, concept, text, inImpression: false, ...extra,
});

const OB = row("USG Pregnancy");
const TVS = row("USG TVS");

export const USG_OBSGYN_FORMATS: FormatSeed[] = [
  // ── Early pregnancy ──────────────────────────────────────────────────────
  {
    key: "usg-early-pregnancy", modality: "USG", region: "USG Pregnancy",
    name: "Early Pregnancy — Live IUP", studyTitle: "TVS — EARLY PREGNANCY",
    titleSuffix: "single live intrauterine pregnancy",
    technique: "Transvaginal sonography was performed with an empty bladder using a 7.5 MHz endocavitary transducer.",
    recommendation: "Follow up scan. " + REC, isNormal: false, sortOrder: 1,
    rows: [
      OB("uterus", "Gravid uterus reveals one well-formed gestational sac with good decidual echoes.", { inImpression: true }),
      OB("embryo", "A single live embryo and yolk sac are seen. Cardiac pulsations are present. CRL ___ cm corresponding to ___ weeks ___ days.", { inImpression: true }),
      OB("perigestational", "No evidence of perigestational bleed is seen."),
      OB("os", "Internal os is closed."),
      OB("adnexa", "No adenexal pathology or free fluid is seen."),
      OB("ga", "GA by USG: ___ weeks ___ days."),
    ],
  },
  {
    key: "usg-antenatal", modality: "USG", region: "USG Pregnancy",
    name: "Antenatal Scan — Single Live Fetus", studyTitle: "ANTENATAL SCAN",
    titleSuffix: "single live intrauterine fetus",
    technique: "Obstetric ultrasonography was performed using a curvilinear 3.5 MHz transducer.",
    recommendation: PCPNDT, isNormal: false, sortOrder: 2,
    rows: [
      OB("fetus", "There is a single live intrauterine fetus in ___ presentation at the time of examination. FHR ___ beats/min and regular.", { inImpression: true }),
      OB("parameters", "Fetal parameters — BPD ___ mm (___ weeks ___ days), HC ___ mm (___ weeks ___ days), AC ___ mm (___ weeks ___ days), FL ___ mm (___ weeks ___ days)."),
      OB("ga", "Parameters corresponding to mean GA: ___ weeks ___ days (± 2 weeks). E.D.D. as per scan: ___. Fetal weight in grams: ___ (± ___) g.", { inImpression: true }),
      OB("anomaly", "No gross fetal congenital anomalies detected."),
      OB("placenta", "Placenta is located ___ (maturity Grade ___). The lower part is not extending up to the lower segment. Internal os is closed.", { inImpression: true }),
      OB("liquor", "Liquor is adequate. AFI ___ cm."),
    ],
  },
  {
    key: "usg-follicular-monitoring", modality: "USG", region: "USG Pregnancy",
    name: "Follicular Monitoring", studyTitle: "FOLLICULAR STUDY",
    titleSuffix: "follicular study",
    technique: "Transvaginal sonography for follicular monitoring was performed on day ___ of the cycle.",
    recommendation: REC, isNormal: false, sortOrder: 3,
    rows: [
      OB("uterus", "Uterus is normal in size and anteverted. Endometrial thickness ___ cm.", { inImpression: true }),
      OB("rt_ovary", "Right ovary shows a dominant follicle measuring ___ x ___ cm."),
      OB("lt_ovary", "Left ovary shows follicles, largest measuring ___ x ___ cm."),
      OB("pod", "No free fluid in the pouch of Douglas at present."),
    ],
  },
  {
    key: "usg-missed-abortion", modality: "USG", region: "USG Pregnancy",
    name: "Missed Abortion", studyTitle: "TVS — EARLY PREGNANCY",
    titleSuffix: "missed abortion",
    technique: "Transvaginal sonography was performed with an empty bladder using a 7.5 MHz endocavitary transducer.",
    recommendation: REC, isNormal: false, sortOrder: 4,
    rows: [
      OB("uterus", "Gravid uterus containing an irregular intrauterine gestational sac corresponding to ___ weeks ___ days of average gestational age. The embryo is not well appreciated / cardiac pulsations are absent, S/o Missed abortion.", { inImpression: true }),
      OB("adnexa", "No adenexal pathology or free fluid is seen."),
    ],
  },
  {
    key: "usg-iud", modality: "USG", region: "USG Pregnancy",
    name: "IUD", studyTitle: "ANTENATAL SCAN",
    titleSuffix: "intrauterine death",
    technique: "Obstetric ultrasonography was performed using a curvilinear 3.5 MHz transducer.",
    recommendation: REC, isNormal: false, sortOrder: 5,
    rows: [
      OB("fetus", "A single fetus is seen in ___ presentation. No fetal cardiac activity and no fetal somatic movements are seen. Fetal parameters correspond to ___ weeks ___ days of gestational age.", { inImpression: true }),
      OB("signs", "Skin oedema / overlapping skull bones are seen."),
      OB("placenta", "Placenta is located ___. Liquor is ___."),
    ],
  },

  // ── TVS / gynaecology ────────────────────────────────────────────────────
  {
    key: "usg-tvs-normal", modality: "USG", region: "USG TVS",
    name: "TVS — Normal", studyTitle: "TRANSVAGINAL SONOGRAPHY", titleSuffix: "",
    technique: "Transvaginal sonography was performed with an empty bladder using a 7.5 MHz endocavitary transducer.",
    recommendation: REC, isNormal: true, sortOrder: 1,
    rows: [
      TVS("uterus", "Uterus is normal in size and shape and measures ___ X ___ X ___ cm. The uterus is in anteversion with normal endometrial thickness (___ cm). No focal pathology or abnormalities of outline are noted. The cervical echo is normal."),
      TVS("adnexa", "Ovaries are normally positioned. Normal in echotexture. RT. ovary measures ___ x ___ cm. LT. ovary measures ___ x ___ cm."),
      TVS("pod", "Pouch of Douglas is clear."),
      { region: "USG TVS", concept: "normal_impression", text: "Normal study.", inImpression: true, impressionOnly: true },
    ],
  },
  {
    key: "usg-pcod", modality: "USG", region: "USG TVS",
    name: "PCOD — Polycystic Ovaries", studyTitle: "TRANSVAGINAL SONOGRAPHY",
    titleSuffix: "polycystic ovaries",
    technique: "Transvaginal sonography was performed with an empty bladder using a 7.5 MHz endocavitary transducer.",
    recommendation: REC, isNormal: false, sortOrder: 2,
    rows: [
      TVS("uterus", "Uterus is normal in size and shape and measures ___ X ___ X ___ cm. The uterus is in anteversion with normal endometrial thickness (___ cm). No focal pathology or abnormalities of outline are noted. The cervical echo is normal."),
      TVS("adnexa", "Ovaries are normally positioned. Multiple small cystic structures (5-6 mm) are arranged at the periphery of both ovaries in pearl of string fashion. The central stroma is echogenic. Features are suggestive of Polycystic ovaries. RT. ovary measures ___ x ___ cm. LT. ovary measures ___ x ___ cm.", { inImpression: true }),
      TVS("pod", "Pouch of Douglas is clear."),
    ],
  },
  {
    key: "usg-fibroid", modality: "USG", region: "USG TVS",
    name: "Uterine Fibroid", studyTitle: "TRANSVAGINAL SONOGRAPHY",
    titleSuffix: "uterine fibroid",
    technique: "Transvaginal sonography was performed with an empty bladder using a 7.5 MHz endocavitary transducer.",
    recommendation: REC, isNormal: false, sortOrder: 3,
    rows: [
      TVS("uterus", "Uterus is bulky in size and measures ___ X ___ X ___ cm. There is evidence of an ill-defined intramural lesion (measuring ___ x ___ cm) in the ___ uterine wall, suggestive of Fibroid. The cervical echo is normal.", { inImpression: true }),
      TVS("adnexa", "Ovaries are normally positioned. Normal in echotexture."),
      TVS("pod", "Pouch of Douglas is clear."),
    ],
  },
  {
    key: "usg-ovarian-cyst", modality: "USG", region: "USG TVS",
    name: "Simple Ovarian Cyst", studyTitle: "TRANSVAGINAL SONOGRAPHY",
    titleSuffix: "ovarian cyst",
    technique: "Transvaginal sonography was performed with an empty bladder using a 7.5 MHz endocavitary transducer.",
    recommendation: REC, isNormal: false, sortOrder: 4,
    rows: [
      TVS("uterus", "Uterus is normal in size and shape and measures ___ X ___ X ___ cm. The uterus is in anteversion with normal endometrial thickness (___ cm). No focal pathology or abnormalities of outline are noted. The cervical echo is normal."),
      TVS("adnexa", "Ovaries are normally positioned. There is evidence of a well-defined simple cyst (___ x ___ cm) arising from the ___ ovary. No internal echoes or septa.", { inImpression: true }),
      TVS("pod", "Pouch of Douglas is clear."),
    ],
  },
  {
    key: "usg-rpoc", modality: "USG", region: "USG TVS",
    name: "RPOC — Retained Products", studyTitle: "TRANSVAGINAL SONOGRAPHY",
    titleSuffix: "retained products of conception",
    technique: "Transvaginal sonography was performed with an empty bladder using a 7.5 MHz endocavitary transducer.",
    recommendation: REC, isNormal: false, sortOrder: 5,
    rows: [
      TVS("uterus", "Uterus is bulky in size and measures ___ X ___ X ___ cm. An ill-defined hyperechoic structure (___ x ___ cm) is seen in the uterine cavity, S/o Retained products of conception. The cervical echo is normal.", { inImpression: true }),
      TVS("adnexa", "Ovaries are normally positioned. Normal in echotexture."),
      TVS("pod", "Pouch of Douglas is clear."),
    ],
  },
  {
    key: "usg-pid", modality: "USG", region: "USG TVS",
    name: "PID with POD Collection", studyTitle: "USG LOWER ABDOMEN",
    titleSuffix: "pelvic inflammatory disease",
    technique: "Ultrasonography of the lower abdomen was performed with a full bladder using a curvilinear 3.5 MHz transducer.",
    recommendation: REC, isNormal: false, sortOrder: 6,
    rows: [
      TVS("uterus", "Uterus is normal in size and shape and measures ___ X ___ X ___ cm. The uterus is in anteversion. Mild fluid is seen within the endometrial cavity. The cervical echo is normal."),
      TVS("adnexa", "Both ovaries are bulky and adherent to the uterus, with ill-defined margins, S/o PID.", { inImpression: true }),
      TVS("pod", "Moderate collection with fine internal echoes is seen in the pouch of Douglas.", { inImpression: true }),
    ],
  },
];
