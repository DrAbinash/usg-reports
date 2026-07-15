// ===== CARE AI Sonologist Companion™ — Constants =====

export const APP_NAME = 'CARE AI Sonologist Companion™';
export const APP_SHORT = 'CARE AI USG';
export const CLINIC_NAME = 'CARE Diagnostics';
export const DOCTOR_NAME = 'Dr. Sugandha';
export const MACHINE_NAME = 'GE Voluson E9';

export const STUDY_TYPES = [
  { value: 'OB', label: 'Obstetric (OB)', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'PELVIS', label: 'Pelvis', color: 'bg-purple-100 text-purple-800' },
  { value: 'ABDOMEN', label: 'Abdomen', color: 'bg-amber-100 text-amber-800' },
  { value: 'THYROID', label: 'Thyroid', color: 'bg-rose-100 text-rose-800' },
  { value: 'BREAST', label: 'Breast', color: 'bg-pink-100 text-pink-800' },
  { value: 'SCROTUM', label: 'Scrotum', color: 'bg-orange-100 text-orange-800' },
  { value: 'DOPPLER', label: 'Doppler', color: 'bg-cyan-100 text-cyan-800' },
  { value: 'KIDNEY', label: 'Kidney', color: 'bg-teal-100 text-teal-800' },
  { value: 'PROSTATE', label: 'Prostate', color: 'bg-slate-100 text-slate-800' },
  { value: 'CARDIAC', label: 'Fetal ECHO', color: 'bg-red-100 text-red-800' },
  { value: 'VASCULAR', label: 'Vascular', color: 'bg-sky-100 text-sky-800' },
  { value: 'GENERAL', label: 'General USG', color: 'bg-gray-100 text-gray-800' },
] as const;

export const STATUS_COLORS: Record<string, string> = {
  'pending': 'bg-slate-100 text-slate-700',
  'in-progress': 'bg-amber-100 text-amber-700',
  'reporting': 'bg-emerald-100 text-emerald-700',
  'qa': 'bg-purple-100 text-purple-700',
  'signed': 'bg-teal-100 text-teal-700',
};

export const STATUS_LABELS: Record<string, string> = {
  'pending': 'Pending',
  'in-progress': 'In Progress',
  'reporting': 'Reporting',
  'qa': 'Quality Check',
  'signed': 'Signed',
};

export const MEASUREMENT_CATEGORIES = {
  OB: {
    label: 'Obstetric',
    items: [
      { name: 'CRL', label: 'Crown Rump Length', unit: 'mm' },
      { name: 'GS', label: 'Gestational Sac', unit: 'mm' },
      { name: 'Yolk Sac', label: 'Yolk Sac', unit: 'mm' },
      { name: 'NT', label: 'Nuchal Translucency', unit: 'mm' },
      { name: 'BPD', label: 'Biparietal Diameter', unit: 'mm' },
      { name: 'HC', label: 'Head Circumference', unit: 'mm' },
      { name: 'AC', label: 'Abdominal Circumference', unit: 'mm' },
      { name: 'FL', label: 'Femur Length', unit: 'mm' },
      { name: 'HL', label: 'Humerus Length', unit: 'mm' },
      { name: 'EFW', label: 'Estimated Fetal Weight', unit: 'g' },
      { name: 'GA', label: 'Gestational Age', unit: 'wks' },
      { name: 'EDD', label: 'Expected Date of Delivery', unit: '' },
      { name: 'AFI', label: 'Amniotic Fluid Index', unit: 'cm' },
      { name: 'FHR', label: 'Fetal Heart Rate', unit: 'bpm' },
    ],
  },
  PLACENTA: {
    label: 'Placenta',
    items: [
      { name: 'Placenta Location', label: 'Placenta Location', unit: '' },
      { name: 'Placenta Grade', label: 'Placenta Grade', unit: '' },
      { name: 'Placenta Position', label: 'Placenta Position', unit: '' },
    ],
  },
  PRESENTATION: {
    label: 'Presentation',
    items: [
      { name: 'Presentation', label: 'Presentation', unit: '' },
      { name: 'Lie', label: 'Lie', unit: '' },
      { name: 'Cord', label: 'Cord', unit: '' },
    ],
  },
  DOPPLER: {
    label: 'Doppler',
    items: [
      { name: 'UA PSV', label: 'Umbilical Artery PSV', unit: 'cm/s' },
      { name: 'UA EDV', label: 'Umbilical Artery EDV', unit: 'cm/s' },
      { name: 'UA RI', label: 'Umbilical Artery RI', unit: '' },
      { name: 'UA PI', label: 'Umbilical Artery PI', unit: '' },
      { name: 'UA S/D', label: 'Umbilical Artery S/D', unit: '' },
      { name: 'MCA PSV', label: 'MCA PSV', unit: 'cm/s' },
      { name: 'MCA PI', label: 'MCA PI', unit: '' },
      { name: 'MCA RI', label: 'MCA RI', unit: '' },
      { name: 'UtA RI', label: 'Uterine Artery RI', unit: '' },
      { name: 'UtA PI', label: 'Uterine Artery PI', unit: '' },
    ],
  },
  PELVIS: {
    label: 'Pelvis',
    items: [
      { name: 'Uterus Length', label: 'Uterus Length', unit: 'mm' },
      { name: 'Uterus Width', label: 'Uterus Width', unit: 'mm' },
      { name: 'Uterus AP', label: 'Uterus AP', unit: 'mm' },
      { name: 'Endometrium', label: 'Endometrial Thickness', unit: 'mm' },
      { name: 'RT Ovary', label: 'Right Ovary', unit: 'mm' },
      { name: 'LT Ovary', label: 'Left Ovary', unit: 'mm' },
      { name: 'Follicles RT', label: 'Right Follicles', unit: 'mm' },
      { name: 'Follicles LT', label: 'Left Follicles', unit: 'mm' },
      { name: 'POD', label: 'Pouch of Douglas', unit: '' },
      { name: 'Fibroids', label: 'Fibroids', unit: '' },
    ],
  },
  ABDOMEN: {
    label: 'Abdomen',
    items: [
      { name: 'Liver', label: 'Liver Size', unit: 'mm' },
      { name: 'Portal Vein', label: 'Portal Vein', unit: 'mm' },
      { name: 'CBD', label: 'Common Bile Duct', unit: 'mm' },
      { name: 'Gall Bladder', label: 'Gall Bladder', unit: 'mm' },
      { name: 'Pancreas', label: 'Pancreas', unit: 'mm' },
      { name: 'Spleen', label: 'Spleen', unit: 'mm' },
      { name: 'RT Kidney', label: 'Right Kidney', unit: 'mm' },
      { name: 'LT Kidney', label: 'Left Kidney', unit: 'mm' },
      { name: 'Bladder', label: 'Urinary Bladder', unit: 'mm' },
      { name: 'Prostate', label: 'Prostate', unit: 'mm' },
      { name: 'Aorta', label: 'Aorta', unit: 'mm' },
      { name: 'IVC', label: 'IVC', unit: 'mm' },
    ],
  },
} as const;

