// ===== CARE AI Sonologist Companion™ — Mock Data =====
import type {
  Patient, Study, Measurement, Report, AiSuggestion,
  KeyImage, DicomImage, Series, PcpndtFormData, GrowthDataPoint,
  ChecklistItem, ReportQAItem, ExtractionProgress,
} from './types';

// ===== Patients =====
export const mockPatients: Patient[] = [
  { id: 'p1', name: 'Priya Sharma', age: 28, sex: 'F', phone: '9876543210', uhid: 'CD-2024-00145', referringDoctor: 'Dr. Mehta' },
  { id: 'p2', name: 'Anita Gupta', age: 32, sex: 'F', phone: '9876543211', uhid: 'CD-2024-00203', referringDoctor: 'Dr. Patel' },
  { id: 'p3', name: 'Kavita Singh', age: 25, sex: 'F', phone: '9876543212', uhid: 'CD-2024-00317', referringDoctor: 'Dr. Kumar' },
  { id: 'p4', name: 'Ritu Verma', age: 30, sex: 'F', phone: '9876543213', uhid: 'CD-2024-00422', referringDoctor: 'Dr. Mehta' },
  { id: 'p5', name: 'Sunita Devi', age: 35, sex: 'F', phone: '9876543214', uhid: 'CD-2024-00501', referringDoctor: 'Dr. Shah' },
  { id: 'p6', name: 'Meera Joshi', age: 27, sex: 'F', phone: '9876543215', uhid: 'CD-2024-00610', referringDoctor: 'Dr. Patel' },
  { id: 'p7', name: 'Pooja Reddy', age: 29, sex: 'F', phone: '9876543216', uhid: 'CD-2024-00725', referringDoctor: 'Dr. Kumar' },
  { id: 'p8', name: 'Asha Nair', age: 33, sex: 'F', phone: '9876543217', uhid: 'CD-2024-00839', referringDoctor: 'Dr. Shah' },
];

