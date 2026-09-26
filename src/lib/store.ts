"use client";
/**
 * USG Studio store — deliberately small (anti-soul rule: no 1,400-line monsters).
 * Auth + navigation + composer strip (patient line in the pink header).
 *
 * v6: openComposer() lets the Worklist hand a freshly created draft to the
 * USG Studio view (cross-view navigation without prop drilling).
 */
import { create } from "zustand";

export type View = "usg" | "worklist" | "insights" | "settings";

/** Compact patient/study line shown in the CARE header while composing. */
export type ComposerStrip = {
  patientName: string;
  patientAge: string;
  patientSex: string;
  referredBy: string;
  studyLabel: string;
  title: string;
  status: "draft" | "final";
  allNormal: boolean;
  serial?: string;
};

type StudioState = {
  bootstrapped: boolean;
  needsSetup: boolean;
  authenticated: boolean;
  view: View;
  /** Report id the USG Studio view should open in the composer on next mount. */
  openReportId: string | null;
  /** Active composer patient strip for the pink header (null = not composing). */
  composerStrip: ComposerStrip | null;
  /** Back from composer (set by UsgComposer while mounted). */
  composerBack: (() => void) | null;
  /** Expand demography form in the composer. */
  expandPatientForm: (() => void) | null;

  setAuth: (v: { needsSetup: boolean; authenticated: boolean }) => void;
  setView: (v: View) => void;
  openComposer: (reportId: string) => void;
  clearOpenReport: () => void;
  setComposerStrip: (s: ComposerStrip | null) => void;
  setComposerBack: (fn: (() => void) | null) => void;
  setExpandPatientForm: (fn: (() => void) | null) => void;
};

export const useStudio = create<StudioState>((set) => ({
  bootstrapped: false,
  needsSetup: false,
  authenticated: false,
  view: "usg",
  openReportId: null,
  composerStrip: null,
  composerBack: null,
  expandPatientForm: null,

  setAuth: (v) => set({ ...v, bootstrapped: true }),
  setView: (view) => set({ view }),
  openComposer: (reportId) => set({ openReportId: reportId, view: "usg" }),
  clearOpenReport: () => set({ openReportId: null }),
  setComposerStrip: (composerStrip) => set({ composerStrip }),
  setComposerBack: (composerBack) => set({ composerBack }),
  setExpandPatientForm: (expandPatientForm) => set({ expandPatientForm }),
}));
