/**
 * Demo seed — makes the studio usable the moment it boots, before any
 * CARE/Orthanc integration is configured. Idempotent.
 */
import { db } from "@/lib/db";
import { PHRASE_SEEDS, TECHNIQUE_SEEDS, FORMAT_SEEDS } from "@/lib/seedData";
import { hashPin } from "@/lib/auth";

const HOURS = 3600 * 1000;
const DAYS = 24 * HOURS;

type DemoOrder = {
  accession: string;
  name: string;
  age: string;
  sex: string;
  mrn?: string;
  referrer: string;
  test: string;
  modality: string;
  region: string;
  billing?: string | null;
  status: string;
  uid?: string;
  studyDate: Date;
};

const DEMO_ORDERS: DemoOrder[] = [
  { accession: "CARE-24081", name: "Sunita Devi", age: "54/F", sex: "F", mrn: "MRN-10241", referrer: "Dr. R. Sharma", test: "MRI Lumbosacral Spine", modality: "MR", region: "LS Spine", billing: "PAID", status: "TO_REPORT", uid: "1.2.840.113619.2.55.3.2831183777.781.1676812345.101", studyDate: new Date(Date.now() - 3 * HOURS) },
  { accession: "CARE-24082", name: "Mohd. Islam", age: "41/M", sex: "M", mrn: "MRN-10312", referrer: "Dr. A. Verma", test: "MRI Brain Plain", modality: "MR", region: "Brain", billing: "DUE", status: "TO_REPORT", uid: "1.2.840.113619.2.55.3.2831183777.781.1676812345.102", studyDate: new Date(Date.now() - 5 * HOURS) },
  { accession: "CARE-24083", name: "Rina Karki", age: "37/F", sex: "F", mrn: "MRN-10388", referrer: "Dr. S. Gupta", test: "MRI Cervical Spine", modality: "MR", region: "Cervical Spine", billing: "UPI_PENDING", status: "TO_REPORT", uid: "1.2.840.113619.2.55.3.2831183777.781.1676812345.103", studyDate: new Date(Date.now() - 1 * HOURS) },
  { accession: "CARE-24084", name: "Bhola Yadav", age: "66/M", sex: "M", mrn: "MRN-10401", referrer: "Dr. R. Sharma", test: "CT Head Plain", modality: "CT", region: "CT Head", billing: "PAID", status: "TO_REPORT", uid: "1.2.840.113619.2.55.3.2831183777.781.1676812345.104", studyDate: new Date(Date.now() - 8 * HOURS) },
  { accession: "CARE-24085", name: "Pinky Kumari", age: "29/F", sex: "F", mrn: "MRN-10418", referrer: "Dr. N. Ahmed", test: "MRI Lumbosacral Spine", modality: "MR", region: "LS Spine", billing: null, status: "AWAITING_IMAGES", studyDate: new Date(Date.now() - 2 * HOURS) },
  { accession: "CARE-24086", name: "Arjun Mahto", age: "48/M", sex: "M", mrn: "MRN-10422", referrer: "Dr. A. Verma", test: "CT Dorsal Spine", modality: "CT", region: "CT Spine", billing: "DUE", status: "AWAITING_IMAGES", studyDate: new Date(Date.now() - 4 * HOURS) },
  // Unlinked: present in Orthanc, no CARE order
  { accession: "ORTH-7101", name: "Walk-in Patient (Orthanc)", age: "60/F", sex: "F", referrer: "—", test: "MRI Brain (unmatched)", modality: "MR", region: "Brain", status: "TO_REPORT", uid: "1.2.840.113619.2.55.3.2831183777.781.1676812345.901", studyDate: new Date(Date.now() - 26 * HOURS) },
  { accession: "ORTH-7102", name: "Walk-in Patient (Orthanc)", age: "52/M", sex: "M", referrer: "—", test: "CT Head (unmatched)", modality: "CT", region: "CT Head", status: "TO_REPORT", uid: "1.2.840.113619.2.55.3.2831183777.781.1676812345.902", studyDate: new Date(Date.now() - 30 * HOURS) },
  // New regions from the doctor's format library (joints / screening)
  { accession: "CARE-24087", name: "Ramesh Hansda", age: "34/M", sex: "M", mrn: "MRN-10440", referrer: "Dr. T. Jyoti", test: "MRI Right Knee Joint", modality: "MR", region: "Knee Joint", billing: "PAID", status: "TO_REPORT", studyDate: new Date(Date.now() - 6 * HOURS) },
  { accession: "CARE-24088", name: "Fulmani Devi", age: "58/F", sex: "F", mrn: "MRN-10451", referrer: "Dr. A. K. Singh", test: "MRI Screening Whole Spine", modality: "MR", region: "Whole Spine Screening", billing: "DUE", status: "TO_REPORT", studyDate: new Date(Date.now() - 9 * HOURS) },
  { accession: "CARE-24089", name: "Sohan Kumar", age: "45/M", sex: "M", mrn: "MRN-10462", referrer: "Dr. K. Sasikumar", test: "MRI Both Hip Joint Screening", modality: "MR", region: "Hip Joint", billing: null, status: "AWAITING_IMAGES", studyDate: new Date(Date.now() - 1 * HOURS) },
  // CT body regions from the doctor's CT format library
  { accession: "CARE-24090", name: "Anil Mandal", age: "61/M", sex: "M", mrn: "MRN-10477", referrer: "Dr. S. Kumar", test: "CT Chest Plain & Contrast", modality: "CT", region: "CT Chest", billing: "DUE", status: "TO_REPORT", studyDate: new Date(Date.now() - 7 * HOURS) },
  { accession: "CARE-24091", name: "Sabita Devi", age: "47/F", sex: "F", mrn: "MRN-10484", referrer: "Dr. A. K. Singh", test: "CT Whole Abdomen", modality: "CT", region: "CT Abdomen", billing: "PAID", status: "TO_REPORT", studyDate: new Date(Date.now() - 2 * HOURS) },
  { accession: "CARE-24092", name: "Md. Salim", age: "39/M", sex: "M", mrn: "MRN-10490", referrer: "Dr. R. Sharma", test: "CT PNS Coronal", modality: "CT", region: "CT PNS", billing: null, status: "AWAITING_IMAGES", studyDate: new Date(Date.now() - 4 * HOURS) },
  // USG orders from the doctor's USG format library
  { accession: "CARE-24093", name: "Kiran Devi", age: "44/F", sex: "F", mrn: "MRN-10501", referrer: "Dr. R. Sharma", test: "USG Whole Abdomen", modality: "USG", region: "USG Whole Abdomen", billing: "PAID", status: "TO_REPORT", studyDate: new Date(Date.now() - 1.5 * HOURS) },
  { accession: "CARE-24094", name: "Sarita Kumari", age: "26/F", sex: "F", mrn: "MRN-10504", referrer: "Dr. N. Ahmed", test: "TVS", modality: "USG", region: "USG TVS", billing: "DUE", status: "TO_REPORT", studyDate: new Date(Date.now() - 3 * HOURS) },
  { accession: "CARE-24095", name: "Rekha Devi", age: "24/F", sex: "F", mrn: "MRN-10509", referrer: "Dr. (Mrs) S. Patralekh", test: "Antenatal Scan", modality: "USG", region: "USG Pregnancy", billing: "PAID", status: "TO_REPORT", studyDate: new Date(Date.now() - 5 * HOURS) },
  // X-ray orders from the doctor's X-ray format library
  { accession: "CARE-24096", name: "Rajendra Prasad", age: "58/M", sex: "M", mrn: "MRN-10512", referrer: "Dr. A. Verma", test: "X-Ray Chest PA", modality: "X-Ray", region: "X-Ray Chest", billing: "PAID", status: "TO_REPORT", studyDate: new Date(Date.now() - 40 * 60 * 1000) },
  { accession: "CARE-24097", name: "Guddu Kumar", age: "42/M", sex: "M", mrn: "MRN-10518", referrer: "Dr. S. Kumar", test: "X-Ray LS Spine AP/LAT", modality: "X-Ray", region: "X-Ray Spine", billing: "DUE", status: "TO_REPORT", studyDate: new Date(Date.now() - 6 * HOURS) },
  { accession: "CARE-24098", name: "Priya Singh", age: "29/F", sex: "F", mrn: "MRN-10524", referrer: "Dr. (Mrs) R. Thakur", test: "HSG", modality: "X-Ray", region: "X-Ray HSG", billing: null, status: "AWAITING_IMAGES", studyDate: new Date(Date.now() - 2 * HOURS) },
];

