"use client";
/**
 * Composer chrome — compact header, patient strip, tips, banners, and the
 * peak-time / All Normal / templates toolbar. Behaviour preserved verbatim.
 */
import { memo, useEffect, useRef, type Dispatch, type SetStateAction, type MutableRefObject } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ArrowLeft, CalendarDays, Check, ChevronDown, Loader2, Maximize2, Minimize2, Phone, Settings2, Zap } from "lucide-react";
import { MessageCircle, FileCheck2 as FileCheck2Icon, ScanLine, Link2 } from "lucide-react";
import type { UsgComposerState, UsgPathologyDef, UsgResolved, UsgStudyDef } from "@/lib/usg/types";
import { USG_SEX_CHILD } from "@/lib/usg/types";
import { USG_STUDIES, STUDY_GROUPS, getStudy, type NormalOverrides } from "@/lib/usg/studies";
import { isObStudyKey } from "@/lib/usg/orderStudy";
import { pathologiesForOrgan, selectedPathologies, setOrganVar, sortPathologiesForChips, switchStudy } from "@/lib/usg/composer";
import {
  applyRushNormalStudy,
  applyRushPreset,
  copyForwardMeasurements,
  markAllNormal,
  studyAllowsRushNormals,
} from "@/lib/usg/quickActions";
import { isGridOrgan } from "@/lib/usg/gridOrgans";
import { scanForCriticalFindings } from "@/lib/usg/criticalFindings";
import { appendTranscript } from "@/lib/usg/dictation";
import { clearDraft, type DraftSnapshot } from "@/lib/usg/drafts";
import { buildPregnancyTimeline } from "@/lib/usg/pregnancyTimeline";
import { shareReportWhatsapp } from "../shareWhatsapp";
import { UsgTipsRibbon } from "../UsgTipsRibbon";
import { UsgCriticalBanner } from "../UsgCriticalBanner";
import { UsgDiffPanel, type DiffSource } from "../UsgDiffPanel";
import { UsgPregnancyTimeline } from "../UsgPregnancyTimeline";
import { UsgGrowthChart } from "../UsgGrowthChart";
import { UsgCalculators } from "../UsgCalculators";
import { UsgDoctorAutocomplete } from "../UsgDoctorAutocomplete";
import { UsgFormatsLibrary } from "../UsgFormatsLibrary";
import { UsgTemplateBar } from "../UsgTemplateBar";
import { DictationButton } from "../DictationButton";
import type { UsgPrintSettings } from "@/lib/usg/print";
import { lmpSummary, parseLmpInput } from "@/lib/usg/lmp";
import type { FormFDefaults, FormFOrderLite } from "../UsgFormFDialog";

export async function pullFromMachine(opts: {
  savedId: string | null;
  reportId: string | null | undefined;
  setPulling: (v: boolean) => void;
  setState: React.Dispatch<React.SetStateAction<UsgComposerState>>;
  setReviewSrResult: (v: any) => void;
  setReviewSrMeasurements: (v: any) => void;
  setReviewOpen: (v: boolean) => void;
  setPullSummary: React.Dispatch<React.SetStateAction<{ source: string; matchedCount: number; extras: Record<string, string> } | null>>;
}) {
  const rid = opts.savedId ?? opts.reportId ?? null;
  if (!rid) {
    toast.info("Save the draft once — then pull the machine's measurements");
    return;
  }
  opts.setPulling(true);
  try {
    const r = await fetch("/api/usg/dicom/measurements", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reportId: rid }),
    }).then((x) => x.json());
    if (r?.error) {
      toast.error(r.error);
      return;
    }
    if (r.source === "sr" && (r.matchedCount ?? 0) > 0) {
      const srResult = {
        vars: (r.vars ?? {}) as Record<string, Record<string, string>>,
        extras: (r.extras ?? {}) as Record<string, string>,
        matchedCount: r.matchedCount ?? 0,
      };
      const srMeasurements = Object.entries(srResult.vars).flatMap(([organ, kv]) =>
        Object.entries(kv).map(([k, v]) => ({ conceptName: `${organ}.${k}`, value: v, unit: "" })),
      );
      opts.setReviewSrResult(srResult);
      opts.setReviewSrMeasurements(srMeasurements);
      opts.setReviewOpen(true);
      opts.setPullSummary({ source: r.source ?? "none", matchedCount: r.matchedCount ?? 0, extras: srResult.extras });
      return;
    }
    const vars = (r.vars ?? {}) as Record<string, Record<string, string>>;
    let applied = 0;
    opts.setState((s) => {
      let next = s;
      for (const [organ, kv] of Object.entries(vars)) {
        for (const [k, v] of Object.entries(kv)) {
          if (v === undefined || v === "") continue;
          next = setOrganVar(next, organ, k, String(v));
          applied++;
        }
      }
      return next;
    });
    opts.setPullSummary({ source: r.source ?? "none", matchedCount: r.matchedCount ?? 0, extras: (r.extras ?? {}) as Record<string, string> });
    if ((r.matchedCount ?? 0) > 0) {
      toast.success(
        r.source === "sr"
          ? `Machine SR → ${r.matchedCount} measurement slot(s) filled`
          : `OCR → ${r.matchedCount} measurement slot(s) filled (verify values)`,
      );
    } else if (r.ocrNote) {
      toast.info(r.ocrNote);
    } else {
      toast.info("No measurements found in the PACS study for this study type");
    }
  } catch {
    toast.error("Pull failed — Orthanc unreachable");
  } finally {
    opts.setPulling(false);
  }
}