export const OB_CHECKLIST_ITEMS = [
  { label: 'BPD', category: 'Biometry', mandatory: true },
  { label: 'HC', category: 'Biometry', mandatory: true },
  { label: 'AC', category: 'Biometry', mandatory: true },
  { label: 'FL', category: 'Biometry', mandatory: true },
  { label: 'Placenta', category: 'Placenta', mandatory: true },
  { label: 'Amniotic Fluid', category: 'Fluid', mandatory: true },
  { label: 'Fetal Heart Rate', category: 'Cardiac', mandatory: true },
  { label: 'Cervical Length', category: 'Cervix', mandatory: false },
  { label: 'Presentation', category: 'Presentation', mandatory: true },
  { label: 'Umbilical Artery Doppler', category: 'Doppler', mandatory: false },
  { label: 'MCA Doppler', category: 'Doppler', mandatory: false },
  { label: 'Fetal Spine', category: 'Anatomy', mandatory: false },
  { label: 'Fetal Stomach', category: 'Anatomy', mandatory: false },
  { label: 'Fetal Kidneys', category: 'Anatomy', mandatory: false },
  { label: 'Fetal Bladder', category: 'Anatomy', mandatory: false },
  { label: 'Four Chamber View', category: 'Cardiac', mandatory: false },
  { label: 'Uterine Artery Doppler', category: 'Doppler', mandatory: false },
];

export const PELVIS_CHECKLIST_ITEMS = [
  { label: 'Uterus', category: 'Pelvis', mandatory: true },
  { label: 'Endometrium', category: 'Pelvis', mandatory: true },
  { label: 'Right Ovary', category: 'Pelvis', mandatory: true },
  { label: 'Left Ovary', category: 'Pelvis', mandatory: true },
  { label: 'Follicles', category: 'Pelvis', mandatory: false },
  { label: 'POD', category: 'Pelvis', mandatory: true },
  { label: 'Fibroids', category: 'Pelvis', mandatory: false },
  { label: 'Adnexa', category: 'Pelvis', mandatory: false },
];

export const ABDOMEN_CHECKLIST_ITEMS = [
  { label: 'Liver', category: 'Abdomen', mandatory: true },
  { label: 'Gall Bladder', category: 'Abdomen', mandatory: true },
  { label: 'CBD', category: 'Abdomen', mandatory: false },
  { label: 'Pancreas', category: 'Abdomen', mandatory: true },
  { label: 'Spleen', category: 'Abdomen', mandatory: true },
  { label: 'Right Kidney', category: 'Abdomen', mandatory: true },
  { label: 'Left Kidney', category: 'Abdomen', mandatory: true },
  { label: 'Bladder', category: 'Abdomen', mandatory: false },
  { label: 'Aorta', category: 'Abdomen', mandatory: false },
];

export const SOURCE_LABELS: Record<string, string> = {
  'dicom_sr': 'DICOM SR',
  'dicom_tag': 'DICOM Tag',
  'ge_private': 'GE Private Tag',
  'ai': 'AI Analysis',
  'ocr': 'OCR',
  'manual': 'Manual',
};

export const SOURCE_COLORS: Record<string, string> = {
  'dicom_sr': 'text-emerald-600',
  'dicom_tag': 'text-teal-600',
  'ge_private': 'text-amber-600',
  'ai': 'text-purple-600',
  'ocr': 'text-orange-600',
  'manual': 'text-slate-600',
};

export const EXTRACTION_PRIORITY = [
  'DICOM Structured Report',
  'Standard DICOM Tags',
  'GE Private Tags',
  'AI Image Analysis',
  'OCR (Fallback)',
  'Manual Entry',
] as const;

export const ORGAN_LABELS = [
  'Fetal Head', 'Abdomen', 'Femur', 'Placenta', 'Umbilical Cord',
  'Cervix', 'Amniotic Fluid', 'Heart', 'Brain', 'Kidneys',
  'Liver', 'Gall Bladder', 'Urinary Bladder', 'Ovaries', 'Uterus',
  'Prostate', 'Thyroid', 'Breast', 'Testis', 'Scrotum', 'Doppler Waveform',
] as const;