const DEMO_REPORTED: DemoOrder[] = [
  { accession: "CARE-24077", name: "Kamla Singh", age: "58/F", sex: "F", mrn: "MRN-10190", referrer: "Dr. R. Sharma", test: "MRI Lumbosacral Spine", modality: "MR", region: "LS Spine", billing: "PAID", status: "REPORTED", studyDate: new Date(Date.now() - 1.2 * DAYS) },
  { accession: "CARE-24078", name: "Dinesh Paswan", age: "45/M", sex: "M", mrn: "MRN-10199", referrer: "Dr. N. Ahmed", test: "MRI Brain Plain", modality: "MR", region: "Brain", billing: "PAID", status: "REPORTED", studyDate: new Date(Date.now() - 1.5 * DAYS) },
];

/** Seed everything. Safe to call on every boot — all writes are guarded. */
export async function ensureSeed(): Promise<void> {
  // 1. Quick phrases (idempotent on modality+region+label)
  const phraseCount = await db.quickPhrase.count();
  if (phraseCount === 0) {
    await db.quickPhrase.createMany({ data: PHRASE_SEEDS });
  } else {
    // Drift sync: back-fill phrases added after first boot (e.g. joint
    // regions from the doctor's format library). Fast probe first so
    // steady-state cost is one query.
    const probe = await db.quickPhrase.findUnique({
      where: { modality_region_label: { modality: "USG", region: "USG Whole Abdomen", label: "Fatty liver Gr I" } },
    });
    if (!probe) {
      for (const p of PHRASE_SEEDS) {
        const ex = await db.quickPhrase.findUnique({
          where: { modality_region_label: { modality: p.modality, region: p.region, label: p.label } },
        });
        if (!ex) {
          await db.quickPhrase.create({ data: p });
        } else if ((ex.titleFragment ?? null) !== (p.titleFragment ?? null)) {
          await db.quickPhrase.update({
            where: { id: ex.id },
            data: { titleFragment: p.titleFragment ?? null },
          });
        }
      }
    }
  }
  // 2. Complete report formats — create-if-missing AND drift-sync builtin
  //    rowsJson (builtin formats are seed-owned; user formats keep isBuiltin=false).
  for (const f of FORMAT_SEEDS) {
    const rowsJson = JSON.stringify(f.rows);
    const ex = await db.reportFormat.findUnique({ where: { key: f.key } });
    if (!ex) {
      await db.reportFormat.create({
        data: {
          key: f.key,
          modality: f.modality,
          region: f.region,
          name: f.name,
          studyTitle: f.studyTitle,
          titleSuffix: f.titleSuffix,
          technique: f.technique,
          recommendation: f.recommendation,
          rowsJson,
          isNormal: f.isNormal,
          isBuiltin: true,
          sortOrder: f.sortOrder,
        },
      });
    } else if (ex.isBuiltin && (ex.rowsJson !== rowsJson || ex.titleSuffix !== f.titleSuffix || ex.name !== f.name)) {
      await db.reportFormat.update({
        where: { id: ex.id },
        data: {
          name: f.name,
          studyTitle: f.studyTitle,
          titleSuffix: f.titleSuffix,
          technique: f.technique,
          recommendation: f.recommendation,
          rowsJson,
          isNormal: f.isNormal,
          sortOrder: f.sortOrder,
        },
      });
    }
  }
  // Retire builtin formats whose key left the seed library (e.g. the generic
  // CT formats replaced by the doctor's own CT library). Reports already
  // referencing a retired key keep it — the format just stops being builtin.
  const seedKeys = FORMAT_SEEDS.map((f) => f.key);
  const stale = await db.reportFormat.findMany({
    where: { isBuiltin: true, key: { notIn: seedKeys } },
    select: { id: true, key: true },
  });
  for (const st of stale) {
    const used = await db.report.findFirst({ where: { formatKey: st.key }, select: { id: true } });
    if (used) {
      await db.reportFormat.update({ where: { id: st.id }, data: { isBuiltin: false } });
    } else {
      await db.reportFormat.delete({ where: { id: st.id } });
    }
  }
  // 3. Technique templates — create-if-missing for each seed region
  for (const t of TECHNIQUE_SEEDS) {
    const ex = await db.techniqueTemplate.findUnique({
      where: { modality_region: { modality: t.modality, region: t.region } },
    });
    if (!ex) {
      await db.techniqueTemplate.create({ data: t });
    }
  }
  // 4. Hospital defaults (only fill blanks — never overwrite user edits)
  const s = await db.hospitalSettings.findUnique({ where: { id: "singleton" } });
  if (!s) {
    await db.hospitalSettings.create({
      data: {
        id: "singleton",
        appTitle: "CARE Reporting Studio",
        hospitalName: "CARE Diagnostics",
        addressLine: "Civil Line Road, Deoghar, Jharkhand",
        phone: "+91 00000 00000",
        footerMessage: "This report is electronically generated.",
        radiologistName: "Dr. Abinash",
        // Demo PIN so the lock screen is explorable immediately; change in Settings.
        pinHash: hashPin("123456"),
      },
    });
  }
  // 5. Demo orders (skip entirely if any exist)
  const orderCount = await db.careOrderLink.count();
  if (orderCount === 0) {
    for (const o of [...DEMO_ORDERS, ...DEMO_REPORTED]) {
      await db.careOrderLink.create({
        data: {
          accessionNumber: o.accession,
          patientName: o.name,
          patientAge: o.age,
          patientGender: o.sex,
          patientMrn: o.mrn ?? null,
          referringDoctor: o.referrer,
          testName: o.test,
          modality: o.modality,
          bodyRegion: o.region,
          studyInstanceUid: o.uid ?? null,
          billingStatus: o.billing ?? null,
          billingUpdatedAt: o.billing ? new Date() : null,
          studyDate: o.studyDate,
          status: o.status,
        },
      });
    }
    // 6. One demo finalized report with findings (for Library + print demo)
    const rep = await db.careOrderLink.findUnique({ where: { accessionNumber: "CARE-24077" } });
    if (rep) {
      const created = await db.report.create({
        data: {
          orderId: rep.id,
          technique: TECHNIQUE_SEEDS[0].text,
          impression: "1. L4-L5 broad-based disc bulge with mild central canal stenosis.\n2. Mild facet arthropathy at L4-L5 with ligamentum flavum hypertrophy.",
          recommendation: "Correlate clinically. Physiotherapy advice.",
          status: "FINALIZED",
          finalizedAt: new Date(Date.now() - 1 * DAYS),
        },
      });
      await db.findingRow.createMany({
        data: [
          { reportId: created.id, region: "LS Spine", concept: "disc_contour", level: "L4-L5", text: "At L4-L5, a broad-based disc bulge is present.", sortOrder: 1 },
          { reportId: created.id, region: "LS Spine", concept: "canal_stenosis", level: "L4-L5", severity: "mild", text: "At L4-L5, there is mild central canal stenosis.", sortOrder: 2 },
          { reportId: created.id, region: "LS Spine", concept: "facet_joint", level: "L4-L5", text: "Facet arthropathy is noted at L4-L5.", sortOrder: 3 },
          { reportId: created.id, region: "LS Spine", concept: "ligamentum_flavum", level: "L4-L5", text: "Ligamentum flavum hypertrophy is noted at L4-L5.", sortOrder: 4 },
        ],
      });
    }
  }
}