export type PatientSuggestion = { id: string; name: string; phone: string; scanCount: number };

type ReportOrderLite = FormFOrderLite & {
  studyInstanceUid: string | null;
  billingStatus: string | null;
  careSyncedAt: string | null;
};

type UsgReportRow = {
  id: string;
  patientName?: string;
  serialNo?: number | null;
  status?: string;
  reportHtml?: string | null;
  images?: unknown;
};

export type ComposerToolbarProps = {
  onBack: () => void;
  headerCollapsed: boolean;
  setHeaderCollapsed: Dispatch<SetStateAction<boolean>>;
  patientName: string;
  patientAge: string;
  patientSex: "F" | "M" | typeof USG_SEX_CHILD;
  referredBy: string;
  setReferredBy: (v: string) => void;
  resolved: UsgResolved;
  abnormalCount: number;
  serial?: string;
  isFinal: boolean;
  fullscreen: boolean;
  setFullscreen: Dispatch<SetStateAction<boolean>>;
  persist: (status: "" | "finalize") => Promise<string | null>;
  busy: "" | "save" | "finalize" | "print";
  finalizeFast: (alsoPrint?: boolean) => Promise<void>;
  print: () => Promise<void>;
  settings: UsgPrintSettings;
  normalOverrides?: NormalOverrides | null;
  state: UsgComposerState;
  setState: Dispatch<SetStateAction<UsgComposerState>>;
  setCommOpen: (v: boolean) => void;
  savedIdRef: MutableRefObject<string | null>;
  report: UsgReportRow | null;
  scanDate: string;
  setScanDate: (v: string) => void;
  fmtPrintDate: (iso: string) => string;
  lastAutosave: number | null;
  order: ReportOrderLite | null | undefined;
  orderUid: string | null;
  pullFromMachine: () => Promise<void>;
  pulling: boolean;
  study: UsgStudyDef;
  formFDefaults: FormFDefaults | null | undefined;
  setFormFOpen: (v: boolean) => void;
  pullSummary: { source: string; matchedCount: number; extras: Record<string, string> } | null;
  setPullSummary: Dispatch<SetStateAction<{ source: string; matchedCount: number; extras: Record<string, string> } | null>>;
  onNameChange: (v: string) => void;
  patients: PatientSuggestion[];
  patientPhone: string;
  setPatientPhone: (v: string) => void;
  setPatientAge: (v: string) => void;
  studyKey: string;
  setStudyKey: (k: string) => void;
  setTechnique: Dispatch<SetStateAction<string>>;
  setPatientSex: Dispatch<SetStateAction<"F" | "M" | typeof USG_SEX_CHILD>>;
  showTechnique: boolean;
  setShowTechnique: Dispatch<SetStateAction<boolean>>;
  isPregnancyStudy: boolean;
  lmp: string;
  setLmp: (v: string) => void;
  lmpInfo: { weeks: number; days: number; edd: string } | null;
  technique: string;
  restoreSnap: DraftSnapshot | null;
  setRestoreSnap: Dispatch<SetStateAction<DraftSnapshot | null>>;
  restoreDraft: () => void;
  dKey: string;
  diffSource?: DiffSource | null;
  pathologies: UsgPathologyDef[];
  patientReports: Array<{ id: number; scanDate: string | null; stateJson: string | null; studyKey: string | null; status: string }>;
  togglePathology: (organKey: string, key: string | null) => void;
};

