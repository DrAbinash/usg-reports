"use client";
/**
 * USG Studio store — deliberately small (anti-soul rule: no 1,400-line monsters).
 * Auth + navigation only; report state lives in the composer.
 *
 * v6: openComposer() lets the Worklist hand a freshly created draft to the
 * USG Studio view (cross-view navigation without prop drilling).
 */
import { create } from "zustand";

export type View = "usg" | "worklist" | "insights" | "settings";

type StudioState = {
  bootstrapped: boolean;
  needsSetup: boolean;
  authenticated: boolean;
  view: View;
  /** Report id the USG Studio view should open in the composer on next mount. */
  openReportId: string | null;

  setAuth: (v: { needsSetup: boolean; authenticated: boolean }) => void;
  setView: (v: View) => void;
  openComposer: (reportId: string) => void;
  clearOpenReport: () => void;
};

export const useStudio = create<StudioState>((set) => ({
  bootstrapped: false,
  needsSetup: false,
  authenticated: false,
  view: "usg",
  openReportId: null,

  setAuth: (v) => set({ ...v, bootstrapped: true }),
  setView: (view) => set({ view }),
  openComposer: (reportId) => set({ openReportId: reportId, view: "usg" }),
  clearOpenReport: () => set({ openReportId: null }),
}));
