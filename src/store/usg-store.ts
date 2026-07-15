import { create } from 'zustand';
import type {
  Study, Measurement, Report, AiSuggestion, KeyImage,
  ViewMode, ChecklistItem, PcpndtFormData, ReportQAItem,
} from '@/lib/types';
import { mockStudies, mockPcpndtData, getInitialChecklist } from '@/lib/mock-data';

interface UsgStore {
  // Navigation
  activeView: ViewMode;
  setActiveView: (view: ViewMode) => void;

  // Studies
  studies: Study[];
  selectedStudy: Study | null;
  setSelectedStudy: (study: Study | null) => void;
  updateStudyStatus: (studyId: string, status: string) => void;

  // Measurements
  updateMeasurement: (studyId: string, measurementId: string, updates: Partial<Measurement>) => void;
  addMeasurement: (studyId: string, measurement: Measurement) => void;

  // Report
  updateReport: (studyId: string, updates: Partial<Report>) => void;

  // AI Suggestions
  dismissSuggestion: (suggestionId: string) => void;
  acceptSuggestion: (suggestionId: string) => void;

  // Key Images
  approveKeyImage: (keyImageId: string) => void;

  // Checklist
  checklist: ChecklistItem[];
  toggleChecklistItem: (itemId: string) => void;
  resetChecklist: (studyType: string) => void;
  autoUpdateChecklist: (measurements: Measurement[]) => void;

  // PCPNDT
  pcpndtData: PcpndtFormData;
  updatePcpndtData: (updates: Partial<PcpndtFormData>) => void;

  // Report QA
  reportQA: ReportQAItem[];
  runReportQA: () => void;

  // Image viewer
  selectedImageIndex: number;
  setSelectedImageIndex: (index: number) => void;

  // Right panel
  rightPanelOpen: boolean;
  setRightPanelOpen: (open: boolean) => void;
  activeRightTab: 'ai' | 'checklist' | 'qa' | 'keyimages';
  setActiveRightTab: (tab: 'ai' | 'checklist' | 'qa' | 'keyimages') => void;

  // Loading states
  isExtracting: boolean;
  setIsExtracting: (extracting: boolean) => void;
}