function toolbarEqual(a: ComposerToolbarProps, b: ComposerToolbarProps): boolean {
  return (
    a.headerCollapsed === b.headerCollapsed &&
    a.patientName === b.patientName &&
    a.patientAge === b.patientAge &&
    a.patientSex === b.patientSex &&
    a.referredBy === b.referredBy &&
    a.resolved === b.resolved &&
    a.abnormalCount === b.abnormalCount &&
    a.serial === b.serial &&
    a.isFinal === b.isFinal &&
    a.fullscreen === b.fullscreen &&
    a.busy === b.busy &&
    a.settings === b.settings &&
    a.state === b.state &&
    a.scanDate === b.scanDate &&
    a.lastAutosave === b.lastAutosave &&
    a.order === b.order &&
    a.orderUid === b.orderUid &&
    a.pulling === b.pulling &&
    a.study === b.study &&
    a.formFDefaults === b.formFDefaults &&
    a.pullSummary === b.pullSummary &&
    a.patients === b.patients &&
    a.patientPhone === b.patientPhone &&
    a.studyKey === b.studyKey &&
    a.showTechnique === b.showTechnique &&
    a.isPregnancyStudy === b.isPregnancyStudy &&
    a.lmp === b.lmp &&
    a.lmpInfo === b.lmpInfo &&
    a.technique === b.technique &&
    a.restoreSnap === b.restoreSnap &&
    a.diffSource === b.diffSource &&
    a.pathologies === b.pathologies &&
    a.patientReports === b.patientReports &&
    a.onBack === b.onBack &&
    a.persist === b.persist &&
    a.finalizeFast === b.finalizeFast &&
    a.print === b.print &&
    a.togglePathology === b.togglePathology
  );
}


/** Global composer hotkeys — Space focus-advance, N rush-normal, Ctrl+S/P/Enter, 1-9 chips. */
export function ComposerHotkeys(props: {
  isFinal: boolean;
  study: UsgStudyDef;
  state: UsgComposerState;
  setState: Dispatch<SetStateAction<UsgComposerState>>;
  pathologies: UsgPathologyDef[];
  focusedOrganIdx: number;
  setFocusedOrganIdx: Dispatch<SetStateAction<number>>;
  setQualityOpen: (v: boolean) => void;
  setPickerOpen: (v: boolean) => void;
  persistRef: MutableRefObject<((status: "" | "finalize") => Promise<string | null>) | null>;
  printRefFn: MutableRefObject<() => Promise<void>>;
  finalizeFastRef: MutableRefObject<(alsoPrint?: boolean) => Promise<void>>;
  togglePathologyRef: MutableRefObject<(organKey: string, key: string | null) => void>;
  busyRef: MutableRefObject<string>;
}) {
  const {
    isFinal, study, state, setState, pathologies, focusedOrganIdx, setFocusedOrganIdx,
    setQualityOpen, setPickerOpen, persistRef, printRefFn, finalizeFastRef, togglePathologyRef, busyRef,
  } = props;
  const rushNormalRef = useRef<() => void>(() => {});
  rushNormalRef.current = () => {
    if (isFinal) return;
    if (studyAllowsRushNormals(study)) {
      const next = applyRushNormalStudy(state, study);
      if (!next) {
        toast.error("This study needs measurements — use organ cards");
        return;
      }
      setState(next);
      toast.success("All normal · no sizes — ready to print");
    } else {
      setState((s) => markAllNormal(s, study));
      toast.success("All organs set to normal");
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (!mod && !typing && e.key.toLowerCase() === "n" && !e.altKey) {
        e.preventDefault();
        rushNormalRef.current();
        return;
      }

      if (!mod && !typing && e.key.toLowerCase() === "f" && !e.altKey) {
        e.preventDefault();
        if (!isFinal) setQualityOpen(true);
        return;
      }

      if (!mod && !typing && e.key.toLowerCase() === "p" && !e.altKey) {
        e.preventDefault();
        void printRefFn.current();
        return;
      }

      if (!mod && !typing && e.key === " " && !e.altKey) {
        e.preventDefault();
        setFocusedOrganIdx((i) => {
          const next = (i + 1) % Math.max(study.organs.length, 1);
          setTimeout(() => {
            const wrapper = document.querySelector(`[data-organ-idx="${next}"]`);
            if (wrapper) {
              const focusable = wrapper.querySelector('input:not([type="hidden"]), select, textarea, button') as HTMLElement;
              if (focusable) focusable.focus();
            }
          }, 50);
          return next;
        });
        return;
      }

      if (!mod && !typing && /^[1-9]$/.test(e.key) && !e.altKey) {
        const organ = study.organs[focusedOrganIdx];
        if (!organ || isFinal) return;
        const preferNoSize = studyAllowsRushNormals(study);
        const chips = sortPathologiesForChips(
          pathologiesForOrgan(pathologies, organ.key),
          preferNoSize,
        ).slice(0, 9);
        const chip = chips[Number(e.key) - 1];
        if (!chip) return;
        e.preventDefault();
        togglePathologyRef.current(organ.key, chip.key);
        return;
      }

      if (!mod) return;
      if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (!isFinal) setPickerOpen(true);
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!isFinal && !busyRef.current) void persistRef.current?.("");
      } else if (e.key.toLowerCase() === "p") {
        e.preventDefault();
        void printRefFn.current();
      } else if (e.key === "Enter") {
        if (!isFinal && !busyRef.current) {
          e.preventDefault();
          void finalizeFastRef.current(e.shiftKey);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFinal, study.organs, focusedOrganIdx, pathologies, setFocusedOrganIdx, setQualityOpen, setPickerOpen, persistRef, printRefFn, finalizeFastRef, togglePathologyRef, busyRef, state, setState, study]);
  return null;
}

