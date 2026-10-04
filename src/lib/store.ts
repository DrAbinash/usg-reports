"use client";
/**
 * USG Studio store — deliberately small (anti-soul rule: no 1,400-line monsters).
 * Auth + navigation + composer strip (patient line in the pink header).
 *
 * v6: openComposer() lets the Worklist hand a freshly created draft to the
 * USG Studio view (cross-view navigation without prop drilling).
 *
 * v6.19: SettingsView unmounts when you leave it (AppShell renders it only for
 * its own view), so every unsaved text edit on that screen died with it and the
 * studio never said so. Settings now publishes its unsaved field count here and
 * every path that changes the view passes through one guard.
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
  /** Active format key — lets the header picker show (and change) the study
   * without expanding the demography form. */
  studyKey: string;
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
  /** Report currently open in the composer (for queue jump highlight). */
  activeReportId: string | null;
  /** Active composer patient strip for the pink header (null = not composing). */
  composerStrip: ComposerStrip | null;
  /** Back from composer (set by UsgComposer while mounted). */
  composerBack: (() => void) | null;
  /** Expand demography form in the composer. */
  expandPatientForm: (() => void) | null;
  /** Change the open report's format from the header strip. */
  composerPickStudy: ((studyKey: string) => void) | null;
  /** Fields on the Settings screen that differ from what the server has.
   *  Zero means nothing is pending; the nav guard only ever asks at > 0. */
  settingsUnsaved: number;

  setAuth: (v: { needsSetup: boolean; authenticated: boolean }) => void;
  setView: (v: View) => void;
  setSettingsUnsaved: (n: number) => void;
  openComposer: (reportId: string) => void;
  clearOpenReport: () => void;
  setActiveReportId: (id: string | null) => void;
  setComposerStrip: (s: ComposerStrip | null) => void;
  setComposerBack: (fn: (() => void) | null) => void;
  setExpandPatientForm: (fn: (() => void) | null) => void;
  setComposerPickStudy: (fn: ((studyKey: string) => void) | null) => void;
};

export const useStudio = create<StudioState>((set, get) => {
  /**
   * Called before leaving the Settings screen. Returns false when the
   * clinician chooses to stay, meaning the caller must not change the view.
   *
   * Leaving Settings unmounts it, which discards every edit typed into a box
   * but not yet saved. A silent data-loss path with no recovery — so it now
   * asks, and says plainly what "leave" costs.
   */
  const leaveSettings = (next: View): boolean => {
    const { view, settingsUnsaved } = get();
    if (view !== "settings" || next === "settings" || settingsUnsaved <= 0) return true;
    const go = window.confirm(
      `You have ${settingsUnsaved} unsaved change${settingsUnsaved === 1 ? "" : "s"} on the Settings screen.\n\n` +
        "Switching away right now throws them away — nothing is saved, and there is no undo.\n\n" +
        "Press OK to leave anyway, or Cancel to stay and save them.",
    );
    // Staying keeps the count (the badge must stay lit); leaving means the
    // edits are gone, so the badge goes with them.
    if (go) set({ settingsUnsaved: 0 });
    return go;
  };

  return {
    bootstrapped: false,
    needsSetup: false,
    authenticated: false,
    view: "usg",
    openReportId: null,
    activeReportId: null,
    composerStrip: null,
    composerBack: null,
    expandPatientForm: null,
    composerPickStudy: null,
    settingsUnsaved: 0,

    setAuth: (v) => set({ ...v, bootstrapped: true }),
    setView: (view) => {
      if (!leaveSettings(view)) return;
      set({ view });
    },
    setSettingsUnsaved: (settingsUnsaved) => set({ settingsUnsaved }),
    openComposer: (reportId) => {
      if (!leaveSettings("usg")) return;
      set({ openReportId: reportId, activeReportId: reportId, view: "usg" });
    },
    clearOpenReport: () => set({ openReportId: null }),
    setActiveReportId: (activeReportId) => set({ activeReportId }),
    setComposerStrip: (composerStrip) => set({ composerStrip }),
    setComposerBack: (composerBack) => set({ composerBack }),
    setExpandPatientForm: (expandPatientForm) => set({ expandPatientForm }),
    setComposerPickStudy: (composerPickStudy) => set({ composerPickStudy }),
  };
});