export const useUsgStore = create<UsgStore>((set, get) => ({
  // Navigation
  activeView: 'worklist',
  setActiveView: (view) => set({ activeView: view }),

  // Studies
  studies: mockStudies,
  selectedStudy: null,
  setSelectedStudy: (study) => {
    set({ selectedStudy: study, activeView: study ? 'study' : 'worklist' });
    if (study) {
      const checklist = getInitialChecklist(study.studyType);
      if (study.measurements) {
        const measurementNames = study.measurements.map(m => m.name);
        checklist.forEach(item => {
          const match = measurementNames.some(name =>
            name.toLowerCase().includes(item.label.toLowerCase()) ||
            item.label.toLowerCase().includes(name.toLowerCase())
          );
          if (match) item.isComplete = true;
        });
      }
      set({ checklist });
      if (study.studyType === 'OB' && study.patient) {
        const gaMeas = study.measurements?.find(m => m.name === 'GA');
        const gaStr = gaMeas ? `${Math.floor(gaMeas.value)}w${Math.round((gaMeas.value % 1) * 7)}d` : undefined;
        set({
          pcpndtData: {
            ...mockPcpndtData,
            patientId: study.patientId,
            patientName: study.patient.name,
            patientAge: study.patient.age,
            currentGa: gaStr,
          }
        });
      }
    }
  },
  updateStudyStatus: (studyId, status) =>
    set((state) => ({
      studies: state.studies.map(s => s.id === studyId ? { ...s, status } : s),
      selectedStudy: state.selectedStudy?.id === studyId
        ? { ...state.selectedStudy, status } : state.selectedStudy,
    })),

  // Measurements
  updateMeasurement: (studyId, measurementId, updates) =>
    set((state) => {
      const updatedStudies = state.studies.map(s => {
        if (s.id !== studyId) return s;
        return {
          ...s,
          measurements: s.measurements?.map(m =>
            m.id === measurementId ? { ...m, ...updates, isEdited: updates.value !== undefined || updates.notes !== undefined ? true : m.isEdited } : m
          ),
        };
      });
      const updatedStudy = updatedStudies.find(s => s.id === studyId);
      return {
        studies: updatedStudies,
        selectedStudy: state.selectedStudy?.id === studyId ? updatedStudy || null : state.selectedStudy,
      };
    }),
  addMeasurement: (studyId, measurement) =>
    set((state) => {
      const updatedStudies = state.studies.map(s => {
        if (s.id !== studyId) return s;
        return { ...s, measurements: [...(s.measurements || []), measurement] };
      });
      const updatedStudy = updatedStudies.find(s => s.id === studyId);
      return {
        studies: updatedStudies,
        selectedStudy: state.selectedStudy?.id === studyId ? updatedStudy || null : state.selectedStudy,
      };
    }),

  // Report
  updateReport: (studyId, updates) =>
    set((state) => {
      const updatedStudies = state.studies.map(s => {
        if (s.id !== studyId) return s;
        return { ...s, report: s.report ? { ...s.report, ...updates } : { id: `r-${studyId}`, studyId, findings: '', impression: '', reportStatus: 'draft', ...updates } };
      });
      const updatedStudy = updatedStudies.find(s => s.id === studyId);
      return {
        studies: updatedStudies,
        selectedStudy: state.selectedStudy?.id === studyId ? updatedStudy || null : state.selectedStudy,
      };
    }),

  // AI Suggestions
  dismissSuggestion: (suggestionId) =>
    set((state) => ({
      studies: state.studies.map(s => ({
        ...s,
        aiSuggestions: s.aiSuggestions?.map(a =>
          a.id === suggestionId ? { ...a, isDismissed: true } : a
        ),
      })),
      selectedStudy: state.selectedStudy ? {
        ...state.selectedStudy,
        aiSuggestions: state.selectedStudy.aiSuggestions?.map(a =>
          a.id === suggestionId ? { ...a, isDismissed: true } : a
        ),
      } : null,
    })),
  acceptSuggestion: (suggestionId) =>
    set((state) => ({
      studies: state.studies.map(s => ({
        ...s,
        aiSuggestions: s.aiSuggestions?.map(a =>
          a.id === suggestionId ? { ...a, isAccepted: true } : a
        ),
      })),
      selectedStudy: state.selectedStudy ? {
        ...state.selectedStudy,
        aiSuggestions: state.selectedStudy.aiSuggestions?.map(a =>
          a.id === suggestionId ? { ...a, isAccepted: true } : a
        ),
      } : null,
    })),

  // Key Images
  approveKeyImage: (keyImageId) =>
    set((state) => ({
      studies: state.studies.map(s => ({
        ...s,
        keyImages: s.keyImages?.map(k =>
          k.id === keyImageId ? { ...k, isApproved: true } : k
        ),
      })),
      selectedStudy: state.selectedStudy ? {
        ...state.selectedStudy,
        keyImages: state.selectedStudy.keyImages?.map(k =>
          k.id === keyImageId ? { ...k, isApproved: true } : k
        ),
      } : null,
    })),

  // Checklist
  checklist: [],
  toggleChecklistItem: (itemId) =>
    set((state) => ({
      checklist: state.checklist.map(item =>
        item.id === itemId ? { ...item, isComplete: !item.isComplete } : item
      ),
    })),
  resetChecklist: (studyType) => set({ checklist: getInitialChecklist(studyType) }),
  autoUpdateChecklist: (measurements) => {
    const checklist = get().checklist;
    const measurementNames = measurements.map(m => m.name);
    set({
      checklist: checklist.map(item => {
        const match = measurementNames.some(name =>
          name.toLowerCase().includes(item.label.toLowerCase()) ||
          item.label.toLowerCase().includes(name.toLowerCase())
        );
        return { ...item, isComplete: match || item.isComplete };
      }),
    });
  },

  // PCPNDT
  pcpndtData: mockPcpndtData,
  updatePcpndtData: (updates) =>
    set((state) => ({ pcpndtData: { ...state.pcpndtData, ...updates } })),

  // Report QA
  reportQA: [],
  runReportQA: () => {
    const study = get().selectedStudy;
    if (!study) return;
    const qa: ReportQAItem[] = [];
    const measurements = study.measurements || [];
    const report = study.report;

    if (study.studyType === 'OB') {
      const mandatory = ['BPD', 'HC', 'AC', 'FL'];
      mandatory.forEach(name => {
        const found = measurements.find(m => m.name === name);
        if (!found) {
          qa.push({ id: `qa-m-${name}`, check: `Missing ${name}`, status: 'fail', message: `${name} measurement is missing.`, field: name });
        } else if (found.value <= 0) {
          qa.push({ id: `qa-v-${name}`, check: `Invalid ${name}`, status: 'fail', message: `${name} value is ${found.value}. Please verify.`, field: name });
        } else if (found.confidence && found.confidence < 0.8) {
          qa.push({ id: `qa-c-${name}`, check: `Low confidence ${name}`, status: 'warning', message: `${name} AI confidence is ${(found.confidence * 100).toFixed(0)}%. Consider manual verification.`, field: name });
        }
      });
      measurements.forEach(m => {
        if (m.name === 'FHR' && (m.value < 100 || m.value > 200)) {
          qa.push({ id: 'qa-fhr', check: 'FHR out of range', status: 'fail', message: `FHR ${m.value} bpm is outside normal range (100-200).`, field: 'FHR' });
        }
        if (m.name === 'AFI' && (m.value < 5 || m.value > 25)) {
          qa.push({ id: 'qa-afi', check: 'AFI abnormal', status: 'warning', message: `AFI ${m.value} cm is outside normal range (8-24 cm).`, field: 'AFI' });
        }
      });
    }

    if (report) {
      if (!report.findings || report.findings.trim().length === 0) {
        qa.push({ id: 'qa-findings', check: 'Findings empty', status: 'fail', message: 'Findings section is empty.' });
      }
      if (!report.impression || report.impression.trim().length === 0) {
        qa.push({ id: 'qa-impression', check: 'Impression empty', status: 'fail', message: 'Impression section is empty.' });
      }
      if (!report.clinicalInfo || report.clinicalInfo.trim().length === 0) {
        qa.push({ id: 'qa-clinical', check: 'Clinical info missing', status: 'warning', message: 'Clinical information not provided.' });
      }
    } else {
      qa.push({ id: 'qa-report', check: 'No report', status: 'fail', message: 'Report has not been created.' });
    }

    if (study.studyType === 'OB') {
      const pcpndt = get().pcpndtData;
      if (!pcpndt.husbandName) {
        qa.push({ id: 'qa-pcp-h', check: 'PCPNDT: Husband name missing', status: 'warning', message: 'Husband name required for PCPNDT Form F.' });
      }
      if (pcpndt.sexDetermined !== 'NOT DETERMINED') {
        qa.push({ id: 'qa-pcp-sex', check: 'PCPNDT: Sex determination', status: 'critical', message: 'PCPNDT: Sex must be recorded as NOT DETERMINED.' });
      }
    }

    const unverified = measurements.filter(m => !m.isVerified);
    if (unverified.length > 0) {
      qa.push({ id: 'qa-unverified', check: 'Unverified measurements', status: 'warning', message: `${unverified.length} measurement(s) not yet verified by doctor.` });
    }

    const edited = measurements.filter(m => m.isEdited);
    if (edited.length > 0) {
      qa.push({ id: 'qa-edited', check: 'Edited measurements', status: 'info', message: `${edited.length} measurement(s) were edited from AI-extracted values.` });
    }

    set({ reportQA: qa });
  },

  // Image viewer
  selectedImageIndex: 0,
  setSelectedImageIndex: (index) => set({ selectedImageIndex: index }),

  // Right panel
  rightPanelOpen: true,
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  activeRightTab: 'ai',
  setActiveRightTab: (tab) => set({ activeRightTab: tab }),

  // Loading states
  isExtracting: false,
  setIsExtracting: (extracting) => set({ isExtracting: extracting }),
}));