// ===== Dicom Images (mock) =====
const createImages = (prefix: string, count: number): DicomImage[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-img-${i}`,
    sopUid: `${prefix}-sop-${i}`,
    instanceNumber: i + 1,
    imageType: ['BPD', 'HC', 'AC', 'FL', 'PLACENTA', 'CERVIX', 'DOPPLER', 'BODY', 'SPINE', 'HEART'][i % 10],
    qualityScore: 0.7 + Math.random() * 0.3,
    aiLabel: ['Fetal Head', 'Fetal Head', 'Fetal Abdomen', 'Fetal Femur', 'Placenta', 'Cervix', 'Umbilical Artery Doppler', 'Fetal Body', 'Fetal Spine', 'Fetal Heart'][i % 10],
    isKeyImage: i < 4,
    isApproved: i < 2,
    frameNumber: i + 1,
  }));

// ===== Series =====
const createSeries = (studyId: string, prefix: string): Series[] => [
  { id: `${prefix}-s1`, seriesUid: `${prefix}-su-1`, seriesDesc: 'Fetal Biometry', seriesNumber: 1, modality: 'US', images: createImages(prefix, 6) },
  { id: `${prefix}-s2`, seriesUid: `${prefix}-su-2`, seriesDesc: 'Doppler', seriesNumber: 2, modality: 'US', images: createImages(`${prefix}-d`, 4) },
  { id: `${prefix}-s3`, seriesUid: `${prefix}-su-3`, seriesDesc: 'Anatomy Survey', seriesNumber: 3, modality: 'US', images: createImages(`${prefix}-a`, 8) },
];

// ===== Measurements =====
const obMeasurements: Measurement[] = [
  { id: 'm1', studyId: 's1', name: 'BPD', value: 82.3, unit: 'mm', category: 'OB', gestationalAge: '32w2d', percentile: 55, source: 'dicom_sr', confidence: 0.98, isVerified: false, isEdited: false },
  { id: 'm2', studyId: 's1', name: 'HC', value: 298.5, unit: 'mm', category: 'OB', gestationalAge: '32w1d', percentile: 60, source: 'dicom_sr', confidence: 0.97, isVerified: false, isEdited: false },
  { id: 'm3', studyId: 's1', name: 'AC', value: 278.2, unit: 'mm', category: 'OB', gestationalAge: '32w0d', percentile: 50, source: 'dicom_sr', confidence: 0.96, isVerified: false, isEdited: false },
  { id: 'm4', studyId: 's1', name: 'FL', value: 60.1, unit: 'mm', category: 'OB', gestationalAge: '32w3d', percentile: 58, source: 'dicom_sr', confidence: 0.97, isVerified: false, isEdited: false },
  { id: 'm5', studyId: 's1', name: 'HL', value: 54.8, unit: 'mm', category: 'OB', gestationalAge: '32w1d', percentile: 55, source: 'ge_private', confidence: 0.92, isVerified: false, isEdited: false },
  { id: 'm6', studyId: 's1', name: 'EFW', value: 1820, unit: 'g', category: 'OB', gestationalAge: '', percentile: 52, source: 'ai', confidence: 0.90, isVerified: false, isEdited: false },
  { id: 'm7', studyId: 's1', name: 'GA', value: 32.2, unit: 'wks', category: 'OB', source: 'ai', confidence: 0.95, isVerified: false, isEdited: false },
  { id: 'm8', studyId: 's1', name: 'AFI', value: 14.2, unit: 'cm', category: 'OB', source: 'dicom_tag', confidence: 0.88, isVerified: false, isEdited: false },
  { id: 'm9', studyId: 's1', name: 'FHR', value: 142, unit: 'bpm', category: 'OB', source: 'dicom_sr', confidence: 0.99, isVerified: false, isEdited: false },
  { id: 'm10', studyId: 's1', name: 'Placenta Location', value: 0, unit: '', category: 'PLACENTA', source: 'ai', confidence: 0.85, isVerified: false, isEdited: false, notes: 'Posterior, Grade II' },
  { id: 'm11', studyId: 's1', name: 'Placenta Grade', value: 2, unit: '', category: 'PLACENTA', source: 'ai', confidence: 0.82, isVerified: false, isEdited: false },
  { id: 'm12', studyId: 's1', name: 'Presentation', value: 0, unit: '', category: 'PRESENTATION', source: 'ai', confidence: 0.88, isVerified: false, isEdited: false, notes: 'Cephalic' },
  { id: 'm13', studyId: 's1', name: 'UA PI', value: 1.05, unit: '', category: 'DOPPLER', source: 'dicom_sr', confidence: 0.96, isVerified: false, isEdited: false },
  { id: 'm14', studyId: 's1', name: 'UA RI', value: 0.58, unit: '', category: 'DOPPLER', source: 'dicom_sr', confidence: 0.95, isVerified: false, isEdited: false },
  { id: 'm15', studyId: 's1', name: 'UA S/D', value: 2.38, unit: '', category: 'DOPPLER', source: 'dicom_sr', confidence: 0.94, isVerified: false, isEdited: false },
  { id: 'm16', studyId: 's1', name: 'MCA PI', value: 1.72, unit: '', category: 'DOPPLER', source: 'dicom_sr', confidence: 0.93, isVerified: false, isEdited: false },
  { id: 'm17', studyId: 's1', name: 'MCA PSV', value: 48.5, unit: 'cm/s', category: 'DOPPLER', source: 'dicom_sr', confidence: 0.91, isVerified: false, isEdited: false },
];

const pelvisMeasurements: Measurement[] = [
  { id: 'pm1', studyId: 's2', name: 'Uterus Length', value: 78, unit: 'mm', category: 'PELVIS', source: 'dicom_sr', confidence: 0.95, isVerified: false, isEdited: false },
  { id: 'pm2', studyId: 's2', name: 'Uterus Width', value: 52, unit: 'mm', category: 'PELVIS', source: 'dicom_sr', confidence: 0.94, isVerified: false, isEdited: false },
  { id: 'pm3', studyId: 's2', name: 'Uterus AP', value: 41, unit: 'mm', category: 'PELVIS', source: 'dicom_sr', confidence: 0.93, isVerified: false, isEdited: false },
  { id: 'pm4', studyId: 's2', name: 'Endometrium', value: 8.5, unit: 'mm', category: 'PELVIS', source: 'dicom_sr', confidence: 0.96, isVerified: false, isEdited: false },
  { id: 'pm5', studyId: 's2', name: 'RT Ovary', value: 32, unit: 'mm', category: 'PELVIS', source: 'dicom_sr', confidence: 0.92, isVerified: false, isEdited: false },
  { id: 'pm6', studyId: 's2', name: 'LT Ovary', value: 30, unit: 'mm', category: 'PELVIS', source: 'dicom_sr', confidence: 0.91, isVerified: false, isEdited: false },
  { id: 'pm7', studyId: 's2', name: 'Follicles RT', value: 12, unit: 'mm', category: 'PELVIS', source: 'ai', confidence: 0.85, isVerified: false, isEdited: false },
  { id: 'pm8', studyId: 's2', name: 'Follicles LT', value: 10, unit: 'mm', category: 'PELVIS', source: 'ai', confidence: 0.84, isVerified: false, isEdited: false },
  { id: 'pm9', studyId: 's2', name: 'POD', value: 0, unit: '', category: 'PELVIS', source: 'ai', confidence: 0.88, isVerified: false, isEdited: false, notes: 'No free fluid' },
];

const abdomenMeasurements: Measurement[] = [
  { id: 'am1', studyId: 's5', name: 'Liver', value: 142, unit: 'mm', category: 'ABDOMEN', source: 'dicom_sr', confidence: 0.95, isVerified: false, isEdited: false },
  { id: 'am2', studyId: 's5', name: 'Portal Vein', value: 10.5, unit: 'mm', category: 'ABDOMEN', source: 'dicom_sr', confidence: 0.94, isVerified: false, isEdited: false },
  { id: 'am3', studyId: 's5', name: 'CBD', value: 4.2, unit: 'mm', category: 'ABDOMEN', source: 'dicom_sr', confidence: 0.93, isVerified: false, isEdited: false },
  { id: 'am4', studyId: 's5', name: 'Gall Bladder', value: 68, unit: 'mm', category: 'ABDOMEN', source: 'dicom_sr', confidence: 0.92, isVerified: false, isEdited: false },
  { id: 'am5', studyId: 's5', name: 'Pancreas', value: 18, unit: 'mm', category: 'ABDOMEN', source: 'ge_private', confidence: 0.88, isVerified: false, isEdited: false },
  { id: 'am6', studyId: 's5', name: 'Spleen', value: 105, unit: 'mm', category: 'ABDOMEN', source: 'dicom_sr', confidence: 0.95, isVerified: false, isEdited: false },
  { id: 'am7', studyId: 's5', name: 'RT Kidney', value: 108, unit: 'mm', category: 'ABDOMEN', source: 'dicom_sr', confidence: 0.96, isVerified: false, isEdited: false },
  { id: 'am8', studyId: 's5', name: 'LT Kidney', value: 112, unit: 'mm', category: 'ABDOMEN', source: 'dicom_sr', confidence: 0.95, isVerified: false, isEdited: false },
  { id: 'am9', studyId: 's5', name: 'Bladder', value: 0, unit: '', category: 'ABDOMEN', source: 'ai', confidence: 0.85, isVerified: false, isEdited: false, notes: 'Well distended, wall normal' },
  { id: 'am10', studyId: 's5', name: 'Aorta', value: 18, unit: 'mm', category: 'ABDOMEN', source: 'dicom_tag', confidence: 0.90, isVerified: false, isEdited: false },
];

// ===== AI Suggestions =====
const obSuggestions: AiSuggestion[] = [
  { id: 'as1', studyId: 's1', category: 'finding', message: 'Placenta appears posterior, Grade II. Appropriate for gestational age.', severity: 'info', isDismissed: false, source: 'image' },
  { id: 'as2', studyId: 's1', category: 'finding', message: 'Fetal growth is appropriate. All biometric measurements are within normal limits.', severity: 'info', isDismissed: false, source: 'measurement' },
  { id: 'as3', studyId: 's1', category: 'finding', message: 'Doppler indices within normal range. UA PI 1.05, MCA PI 1.72.', severity: 'info', isDismissed: false, source: 'measurement' },
  { id: 'as4', studyId: 's1', category: 'missing', message: 'Cervical length measurement not captured. Consider documenting if clinically indicated.', severity: 'warning', isDismissed: false, source: 'checklist' },
  { id: 'as5', studyId: 's1', category: 'finding', message: 'AFI 14.2 cm — within normal limits (8-24 cm).', severity: 'info', isDismissed: false, source: 'measurement' },
  { id: 'as6', studyId: 's1', category: 'quality', message: 'BPD image quality excellent. Calliper placement verified by AI.', severity: 'info', isDismissed: false, source: 'qa' },
  { id: 'as7', studyId: 's1', category: 'quality', message: 'AC measurement image may benefit from slight re-magnification.', severity: 'warning', isDismissed: false, source: 'qa' },
];

// ===== Key Images =====
const obKeyImages: KeyImage[] = [
  { id: 'ki1', studyId: 's1', category: 'BPD', rank: 1, isApproved: true, aiScore: 0.96 },
  { id: 'ki2', studyId: 's1', category: 'HC', rank: 1, isApproved: true, aiScore: 0.95 },
  { id: 'ki3', studyId: 's1', category: 'AC', rank: 1, isApproved: false, aiScore: 0.88 },
  { id: 'ki4', studyId: 's1', category: 'FL', rank: 1, isApproved: true, aiScore: 0.94 },
  { id: 'ki5', studyId: 's1', category: 'PLACENTA', rank: 1, isApproved: false, aiScore: 0.85 },
  { id: 'ki6', studyId: 's1', category: 'UA DOPPLER', rank: 1, isApproved: true, aiScore: 0.92 },
];

// ===== Reports =====
const obReport: Report = {
  id: 'r1', studyId: 's1',
  clinicalInfo: 'Primigravida, 32 weeks POG. Referred for routine growth assessment.',
  findings: `Single live intrauterine fetus seen in cephalic presentation.\n\nFetal Biometry:\n• BPD: 82.3 mm (32w2d, 55th percentile)\n• HC: 298.5 mm (32w1d, 60th percentile)\n• AC: 278.2 mm (32w0d, 50th percentile)\n• FL: 60.1 mm (32w3d, 58th percentile)\n• HL: 54.8 mm (32w1d, 55th percentile)\n\nEstimated Fetal Weight: 1820 g (52nd percentile)\nGestational Age: 32 weeks 2 days\nFetal Heart Rate: 142 bpm — regular\n\nPlacenta: Posterior, Grade II\nAmniotic Fluid: AFI 14.2 cm — adequate\n\nDoppler:\n• Umbilical Artery: PI 1.05, RI 0.58, S/D 2.38\n• MCA: PI 1.72, PSV 48.5 cm/s\n\nFetal anatomy survey appears adequate. No obvious gross abnormality detected.`,
  impression: `• Single live intrauterine fetus, cephalic presentation.\n• Gestational age approximately 32 weeks 2 days.\n• Fetal growth appropriate for gestational age (all parameters 50-60th percentile).\n• Estimated fetal weight 1820 g.\n• Placenta posterior, Grade II — normal for gestation.\n• Amniotic fluid adequate.\n• Doppler studies within normal limits.\n• No obvious fetal anomaly detected on this scan.`,
  recommendation: 'Repeat scan in 4 weeks for growth assessment. Continue routine antenatal care as per obstetrician.',
  technique: 'Transabdominal ultrasound, GE Voluson E9.',
  comparison: 'Compared with previous scan dated 28 weeks — appropriate interval growth noted.',
  reportStatus: 'draft',
};

const pelvisReport: Report = {
  id: 'r2', studyId: 's2',
  clinicalInfo: 'Irregular menstrual cycles. Referred for pelvic evaluation.',
  findings: `Uterus: Normal size (78 × 52 × 41 mm), anteverted, normal echotexture.\nEndometrium: 8.5 mm, homogeneous, trilaminar pattern noted.\nRight Ovary: 32 × 25 mm, normal echotexture. Dominant follicle 12 mm.\nLeft Ovary: 30 × 22 mm, normal echotexture. Dominant follicle 10 mm.\nPouch of Douglas: No free fluid.`,
  impression: `• Normal sized uterus with anteverted position.\n• Endometrium 8.5 mm — appears normal.\n• Both ovaries normal in size and echotexture.\n• No adnexal mass or free fluid.`,
  recommendation: 'Correlate with clinical findings and hormonal profile.',
  technique: 'Transabdominal and transvaginal ultrasound, GE Voluson E9.',
  reportStatus: 'draft',
};

// ===== Studies =====
export const mockStudies: Study[] = [
  {
    id: 's1', studyUid: '1.2.840.113619.2.55.3.001', studyDate: '2025-01-15T10:30:00Z',
    studyType: 'OB', studyDesc: 'Obstetric Scan - Growth Assessment', machine: 'GE Voluson E9',
    status: 'reporting', patientId: 'p1', patient: mockPatients[0],
    series: createSeries('s1', 's1'), measurements: obMeasurements, report: obReport,
    aiSuggestions: obSuggestions, keyImages: obKeyImages,
  },
  {
    id: 's2', studyUid: '1.2.840.113619.2.55.3.002', studyDate: '2025-01-15T11:15:00Z',
    studyType: 'PELVIS', studyDesc: 'Pelvis - Routine Evaluation', machine: 'GE Voluson E9',
    status: 'in-progress', patientId: 'p2', patient: mockPatients[1],
    series: createSeries('s2', 's2'), measurements: pelvisMeasurements, report: pelvisReport,
    aiSuggestions: [
      { id: 'as-p1', studyId: 's2', category: 'finding', message: 'Uterus normal in size and position.', severity: 'info', isDismissed: false, source: 'measurement' },
      { id: 'as-p2', studyId: 's2', category: 'finding', message: 'Endometrium 8.5 mm with trilaminar pattern — normal proliferative phase appearance.', severity: 'info', isDismissed: false, source: 'image' },
      { id: 'as-p3', studyId: 's2', category: 'finding', message: 'Both ovaries normal. No adnexal pathology.', severity: 'info', isDismissed: false, source: 'measurement' },
    ],
    keyImages: [
      { id: 'ki-p1', studyId: 's2', category: 'UTERUS', rank: 1, isApproved: true, aiScore: 0.93 },
      { id: 'ki-p2', studyId: 's2', category: 'ENDOMETRIUM', rank: 1, isApproved: false, aiScore: 0.88 },
      { id: 'ki-p3', studyId: 's2', category: 'RT OVARY', rank: 1, isApproved: true, aiScore: 0.91 },
      { id: 'ki-p4', studyId: 's2', category: 'LT OVARY', rank: 1, isApproved: false, aiScore: 0.89 },
    ],
  },
  {
    id: 's3', studyUid: '1.2.840.113619.2.55.3.003', studyDate: '2025-01-15T12:00:00Z',
    studyType: 'OB', studyDesc: 'Obstetric Scan - First Trimester', machine: 'GE Voluson E9',
    status: 'pending', patientId: 'p3', patient: mockPatients[2],
    series: createSeries('s3', 's3'),
    measurements: [
      { id: 'm-1t1', studyId: 's3', name: 'CRL', value: 23.5, unit: 'mm', category: 'OB', gestationalAge: '9w3d', source: 'dicom_sr', confidence: 0.97, isVerified: false, isEdited: false },
      { id: 'm-1t2', studyId: 's3', name: 'GS', value: 31.2, unit: 'mm', category: 'OB', source: 'dicom_sr', confidence: 0.96, isVerified: false, isEdited: false },
      { id: 'm-1t3', studyId: 's3', name: 'Yolk Sac', value: 3.8, unit: 'mm', category: 'OB', source: 'dicom_sr', confidence: 0.95, isVerified: false, isEdited: false },
      { id: 'm-1t4', studyId: 's3', name: 'FHR', value: 168, unit: 'bpm', category: 'OB', source: 'dicom_sr', confidence: 0.99, isVerified: false, isEdited: false },
      { id: 'm-1t5', studyId: 's3', name: 'GA', value: 9.4, unit: 'wks', category: 'OB', source: 'ai', confidence: 0.94, isVerified: false, isEdited: false },
    ],
    aiSuggestions: [
      { id: 'as-1t1', studyId: 's3', category: 'finding', message: 'Single live intrauterine gestation. CRL 23.5 mm corresponds to 9w3d.', severity: 'info', isDismissed: false, source: 'measurement' },
      { id: 'as-1t2', studyId: 's3', category: 'finding', message: 'Yolk sac and cardiac activity present. Normal early pregnancy.', severity: 'info', isDismissed: false, source: 'image' },
      { id: 'as-1t3', studyId: 's3', category: 'missing', message: 'NT measurement not captured. If between 11-13w6d, consider NT assessment.', severity: 'warning', isDismissed: false, source: 'checklist' },
    ],
    report: {
      id: 'r3', studyId: 's3', findings: '', impression: '', reportStatus: 'draft',
      clinicalInfo: 'Primigravida, LMP uncertain. Referred for dating scan.',
    },
  },
  {
    id: 's4', studyUid: '1.2.840.113619.2.55.3.004', studyDate: '2025-01-15T13:30:00Z',
    studyType: 'ABDOMEN', studyDesc: 'Abdomen - Complete', machine: 'GE Voluson E9',
    status: 'pending', patientId: 'p4', patient: mockPatients[3],
    series: createSeries('s4', 's4'), measurements: abdomenMeasurements,
    aiSuggestions: [
      { id: 'as-a1', studyId: 's4', category: 'finding', message: 'Liver normal in size and echotexture. No focal lesion.', severity: 'info', isDismissed: false, source: 'image' },
      { id: 'as-a2', studyId: 's4', category: 'finding', message: 'Gall bladder normal. No stones.', severity: 'info', isDismissed: false, source: 'image' },
      { id: 'as-a3', studyId: 's4', category: 'finding', message: 'Both kidneys normal. No hydronephrosis or calculus.', severity: 'info', isDismissed: false, source: 'image' },
      { id: 'as-a4', studyId: 's4', category: 'finding', message: 'Pancreas and spleen appear normal.', severity: 'info', isDismissed: false, source: 'image' },
    ],
    report: {
      id: 'r4', studyId: 's4', findings: '', impression: '', reportStatus: 'draft',
      clinicalInfo: 'Pain abdomen. Referred for complete abdominal evaluation.',
    },
  },
  {
    id: 's5', studyUid: '1.2.840.113619.2.55.3.005', studyDate: '2025-01-15T14:00:00Z',
    studyType: 'OB', studyDesc: 'Obstetric Scan - Anomaly Scan', machine: 'GE Voluson E9',
    status: 'pending', patientId: 'p5', patient: mockPatients[4],
    series: createSeries('s5', 's5'),
    measurements: [
      { id: 'm-a1', studyId: 's5', name: 'BPD', value: 52.1, unit: 'mm', category: 'OB', gestationalAge: '22w0d', percentile: 50, source: 'dicom_sr', confidence: 0.97, isVerified: false, isEdited: false },
      { id: 'm-a2', studyId: 's5', name: 'HC', value: 195.3, unit: 'mm', category: 'OB', gestationalAge: '22w1d', percentile: 52, source: 'dicom_sr', confidence: 0.96, isVerified: false, isEdited: false },
      { id: 'm-a3', studyId: 's5', name: 'AC', value: 175.8, unit: 'mm', category: 'OB', gestationalAge: '22w0d', percentile: 48, source: 'dicom_sr', confidence: 0.95, isVerified: false, isEdited: false },
      { id: 'm-a4', studyId: 's5', name: 'FL', value: 37.2, unit: 'mm', category: 'OB', gestationalAge: '22w1d', percentile: 51, source: 'dicom_sr', confidence: 0.96, isVerified: false, isEdited: false },
      { id: 'm-a5', studyId: 's5', name: 'NT', value: 1.8, unit: 'mm', category: 'OB', source: 'dicom_sr', confidence: 0.94, isVerified: false, isEdited: false },
      { id: 'm-a6', studyId: 's5', name: 'EFW', value: 520, unit: 'g', category: 'OB', percentile: 50, source: 'ai', confidence: 0.90, isVerified: false, isEdited: false },
      { id: 'm-a7', studyId: 's5', name: 'FHR', value: 148, unit: 'bpm', category: 'OB', source: 'dicom_sr', confidence: 0.99, isVerified: false, isEdited: false },
      { id: 'm-a8', studyId: 's5', name: 'AFI', value: 15.8, unit: 'cm', category: 'OB', source: 'dicom_tag', confidence: 0.89, isVerified: false, isEdited: false },
    ],
    aiSuggestions: [
      { id: 'as-an1', studyId: 's5', category: 'finding', message: 'Anomaly scan in progress. NT 1.8 mm — within normal limits.', severity: 'info', isDismissed: false, source: 'measurement' },
      { id: 'as-an2', studyId: 's5', category: 'missing', message: 'Detailed cardiac views, spine, and facial profile not yet documented.', severity: 'warning', isDismissed: false, source: 'checklist' },
      { id: 'as-an3', studyId: 's5', category: 'quality', message: 'Consider capturing four-chamber view of the heart.', severity: 'warning', isDismissed: false, source: 'qa' },
    ],
    report: {
      id: 'r5', studyId: 's5', findings: '', impression: '', reportStatus: 'draft',
      clinicalInfo: 'G2P1L1, 22 weeks POG. Referred for anomaly scan.',
    },
  },
  {
    id: 's6', studyUid: '1.2.840.113619.2.55.3.006', studyDate: '2025-01-14T09:00:00Z',
    studyType: 'THYROID', studyDesc: 'Thyroid - Routine', machine: 'GE Voluson E9',
    status: 'signed', patientId: 'p6', patient: mockPatients[5],
    series: createSeries('s6', 's6'),
    measurements: [
      { id: 'm-t1', studyId: 's6', name: 'RT Lobe', value: 48, unit: 'mm', category: 'THYROID', source: 'dicom_sr', confidence: 0.96, isVerified: true, isEdited: false },
      { id: 'm-t2', studyId: 's6', name: 'LT Lobe', value: 45, unit: 'mm', category: 'THYROID', source: 'dicom_sr', confidence: 0.95, isVerified: true, isEdited: false },
      { id: 'm-t3', studyId: 's6', name: 'Isthmus', value: 3.5, unit: 'mm', category: 'THYROID', source: 'dicom_sr', confidence: 0.94, isVerified: true, isEdited: false },
    ],
    report: {
      id: 'r6', studyId: 's6',
      clinicalInfo: 'Neck swelling. Referred for thyroid evaluation.',
      findings: 'Thyroid gland normal in size and echotexture. Right lobe 48 × 18 × 15 mm. Left lobe 45 × 17 × 14 mm. Isthmus 3.5 mm. No focal lesion. No cervical lymphadenopathy.',
      impression: 'Normal thyroid gland.',
      recommendation: 'Correlate with thyroid function tests.',
      technique: 'High-resolution neck ultrasound, GE Voluson E9, linear probe.',
      reportStatus: 'signed', signedBy: 'Dr. Sugandha', signedAt: '2025-01-14T10:30:00Z',
    },
  },
  {
    id: 's7', studyUid: '1.2.840.113619.2.55.3.007', studyDate: '2025-01-14T11:00:00Z',
    studyType: 'OB', studyDesc: 'Obstetric - NT Scan', machine: 'GE Voluson E9',
    status: 'signed', patientId: 'p7', patient: mockPatients[6],
    series: createSeries('s7', 's7'),
    measurements: [
      { id: 'm-n1', studyId: 's7', name: 'CRL', value: 58.2, unit: 'mm', category: 'OB', gestationalAge: '12w1d', source: 'dicom_sr', confidence: 0.98, isVerified: true, isEdited: false },
      { id: 'm-n2', studyId: 's7', name: 'NT', value: 1.5, unit: 'mm', category: 'OB', source: 'dicom_sr', confidence: 0.97, isVerified: true, isEdited: false },
      { id: 'm-n3', studyId: 's7', name: 'GS', value: 62.3, unit: 'mm', category: 'OB', source: 'dicom_sr', confidence: 0.96, isVerified: true, isEdited: false },
      { id: 'm-n4', studyId: 's7', name: 'FHR', value: 162, unit: 'bpm', category: 'OB', source: 'dicom_sr', confidence: 0.99, isVerified: true, isEdited: false },
      { id: 'm-n5', studyId: 's7', name: 'Yolk Sac', value: 4.2, unit: 'mm', category: 'OB', source: 'dicom_sr', confidence: 0.95, isVerified: true, isEdited: false },
    ],
    report: {
      id: 'r7', studyId: 's7',
      clinicalInfo: 'Primigravida, 12 weeks by dates. Referred for NT scan.',
      findings: 'Single live intrauterine gestation. CRL 58.2 mm — 12w1d. NT 1.5 mm — within normal limits. Nasal bone present. FHR 162 bpm — regular. Yolk sac 4.2 mm — normal.',
      impression: '• Single live intrauterine fetus, 12w1d.\n• NT 1.5 mm — within normal limits (< 2.5 mm).\n• Nasal bone present.\n• Normal early pregnancy.',
      recommendation: 'Combined first trimester screening recommended. Anomaly scan at 18-20 weeks.',
      technique: 'Transabdominal ultrasound, GE Voluson E9.',
      reportStatus: 'signed', signedBy: 'Dr. Sugandha', signedAt: '2025-01-14T12:15:00Z',
    },
  },
  {
    id: 's8', studyUid: '1.2.840.113619.2.55.3.008', studyDate: '2025-01-13T15:00:00Z',
    studyType: 'DOPPLER', studyDesc: 'Doppler - Obstetric', machine: 'GE Voluson E9',
    status: 'signed', patientId: 'p8', patient: mockPatients[7],
    series: createSeries('s8', 's8'),
    measurements: [
      { id: 'm-d1', studyId: 's8', name: 'UA PI', value: 1.32, unit: '', category: 'DOPPLER', source: 'dicom_sr', confidence: 0.97, isVerified: true, isEdited: false },
      { id: 'm-d2', studyId: 's8', name: 'UA RI', value: 0.64, unit: '', category: 'DOPPLER', source: 'dicom_sr', confidence: 0.96, isVerified: true, isEdited: false },
      { id: 'm-d3', studyId: 's8', name: 'UA S/D', value: 2.78, unit: '', category: 'DOPPLER', source: 'dicom_sr', confidence: 0.96, isVerified: true, isEdited: false },
      { id: 'm-d4', studyId: 's8', name: 'MCA PI', value: 1.85, unit: '', category: 'DOPPLER', source: 'dicom_sr', confidence: 0.95, isVerified: true, isEdited: false },
      { id: 'm-d5', studyId: 's8', name: 'MCA PSV', value: 52.3, unit: 'cm/s', category: 'DOPPLER', source: 'dicom_sr', confidence: 0.94, isVerified: true, isEdited: false },
      { id: 'm-d6', studyId: 's8', name: 'UtA RI', value: 0.52, unit: '', category: 'DOPPLER', source: 'dicom_sr', confidence: 0.93, isVerified: true, isEdited: false },
      { id: 'm-d7', studyId: 's8', name: 'UtA PI', value: 0.85, unit: '', category: 'DOPPLER', source: 'dicom_sr', confidence: 0.93, isVerified: true, isEdited: false },
    ],
    report: {
      id: 'r8', studyId: 's8',
      clinicalInfo: 'G3P2L2, 36 weeks POG. Decreased fetal movements. Referred for Doppler evaluation.',
      findings: 'Umbilical Artery: PI 1.32, RI 0.64, S/D 2.78 — within normal limits. MCA: PI 1.85, PSV 52.3 cm/s — within normal limits. Cerebro-placental ratio normal. Uterine Arteries: Bilateral PI < 1.0 — normal. No notching.',
      impression: '• Doppler studies within normal limits for 36 weeks gestation.\n• No evidence of fetal compromise on Doppler.\n• Normal uterine artery waveforms bilaterally.',
      recommendation: 'Continue monitoring. CTG recommended.',
      technique: 'Color Doppler ultrasound, GE Voluson E9.',
      reportStatus: 'signed', signedBy: 'Dr. Sugandha', signedAt: '2025-01-13T16:30:00Z',
    },
  },
];

// ===== Growth Data (for pregnancy dashboard) =====
export const mockGrowthData: GrowthDataPoint[] = [
  { gestationalAge: 12, value: 58.2, percentile5: 42, percentile50: 58, percentile95: 74, date: '2024-10-20', studyId: 'prev-1' },
  { gestationalAge: 18, value: 42.5, percentile5: 32, percentile50: 42, percentile95: 52, date: '2024-12-01', studyId: 'prev-2' },
  { gestationalAge: 24, value: 58.8, percentile5: 50, percentile50: 60, percentile95: 70, date: '2024-12-28', studyId: 'prev-3' },
  { gestationalAge: 28, value: 72.1, percentile5: 60, percentile50: 72, percentile95: 84, date: '2025-01-05', studyId: 'prev-4' },
  { gestationalAge: 32.2, value: 82.3, percentile5: 68, percentile50: 82, percentile95: 96, date: '2025-01-15', studyId: 's1' },
];

export const mockAfiTrend = [
  { gestationalAge: 12, value: 12.5, date: '2024-10-20' },
  { gestationalAge: 18, value: 13.8, date: '2024-12-01' },
  { gestationalAge: 24, value: 14.5, date: '2024-12-28' },
  { gestationalAge: 28, value: 13.2, date: '2025-01-05' },
  { gestationalAge: 32.2, value: 14.2, date: '2025-01-15' },
];

export const mockEfwTrend = [
  { gestationalAge: 18, value: 320, date: '2024-12-01' },
  { gestationalAge: 24, value: 680, date: '2024-12-28' },
  { gestationalAge: 28, value: 1120, date: '2025-01-05' },
  { gestationalAge: 32.2, value: 1820, date: '2025-01-15' },
];

// ===== PCPNDT Mock Data =====
export const mockPcpndtData: PcpndtFormData = {
  patientId: 'p1',
  patientName: 'Priya Sharma',
  patientAge: 28,
  formNumber: 'PCPNDT-2025-00145',
  formDate: '2025-01-15',
  husbandName: 'Rajesh Sharma',
  husbandAge: 31,
  husbandAddress: '45, MG Road, Nagpur',
  referral: 'Dr. Mehta',
  lmp: '2025-05-22',
  edd: '2025-02-26',
  currentGa: '32w2d',
  gravida: 1,
  para: 0,
  living: 0,
  abortion: 0,
  previousUsg: 'Yes — 28 weeks, 05-Jan-2025',
  previousUsgDate: '2025-01-05',
  previousGa: '28w0d',
  findings: 'Single live intrauterine fetus, cephalic presentation. Growth appropriate for gestational age.',
  impression: 'Normal ongoing pregnancy.',
  sexDetermined: 'NOT DETERMINED',
  formStatus: 'draft',
};

// ===== Extraction Progress (demo) =====
export const mockExtractionProgress: ExtractionProgress = {
  dicomSr: true,
  dicomTags: true,
  gePrivateTags: true,
  aiAnalysis: true,
  ocr: false,
  manual: false,
  currentStep: 'AI Image Analysis Complete',
  overallPercent: 85,
};

// ===== Checklist (OB) =====
export const getInitialChecklist = (studyType: string): ChecklistItem[] => {
  const items = studyType === 'OB' ? [
    { label: 'BPD', category: 'Biometry', mandatory: true },
    { label: 'HC', category: 'Biometry', mandatory: true },
    { label: 'AC', category: 'Biometry', mandatory: true },
    { label: 'FL', category: 'Biometry', mandatory: true },
    { label: 'Placenta', category: 'Placenta', mandatory: true },
    { label: 'Amniotic Fluid', category: 'Fluid', mandatory: true },
    { label: 'Fetal Heart Rate', category: 'Cardiac', mandatory: true },
    { label: 'Presentation', category: 'Presentation', mandatory: true },
    { label: 'Cervical Length', category: 'Cervix', mandatory: false },
    { label: 'UA Doppler', category: 'Doppler', mandatory: false },
    { label: 'MCA Doppler', category: 'Doppler', mandatory: false },
    { label: 'Fetal Spine', category: 'Anatomy', mandatory: false },
    { label: 'Four Chamber View', category: 'Cardiac', mandatory: false },
  ] : studyType === 'PELVIS' ? [
    { label: 'Uterus', category: 'Pelvis', mandatory: true },
    { label: 'Endometrium', category: 'Pelvis', mandatory: true },
    { label: 'Right Ovary', category: 'Pelvis', mandatory: true },
    { label: 'Left Ovary', category: 'Pelvis', mandatory: true },
    { label: 'POD', category: 'Pelvis', mandatory: true },
    { label: 'Follicles', category: 'Pelvis', mandatory: false },
    { label: 'Fibroids', category: 'Pelvis', mandatory: false },
  ] : studyType === 'ABDOMEN' ? [
    { label: 'Liver', category: 'Abdomen', mandatory: true },
    { label: 'Gall Bladder', category: 'Abdomen', mandatory: true },
    { label: 'Pancreas', category: 'Abdomen', mandatory: true },
    { label: 'Spleen', category: 'Abdomen', mandatory: true },
    { label: 'Right Kidney', category: 'Abdomen', mandatory: true },
    { label: 'Left Kidney', category: 'Abdomen', mandatory: true },
    { label: 'CBD', category: 'Abdomen', mandatory: false },
    { label: 'Bladder', category: 'Abdomen', mandatory: false },
  ] : [];

  return items.map((item, i) => ({
    id: `cl-${i}`,
    ...item,
    isComplete: false,
  }));
};