// ===== CARE AI Sonologist Companion™ — Type Definitions =====

export type StudyStatus = 'pending' | 'in-progress' | 'reporting' | 'qa' | 'signed';
export type ReportStatus = 'draft' | 'reviewed' | 'signed';
export type MeasurementSource = 'dicom_sr' | 'dicom_tag' | 'ge_private' | 'ai' | 'ocr' | 'manual';
export type SuggestionSeverity = 'info' | 'warning' | 'critical';
export type SuggestionCategory = 'finding' | 'alert' | 'quality' | 'missing' | 'comparison';
export type StudyType = 'OB' | 'PELVIS' | 'ABDOMEN' | 'THYROID' | 'BREAST' | 'SCROTUM' | 'DOPPLER' | 'KIDNEY' | 'PROSTATE' | 'CARDIAC' | 'VASCULAR' | 'GENERAL';
export type AiConfidence = 'high' | 'medium' | 'low';
export type ViewMode = 'worklist' | 'study' | 'dashboard' | 'pcpndt' | 'settings';

export interface Patient {
  id: string;
  name: string;
  age: number;
  sex: string;
  phone?: string;
  address?: string;
  uhid: string;
  referringDoctor?: string;
}

export interface Study {
  id: string;
  studyUid: string;
  studyDate: string;
  studyType: StudyType;
  studyDesc?: string;
  machine: string;
  status: StudyStatus;
  patientId: string;
  patient?: Patient;
  series?: Series[];
  measurements?: Measurement[];
  report?: Report;
  aiSuggestions?: AiSuggestion[];
  keyImages?: KeyImage[];
}

export interface Series {
  id: string;
  seriesUid: string;
  seriesDesc?: string;
  seriesNumber: number;
  modality: string;
  images?: DicomImage[];
}

export interface DicomImage {
  id: string;
  sopUid: string;
  instanceNumber: number;
  imageType?: string;
  qualityScore?: number;
  aiLabel?: string;
  isKeyImage: boolean;
  isApproved: boolean;
  frameNumber?: number;
}

export interface Measurement {
  id: string;
  studyId: string;
  name: string;
  value: number;
  unit: string;
  category: string;
  gestationalAge?: string;
  percentile?: number;
  source: MeasurementSource;
  confidence?: number;
  sopUid?: string;
  seriesUid?: string;
  frameNumber?: number;
  isVerified: boolean;
  isEdited: boolean;
  originalValue?: number;
  notes?: string;
}

export interface Report {
  id: string;
  studyId: string;
  clinicalInfo?: string;
  findings: string;
  impression: string;
  recommendation?: string;
  technique?: string;
  comparison?: string;
  reportStatus: ReportStatus;
  signedBy?: string;
  signedAt?: string;
}

export interface AiSuggestion {
  id: string;
  studyId: string;
  category: SuggestionCategory;
  message: string;
  severity: SuggestionSeverity;
  isDismissed: boolean;
  isAccepted?: boolean;
  source?: string;
}

export interface KeyImage {
  id: string;
  studyId: string;
  category: string;
  rank: number;
  isApproved: boolean;
  aiScore?: number;
}

export interface PcpndtFormData {
  id?: string;
  patientId: string;
  patientName?: string;
  patientAge?: number;
  formNumber?: string;
  formDate?: string;
  husbandName?: string;
  husbandAge?: number;
  husbandAddress?: string;
  referral?: string;
  lmp?: string;
  edd?: string;
  currentGa?: string;
  gravida?: number;
  para?: number;
  living?: number;
  abortion?: number;
  previousUsg?: string;
  previousUsgDate?: string;
  previousGa?: string;
  findings?: string;
  impression?: string;
  sexDetermined?: string;
  formStatus?: string;
}

export interface GrowthDataPoint {
  gestationalAge: number;
  value: number;
  percentile5?: number;
  percentile50?: number;
  percentile95?: number;
  date: string;
  studyId: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  category: string;
  isComplete: boolean;
  isMandatory: boolean;
  source?: string;
}

export interface ReportQAItem {
  id: string;
  check: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  field?: string;
}

export interface ExtractionProgress {
  dicomSr: boolean;
  dicomTags: boolean;
  gePrivateTags: boolean;
  aiAnalysis: boolean;
  ocr: boolean;
  manual: boolean;
  currentStep: string;
  overallPercent: number;
}