export const ComposerToolbar = memo(function ComposerToolbar(p: ComposerToolbarProps) {
  const {
    onBack, headerCollapsed, setHeaderCollapsed, patientName, patientAge, patientSex, referredBy, setReferredBy,
    resolved, abnormalCount, serial, isFinal, fullscreen, setFullscreen, persist, busy, finalizeFast, print,
    settings, normalOverrides, state, setState, setCommOpen, savedIdRef, report, scanDate, setScanDate, fmtPrintDate, lastAutosave,
    order, orderUid, pullFromMachine, pulling, study, formFDefaults, setFormFOpen, pullSummary, setPullSummary,
    onNameChange, patients, patientPhone, setPatientPhone, setPatientAge, studyKey, setStudyKey, setTechnique,
    setPatientSex, showTechnique, setShowTechnique, isPregnancyStudy, lmp, setLmp, lmpInfo, technique,
    restoreSnap, setRestoreSnap, restoreDraft, dKey, diffSource, pathologies, patientReports, togglePathology,
  } = p;

  const applyAllNormalMacro = () => {
    if (isFinal) return;
    let applied = 0;
    for (const def of study.organs) {
      if (isGridOrgan(def)) continue;
      if (!def.normal?.trim()) continue;
      const organState = state.organs.find((o) => o.organ === def.key);
      if (!organState) continue;
      if (selectedPathologies(organState).length > 0) continue;
      togglePathology(def.key, null);
      applied += 1;
    }
    if (applied > 0) toast.success(`All Normal — ${applied} organ(s)`);
    else toast.message("Abnormals preserved — nothing left to set normal");
  };

  const pickStudy = (k: string) => {
    const target = getStudy(k);
    if (!target) return;
    const prevStudy = getStudy(studyKey);
    const prevDefault =
      settings.studyTechniqueDefaults?.[studyKey]?.trim() ||
      prevStudy?.technique?.trim() ||
      "";
    const nextDefault =
      settings.studyTechniqueDefaults?.[k]?.trim() || target.technique;
    setStudyKey(k);
    setTechnique((cur) => {
      const t = cur.trim();
      if (!t || t === prevDefault) return nextDefault;
      return cur;
    });
    setState((s) => switchStudy(s, k, normalOverrides));
    if (k === "wa-child") setPatientSex(USG_SEX_CHILD);
    else if (target.sex === "F" || target.sex === "M") setPatientSex(target.sex);
  };

  const changeSex = (sex: "F" | "M" | typeof USG_SEX_CHILD) => {
    setPatientSex(sex);
    const adultSexStudy =
      studyKey === "wa-female" || studyKey === "wa-male" || studyKey === "la-female" || studyKey === "la-male";
    if (sex === USG_SEX_CHILD) {
      if (adultSexStudy) pickStudy("wa-child");
    } else if (sex === "M" && (studyKey === "wa-female" || studyKey === "la-female")) {
      pickStudy(studyKey === "wa-female" ? "wa-male" : "la-male");
    } else if (sex === "F" && (studyKey === "wa-male" || studyKey === "la-male")) {
      pickStudy(studyKey === "wa-male" ? "wa-female" : "la-female");
    }
  };

  const applyLmp = (v: string) => {
    setLmp(v);
    const d = parseLmpInput(v);
    if (!d) return;
    const { weeks, days, edd } = lmpSummary(d);
    const target = state.studyKey === "ob" ? "biometry" : "gravid-uterus";
    setState((s) => {
      let next = s;
      next = setOrganVar(next, target, "gaw", String(weeks));
      next = setOrganVar(next, target, "gad", String(days));
      next = setOrganVar(next, target, "edd", edd);
      return next;
    });
    toast.success(`GA ${weeks} wk ${days} d · EDD ${edd} filled from LMP`);
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setFullscreen(true);
      } else {
        await document.exitFullscreen();
        setFullscreen(false);
      }
    } catch {
      setFullscreen((v) => !v);
    }
  };

  useEffect(() => {
    const onFsChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [setFullscreen]);


  return (
    <>
    <div className="shrink-0 border-b border-border bg-card/95 backdrop-blur">
      {/* ── Row 1: compact patient line + fullscreen + actions ─────────── */}
      <div
        className={cn("flex items-center gap-2 px-3 py-1.5 cursor-pointer select-none", headerCollapsed ? "hover:bg-muted/40" : "")}
        onClick={() => setHeaderCollapsed((v) => !v)}
        title={headerCollapsed ? "Click to expand patient details" : "Click to collapse — start reporting"}
      >
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onBack(); }} className="h-7 w-7 p-0 text-muted-foreground shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>

        {headerCollapsed ? (
          <div className="flex min-w-0 flex-1 items-center gap-2 text-[12px]">
            <span className="truncate font-bold text-foreground">{patientName || "New report"}</span>
            {patientAge ? <span className="text-muted-foreground shrink-0">{patientAge}y</span> : null}
            <span className="text-muted-foreground shrink-0">{patientSex === USG_SEX_CHILD ? "Child" : patientSex}</span>
            {referredBy ? <span className="truncate text-faint hidden sm:inline">· {referredBy}</span> : null}
            <span className="text-faint shrink-0 hidden md:inline">{resolved.study.label}</span>
            {abnormalCount ? (
              <span className="shrink-0 rounded-full bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold text-rose-700">{abnormalCount} organ{abnormalCount > 1 ? "s" : ""}</span>
            ) : (
              <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">All normal</span>
            )}
            {serial ? <span className="shrink-0 rounded-full bg-sky-50 px-1.5 py-0.5 text-[9px] font-bold text-sky-700">{serial}</span> : null}
            {isFinal ? <span className="shrink-0 text-[10px] font-bold text-amber-600">FINAL</span> : null}
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate text-[13px] font-bold text-foreground">{patientName || "New report"}</span>
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground rotate-180" />
          </div>
        )}

        {/* Fullscreen + critical-comm only — Save/Finalize/Print live in the sticky bottom bar */}
        <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" onClick={() => void toggleFullscreen()}
            className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-foreground"
            title={fullscreen ? "Exit fullscreen (Esc)" : "Enter fullscreen — hides browser tabs"}>
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
          {(() => {
            if (settings.enableCriticalComm === false) return null;
            const sel = state.organs.flatMap((o) =>
              (o.pathologies ?? (o.pathology ? [o.pathology] : [])).map((k) => ({
                key: k, label: k, organ: o.organ,
              })),
            );
            const criticalAlerts = scanForCriticalFindings(sel);
            const hasCritical = criticalAlerts.length > 0;
            if (!hasCritical && !isFinal) return null;
            return (
              <Button size="sm" variant="outline" onClick={() => setCommOpen(true)}
                title="Critical finding communication log (PCPNDT/NMC legal record)"
                className="h-7 border-rose-300 bg-rose-100 px-2 text-rose-700 hover:bg-rose-200">
                <Phone className="h-3.5 w-3.5" />
              </Button>
            );
          })()}
        </div>
      </div>

      {/* ── Row 2: study title + status badges (thin line) ─────────────── */}
      <div className="flex items-center gap-1.5 px-3 pb-1 text-[10px] text-muted-foreground">
        <span className="font-semibold text-foreground">{resolved.title}</span>
        <span className={cn("rounded-full px-1.5 py-0.5 font-semibold", abnormalCount ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700")}>
          {abnormalCount ? `${abnormalCount} organ${abnormalCount > 1 ? "s" : ""} affected` : "All normal"}
        </span>
        {serial ? <span className="rounded-full bg-sky-50 px-1.5 py-0.5 font-bold text-sky-700">{serial}</span> : null}
        {isFinal ? (
          <span className="rounded-full bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-700">finalized</span>
        ) : (
          <span className="rounded-full bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-700">draft</span>
        )}
        {lastAutosave && !isFinal ? (
          <span className="text-[9px] text-emerald-600">· autosaved {new Date(lastAutosave).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
        ) : null}
      </div>

      <UsgTipsRibbon />

      {/* ── Expanded: full patient input form ──────────────────────────── */}
      {!headerCollapsed && (
        <>
          {/* CARE order banner */}
          {order ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-sky-100 bg-sky-50/60 px-3 py-1 text-[10px]">
              <Link2 className="h-3 w-3 text-sky-600" />
              <span className="font-mono font-bold text-sky-800">
                {order.accessionNumber ?? (order.careWorklistId ? `WL ${order.careWorklistId}` : "Bill-desk order")}
              </span>
              {order.billNumber ? <span className="text-sky-700">· Bill {order.billNumber}</span> : null}
              {order.testName ? <span className="truncate text-sky-700">· {order.testName}</span> : null}
              {order.billingStatus ? (
                <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-bold ring-1",
                  order.billingStatus === "PAID" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-amber-200")}>
                  {order.billingStatus}
                </span>
              ) : null}
              <div className="ml-auto flex items-center gap-1">
                {orderUid ? (
                  <Button size="sm" variant="outline" onClick={() => void pullFromMachine()} disabled={pulling || isFinal}
                    className="h-6 border-violet-200 bg-white px-1.5 text-[10px] font-semibold text-violet-700 hover:bg-violet-50">
                    {pulling ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <ScanLine className="mr-1 h-3 w-3" />}
                    Pull
                  </Button>
                ) : null}
                {study.pcpndt && formFDefaults ? (
                  <Button size="sm" variant="outline" onClick={() => setFormFOpen(true)}
                    className="h-6 border-rose-200 bg-white px-1.5 text-[10px] font-semibold text-rose-700 hover:bg-rose-50">
                    <FileCheck2Icon className="mr-1 h-3 w-3" /> Form F
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Pull summary */}
          {pullSummary ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-violet-100 bg-violet-50/50 px-3 py-1 text-[10px] text-violet-800">
              <b>Pulled {pullSummary.matchedCount} slot(s)</b>
              <span className="text-violet-600">{pullSummary.source === "sr" ? "from SR" : pullSummary.source === "ocr" ? "via OCR" : "nothing"}</span>
              {Object.keys(pullSummary.extras).length ? (
                <span className="truncate text-violet-600">
                  · unmatched: {Object.entries(pullSummary.extras).slice(0, 4).map(([k, v]) => `${k} ${v}`).join("; ")}
                </span>
              ) : null}
              <button className="ml-auto text-[9px] font-bold text-violet-500 underline" onClick={() => setPullSummary(null)}>dismiss</button>
            </div>
          ) : null}

          {/* Patient inputs — compact single row (keep short so workspace stays usable) */}
          <div className="flex flex-wrap items-end gap-1.5 border-t border-border px-3 py-1">
            <div className="grid flex-1 min-w-[140px] gap-0.5">
              <Label className="text-[9px] font-semibold uppercase tracking-wide text-faint">Patient</Label>
              <Input value={patientName} onChange={(e) => onNameChange(e.target.value)} placeholder="Type patient name…"
                list="usg-patient-names" disabled={isFinal}
                className="h-8 border-border bg-panel text-[12px] font-semibold" />
              <datalist id="usg-patient-names">
                {patients.map((p) => (
                  <option key={p.id} value={p.name}>{p.phone ? `${p.phone}${p.scanCount ? ` · ${p.scanCount} scan${p.scanCount > 1 ? "s" : ""}` : ""}` : p.scanCount ? `${p.scanCount} scan${p.scanCount > 1 ? "s" : ""}` : ""}</option>
                ))}
              </datalist>
            </div>
            <div className="grid w-[110px] gap-0.5">
              <Label className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-faint"><Phone className="h-2.5 w-2.5" />Phone</Label>
              <Input value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} placeholder="Optional"
                inputMode="tel" disabled={isFinal}
                className="h-8 border-border bg-panel text-[11px]" />
            </div>
            <div className="grid w-[70px] gap-0.5">
              <Label className="text-[9px] font-semibold uppercase tracking-wide text-faint">Age</Label>
              <Input value={patientAge} onChange={(e) => setPatientAge(e.target.value)} placeholder="Yrs"
                className="h-8 border-border bg-panel text-[12px]" />
            </div>
            <div className="grid w-[72px] gap-0.5">
              <Label className="text-[9px] font-semibold uppercase tracking-wide text-faint">Sex</Label>
              <Select value={patientSex} onValueChange={(v) => changeSex(v as "F" | "M" | typeof USG_SEX_CHILD)}>
                <SelectTrigger className="h-8 border-border bg-panel text-[12px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="F">F</SelectItem>
                  <SelectItem value="M">M</SelectItem>
                  <SelectItem value={USG_SEX_CHILD}>Child</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid flex-1 min-w-[140px] gap-0.5">
              <Label className="text-[9px] font-semibold uppercase tracking-wide text-faint">Referred by</Label>
              {/* v6.16: autocomplete from the doctor directory */}
              <UsgDoctorAutocomplete value={referredBy} onChange={setReferredBy} disabled={isFinal} />
            </div>
            <div className="grid w-[130px] gap-0.5">
              <Label className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-faint"><CalendarDays className="h-2.5 w-2.5" />Scan date</Label>
              <Input type="date" value={scanDate} onChange={(e) => setScanDate(e.target.value)} disabled={isFinal}
                className="h-8 border-border bg-panel text-[11px]" />
            </div>
            <div className="grid min-w-[160px] gap-0.5">
              <Label className="text-[9px] font-semibold uppercase tracking-wide text-faint">Study</Label>
              <Select value={studyKey} onValueChange={pickStudy}>
                <SelectTrigger className="h-8 border-border bg-panel text-[12px] font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-96 overflow-y-auto">
                  {STUDY_GROUPS.map((g) => {
                    const studies = USG_STUDIES.filter((s) => s.group === g.key);
                    if (!studies.length) return null;
                    return (
                      <SelectGroup key={g.key}>
                        <SelectLabel className="text-[10px] font-bold uppercase tracking-wider text-faint">{g.label}</SelectLabel>
                        {studies.map((s) => (
                          <SelectItem key={s.key} value={s.key} className="text-[12px]">{s.label}</SelectItem>
                        ))}
                      </SelectGroup>
                    );
                  })}
                  {USG_STUDIES.filter((s) => !s.group || !STUDY_GROUPS.some((g) => g.key === s.group)).map((s) => (
                    <SelectItem key={s.key} value={s.key} className="text-[12px]">{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isFinal ? (
              <Button size="sm" variant="outline" disabled={busy !== ""}
                onClick={() => {
                  const id = savedIdRef.current ?? report?.id;
                  if (!id) return;
                  void shareReportWhatsapp(id).then((r) => {
                    if (r === "failed") toast.error("Could not create share link");
                    else if (r === "copied") { /* toast already shown */ }
                    else if (r === "opened" || r === "doctor_prompt") toast.success("WhatsApp share opened");
                  });
                }}
                title="Share via WhatsApp — secure 7-day link" className="h-8 border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                <MessageCircle className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>

          {/* Secondary row: technique toggle + calculators + LMP */}
          <div className="flex flex-wrap items-center gap-1.5 px-3 pb-1.5 text-[10px] text-muted-foreground">
            <button onClick={() => setShowTechnique((v) => !v)}
              className="flex items-center gap-1 rounded-full border border-border bg-panel px-1.5 py-0.5 hover:text-foreground">
              <Settings2 className="h-2.5 w-2.5" /> Technique
              <ChevronDown className={cn("h-2.5 w-2.5 transition-transform", showTechnique && "rotate-180")} />
            </button>
            <UsgCalculators />
            {isPregnancyStudy && (
              <div className="flex items-center gap-1">
                <Label className="flex items-center gap-0.5 text-[9px] font-bold uppercase text-rose-600">
                  <CalendarDays className="h-2.5 w-2.5" /> LMP
                </Label>
                <Input type="date" value={lmp} onChange={(e) => applyLmp(e.target.value)}
                  className="h-6 w-[110px] border-rose-200 bg-white text-[11px]" />
                {lmpInfo ? (
                  <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-rose-200">
                    {lmpInfo.weeks}w{lmpInfo.days}d · EDD {lmpInfo.edd}
                  </span>
                ) : null}
              </div>
            )}
          </div>

          {showTechnique ? (
            <div className="flex items-start gap-1 px-3 pb-1.5">
              <Textarea value={technique} onChange={(e) => setTechnique(e.target.value)} rows={1} disabled={isFinal}
                className="border-border bg-panel text-[11px]" placeholder="Technique…" />
              <DictationButton onText={(t) => setTechnique((prev) => appendTranscript(prev, t))}
                title="Dictate technique" />
            </div>
          ) : null}
        </>
      )}

      {/* Critical findings banner (always visible — even when collapsed) */}
      <UsgCriticalBanner
        selectedPathologies={state.organs.flatMap((o) =>
          (o.pathologies ?? (o.pathology ? [o.pathology] : [])).map((k) => ({
            key: k, label: k, organ: o.organ,
          })),
        )}
        onLogCall={settings.enableCriticalComm === false ? undefined : () => setCommOpen(true)}
      />

      {/* Crash recovery banner */}
      {restoreSnap ? (
        <div className="border-t border-amber-200 bg-amber-50/90 px-3 py-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold text-amber-800">
              Unsaved draft from {new Date(restoreSnap.savedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} — newer than saved.
            </span>
            <div className="ml-auto flex gap-1">
              <Button size="sm" className="h-6 bg-amber-600 px-2 text-[10px] hover:bg-amber-700" onClick={restoreDraft}>Restore</Button>
              <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => { clearDraft(dKey); setRestoreSnap(null); }}>Discard</Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Follow-up diff */}
      {diffSource && !isFinal ? (
        <UsgDiffPanel
          source={diffSource}
          state={state}
          pathologies={pathologies}
          onCopyForward={() => {
            try {
              const prior = JSON.parse(diffSource.stateJson) as UsgComposerState;
              const { state: next, filledCount } = copyForwardMeasurements(state, prior);
              setState(next);
              toast.success(
                filledCount > 0
                  ? `Filled ${filledCount} empty measurement slot(s) from prior scan`
                  : "No empty slots to fill — already complete",
              );
            } catch {
              toast.error("Could not read prior scan state");
            }
          }}
        />
      ) : null}

      {/* Pregnancy timeline */}
      {isObStudyKey(state.studyKey) && patientReports.length > 0 && (
        <div className="px-3 py-1 space-y-2">
          <UsgPregnancyTimeline timeline={buildPregnancyTimeline(patientReports)} />
          {/* v6.9 — wired up the orphaned UsgGrowthChart. Plot EFW/BPD/HC/AC/FL
              across this pregnancy's visits on Hadlock percentile curves so the
              radiologist can spot IUGR / macrosomia at a glance. */}
          {(() => {
            const tl = buildPregnancyTimeline(patientReports);
            const pts = tl.points
              .map((p) => ({
                gaWeeks: p.gaWeeks ?? 0,
                efw: p.efw ?? undefined,
                bpd: p.bpd ?? undefined,
                hc: p.hc ?? undefined,
                ac: p.ac ?? undefined,
                fl: p.fl ?? undefined,
              }))
              .filter((p) => p.gaWeeks > 0);
            return pts.length > 0 ? <UsgGrowthChart points={pts} /> : null;
          })()}
        </div>
      )}
    </div>

    {/* Quick report — single compact row (never wraps into a tall ribbon) */}
    {!isFinal && (
      <div className="flex min-w-0 items-center gap-1.5 border-b border-emerald-200 bg-emerald-50/70 px-2.5 py-1">
        <span className="shrink-0 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          Quick
        </span>
        {studyAllowsRushNormals(study) ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 shrink-0 border-amber-400 bg-amber-100 px-2 text-[11px] font-bold text-amber-950 hover:bg-amber-200"
              title="Peak-time: mark every organ normal with no size measurements (keyboard: N)"
              onClick={() => {
                const next = applyRushNormalStudy(state, study);
                if (!next) {
                  toast.error("This study needs measurements — use organ cards");
                  return;
                }
                setState(next);
                toast.success("All normal · no sizes — ready to print");
              }}
            >
              <Zap className="mr-1 h-3.5 w-3.5" />
              All normal
            </Button>
            {study.organs.some((o) => o.key === "liver") ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 shrink-0 border-orange-400 bg-orange-100 px-2 text-[11px] font-bold text-orange-950 hover:bg-orange-200"
                title="Almost-normal abdomen with fatty liver Gr I · no sizes"
                onClick={() => {
                  const next = applyRushPreset(state, study, "fatty-g1", (k) => pathologies.find((p) => p.key === k));
                  if (!next) {
                    toast.error("This study needs measurements — use organ cards");
                    return;
                  }
                  setState(next);
                  toast.success("NP + Fatty Gr I · no size — ready to print");
                }}
              >
                + Fatty
              </Button>
            ) : null}
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 shrink-0 border-emerald-400 bg-emerald-100 px-2 text-[11px] font-bold text-emerald-950 hover:bg-emerald-200"
            title="Clear all pathologies back to measured normals"
            onClick={() => {
              setState((s) => markAllNormal(s, study));
              toast.success("All organs set to normal");
            }}
          >
            <Zap className="mr-1 h-3.5 w-3.5" />
            Clear all
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 shrink-0 border-emerald-600 bg-emerald-600 px-2.5 text-[11px] font-bold text-white hover:bg-emerald-700"
          title="Fill every unset organ with its normal finding (leaves abnormals untouched)"
          onClick={applyAllNormalMacro}
        >
          <Check className="mr-1 h-3.5 w-3.5" />
          All Normal
        </Button>
        <UsgFormatsLibrary organs={state.organs} onApply={(organs, imp) => setState((p) => ({ ...p, organs, impressionOverride: imp ?? p.impressionOverride }))} />
        <div className="min-w-0 flex-1 border-l border-emerald-200/80 pl-1.5">
          <UsgTemplateBar
            onApply={(template) => {
              try {
                const savedState = JSON.parse(template.stateJson) as UsgComposerState;
                const target = getStudy(template.studyKey);
                if (target) {
                  setStudyKey(template.studyKey);
                  const nextDefault =
                    settings.studyTechniqueDefaults?.[template.studyKey]?.trim() || target.technique;
                  setTechnique(nextDefault);
                  if (template.studyKey.includes("child")) setPatientSex(USG_SEX_CHILD);
                  else if (template.studyKey.includes("female") || template.studyKey === "tvs" || template.studyKey === "ob") setPatientSex("F");
                  else if (template.studyKey.includes("male")) setPatientSex("M");
                }
                setState(savedState);
                toast.success(`Template applied: ${template.name}`);
              } catch {
                toast.error("Could not apply template — corrupted state");
              }
            }}
            currentStateJson={JSON.stringify(state)}
            currentStudyKey={state.studyKey}
          />
        </div>
      </div>
    )}
    </>
  );
}, toolbarEqual);
