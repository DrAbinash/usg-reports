"use client";
/**
 * USG composer — the doctor's whole-abdomen workflow:
 *   patient strip (incl. back-datable scan date + LMP calculator on pregnancy
 *   studies) → organ cards (quick-select pathologies that swap ONE organ's
 *   finding, several at once for combined findings) → auto impression →
 *   live letterhead preview (PROVISIONAL while a draft) → print.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ArrowLeft, CalendarDays, ChevronDown, Command, FileCheck2, Loader2, Maximize2, Minimize2, Phone, Printer, Save, Search, Settings2 } from "lucide-react";
import type { UsgComposerState, UsgPathologyDef } from "@/lib/usg/types";
import { USG_SEX_CHILD } from "@/lib/usg/types";
import { USG_STUDIES, STUDY_GROUPS, applyNormalOverrides, getStudy, normalOverrideKey, type NormalOverrides } from "@/lib/usg/studies";
import {
  applyPathologies,
  makeLookup,
  normaliseState,
  pathologiesForOrgan,
  resolve,
  selectedPathologies,
  setOrganText,
  setOrganVar,
  switchStudy,
} from "@/lib/usg/composer";
import { buildUsgReportHtml, formatUsgSerial, type UsgPrintSettings } from "@/lib/usg/print";
import { lmpSummary, parseLmpInput } from "@/lib/usg/lmp";
import { toScanDateInput } from "@/lib/usg/dates";
import { UsgOrganCard } from "./UsgOrganCard";
import { UsgPathologyDialog } from "./UsgPathologyDialog";
import { UsgDiffPanel, type DiffSource } from "./UsgDiffPanel";
import { UsgBiometryCalc } from "./UsgBiometryCalc";
import { UsgCalculators } from "./UsgCalculators";
import { UsgImagesCard, type ImageRow, type PendingImage } from "./UsgImagesCard";
import { UsgDicomPicker } from "./UsgDicomPicker";
import { UsgFormFDialog, type FormFDefaults, type FormFOrderLite } from "./UsgFormFDialog";
import { DictationButton } from "./DictationButton";
import { UsgStudyPicker } from "./UsgStudyPicker";
import { UsgCriticalBanner } from "./UsgCriticalBanner";
import { UsgQualityChecklist } from "./UsgQualityChecklist";
import { UsgMeasurementReviewDialog } from "./UsgMeasurementReviewDialog";
import { UsgPregnancyTimeline } from "./UsgPregnancyTimeline";
import { buildPregnancyTimeline } from "@/lib/usg/pregnancyTimeline";
import { appendTranscript } from "@/lib/usg/dictation";
import { clearDraft, draftKey, loadDraft, saveDraft, snapshotDiffers, type DraftSnapshot } from "@/lib/usg/drafts";
import { downloadReportPdf, shareReportPdf } from "./sharePdf";
import { FileDown, MessageCircle, FileCheck2 as FileCheck2Icon, ScanLine, Link2 } from "lucide-react";

/** v6: the bill-desk order a report came from (banner, PACS, Form F). */
export type ReportOrderLite = FormFOrderLite & {
  studyInstanceUid: string | null;
  billingStatus: string | null;
  careSyncedAt: string | null;
};

export type UsgReportRow = {
  id: string;
  patientName: string;
  patientAge: string;
  patientSex: string;
  referredBy: string;
  studyKey: string;
  studyTitle: string;
  technique: string;
  stateJson: string;
  findings: string;
  impression: string;
  status: string;
  reportHtml: string | null;
  createdAt: string;
  /** Register number — stamped at first finalization, never renumbered. */
  serialNo?: number | null;
  /** Scan date as performed (back-datable), ISO-ish yyyy-mm-dd or null. */
  scanDate?: string | null;
  /** Registry patient (v5) — phone travels with the report row. */
  patient?: { id: string; name: string; phone: string } | null;
  /** Machine stills attached to the report (v5). */
  images?: ImageRow[];
  /** Bill-desk order this report was started from (v6). */
  order?: ReportOrderLite | null;
};

/** Registry autocomplete entry from /api/usg/patients. */
type PatientSuggestion = { id: string; name: string; phone: string; scanCount: number };

export type UsgComposerProps = {
  pathologies: UsgPathologyDef[];
  settings: UsgPrintSettings;
  report: UsgReportRow | null; // existing draft to continue, or null = new
  /** "New scan for patient" prefill from the registry (report stays null). */
  prefill?: { patientName?: string; patientPhone?: string; patientAge?: string; patientSex?: string } | null;
  /** Previous-scan snapshot for the follow-up diff panel (follow-up drafts). */
  diffSource?: DiffSource | null;
  /** The doctor's normal-wording overrides (v5) — builtin normals retuned. */
  normalOverrides?: NormalOverrides | null;
  /** v6: the bill-desk order behind this report (banner, PACS pull, Form F). */
  order?: ReportOrderLite | null;
  /** v6: settings needed for the Form F fixed details. */
  formFDefaults?: FormFDefaults | null;
  onBack: () => void;
  onSaved: () => void; // refresh list
};

function fmtPrintDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function UsgComposer({ pathologies, settings, report, prefill, diffSource, normalOverrides, order, formFDefaults, onBack, onSaved }: UsgComposerProps) {
  const initial = useMemo(() => {
    if (!report) return null;
    try {
      return JSON.parse(report.stateJson) as UsgComposerState;
    } catch {
      return null;
    }
  }, [report]);

  const studyKey0 = report?.studyKey ?? "wa-female";
  const [patientName, setPatientName] = useState(report?.patientName ?? prefill?.patientName ?? "");
  const [patientPhone, setPatientPhone] = useState(report?.patient?.phone ?? prefill?.patientPhone ?? "");
  const [patientAge, setPatientAge] = useState(report?.patientAge ?? prefill?.patientAge ?? "");
  const [patientSex, setPatientSex] = useState(
    (report?.patientSex ?? prefill?.patientSex ?? "F") as "F" | "M" | typeof USG_SEX_CHILD,
  );
  const [patients, setPatients] = useState<PatientSuggestion[]>([]);
  const [referredBy, setReferredBy] = useState(report?.referredBy ?? "");
  const [studyKey, setStudyKey] = useState(studyKey0);
  const study = useMemo(
    () => applyNormalOverrides(getStudy(studyKey) ?? USG_STUDIES[0], normalOverrides),
    [studyKey, normalOverrides],
  );
  const [technique, setTechnique] = useState(report?.technique ?? study.technique);
  const [state, setState] = useState<UsgComposerState>(
    () => initial ?? { studyKey: studyKey0, organs: study.organs.map((o) => ({ organ: o.key, pathology: null, pathologies: [], custom: false, text: o.normal, vars: {} })), impressionOverride: null },
  );
  const [scanDate, setScanDate] = useState(() => toScanDateInput(report?.scanDate ? new Date(report.scanDate) : null));
  const [lmp, setLmp] = useState("");
  const [impressionManual, setImpressionManual] = useState(!!initial?.impressionOverride);
  const [showTechnique, setShowTechnique] = useState(false);
  const [busy, setBusy] = useState<"" | "save" | "finalize" | "print">("");
  /** Id learned from the first POST — later saves PUT the same row (no duplicates). */
  const savedIdRef = useRef<string | null>(report?.id ?? null);
  /** Register serial — from the report row (already finalized) or the finalize response. */
  const [serial, setSerial] = useState<string | undefined>(
    report?.serialNo != null ? formatUsgSerial(report.serialNo) : undefined,
  );
  const [finalizedHere, setFinalizedHere] = useState(report?.status === "FINALIZED");
  const [qualityOpen, setQualityOpen] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewSrResult, setReviewSrResult] = useState<{ vars: Record<string, Record<string, string>>; extras: Record<string, string>; matchedCount: number } | null>(null);
  const [reviewSrMeasurements, setReviewSrMeasurements] = useState<Array<{ conceptName: string; value: string; unit: string; path?: string }>>([]);
  const [patientReports, setPatientReports] = useState<Array<{ id: number; scanDate: string | null; stateJson: string | null; studyKey: string | null; status: string }>>([]);
  const [dialogOrgan, setDialogOrgan] = useState<string | null>(null);
  const printRef = useRef<HTMLIFrameElement>(null);

  // Machine stills (v5): server rows + locally buffered ones (before the
  // first save creates the report row they belong to).
  const [images, setImages] = useState<ImageRow[]>(report?.images ?? []);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const captionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Crash recovery (v5): a local snapshot newer than the saved row is offered
  // for restore; a debounced autosave keeps the snapshot fresh.
  const dKey = useMemo(() => draftKey(report?.id ?? null), [report]);
  const [restoreSnap, setRestoreSnap] = useState<DraftSnapshot | null>(null);
  const [lastAutosave, setLastAutosave] = useState<number | null>(null);
  const dirtyRef = useRef(false);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const [pickerOpen, setPickerOpen] = useState(false);

  // v6 — CARE order integration: PACS key images, SR measurement pull, Form F.
  const [dicomOpen, setDicomOpen] = useState(false);
  const [formFOpen, setFormFOpen] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pullSummary, setPullSummary] = useState<{ source: string; matchedCount: number; extras: Record<string, string> } | null>(null);

  const orderUid = order?.studyInstanceUid ?? null;
  const reportIdForPacs = savedIdRef.current ?? report?.id ?? null;

  /** Pull machine measurements (DICOM SR first, Vision OCR fallback) into
   *  the study's variable slots — the typist-less biometry path. */
  const pullFromMachine = async () => {
    const rid = savedIdRef.current ?? report?.id ?? null;
    if (!rid) {
      toast.info("Save the draft once — then pull the machine's measurements");
      return;
    }
    setPulling(true);
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
      // If SR measurements were found, show the review dialog before applying
      if (r.source === "sr" && (r.matchedCount ?? 0) > 0) {
        const srResult = {
          vars: (r.vars ?? {}) as Record<string, Record<string, string>>,
          extras: (r.extras ?? {}) as Record<string, string>,
          matchedCount: r.matchedCount ?? 0,
        };
        // Build mock SrMeasurement array from the vars for confidence scoring
        const srMeasurements = Object.entries(srResult.vars).flatMap(([organ, kv]) =>
          Object.entries(kv).map(([k, v]) => ({ conceptName: `${organ}.${k}`, value: v, unit: "" })),
        );
        setReviewSrResult(srResult);
        setReviewSrMeasurements(srMeasurements);
        setReviewOpen(true);
        setPullSummary({ source: r.source ?? "none", matchedCount: r.matchedCount ?? 0, extras: srResult.extras });
        return;
      }
      // Non-SR (OCR or none): apply directly as before
      const vars = (r.vars ?? {}) as Record<string, Record<string, string>>;
      let applied = 0;
      setState((s) => {
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
      setPullSummary({ source: r.source ?? "none", matchedCount: r.matchedCount ?? 0, extras: (r.extras ?? {}) as Record<string, string> });
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
      setPulling(false);
    }
  };

  const lookup = useMemo(() => makeLookup(pathologies), [pathologies]);
  const resolved = useMemo(() => resolve(state, lookup, technique, normalOverrides), [state, lookup, technique, normalOverrides]);

  /** Retune one organ's builtin normal (v5) — the composer's own wording
   *  resets to it when the organ is still showing its normal text. */
  const saveNormalOverride = async (organKey: string, text: string) => {
    const res = await fetch("/api/usg/normals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studyKey, organKey, text }),
    });
    if (!res.ok) {
      toast.error((await res.json().catch(() => ({}))).error ?? "Could not save the wording");
      return;
    }
    const newText = text.trim();
    setState((s) => ({
      ...s,
      organs: s.organs.map((o) =>
        o.organ === organKey && !selectedPathologies(o).length && !o.custom
          ? { ...o, text: newText }
          : o,
      ),
    }));
    toast.success("Normal wording saved — every future report uses it");
  };

  const resetNormalOverride = async (organKey: string) => {
    const res = await fetch(`/api/usg/normals?studyKey=${encodeURIComponent(studyKey)}&organKey=${encodeURIComponent(organKey)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Could not reset the wording");
      return;
    }
    const builtin = getStudy(studyKey)?.organs.find((o) => o.key === organKey)?.normal ?? "";
    setState((s) => ({
      ...s,
      organs: s.organs.map((o) =>
        o.organ === organKey && !selectedPathologies(o).length && !o.custom
          ? { ...o, text: builtin }
          : o,
      ),
    }));
    toast.success("Back to the builtin wording");
  };

  // Registry autocomplete — known patients appear under the name box; picking
  // one fills the phone (and links this report into her history on save).
  // For obstetric studies, also loads the patient's prior obstetric reports
  // to build the pregnancy timeline.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/usg/patients")
      .then((r) => (r.ok ? r.json() : { patients: [] }))
      .then((d) => {
        if (!cancelled) setPatients(((d.patients ?? []) as PatientSuggestion[]).slice(0, 300));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Load patient's prior reports for the pregnancy timeline (obstetric only)
  useEffect(() => {
    if (!patientName.trim() || !state.studyKey.startsWith("ob-")) {
      setPatientReports([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/usg/reports?patientName=${encodeURIComponent(patientName.trim())}&limit=20`)
      .then((r) => (r.ok ? r.json() : { reports: [] }))
      .then((d) => {
        if (!cancelled) {
          const reports = (d.reports ?? d ?? []) as Array<{ id: number; scanDate: string | null; stateJson: string | null; studyKey: string | null; status: string }>;
          setPatientReports(reports);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [patientName, state.studyKey]);

  const normName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const onNameChange = (v: string) => {
    setPatientName(v);
    const hit = patients.find((p) => normName(p.name) === normName(v));
    if (hit && hit.phone) setPatientPhone((prev) => prev.trim() || hit.phone);
  };

  const isPregnancyStudy = studyKey === "ob" || studyKey === "ep";
  const isFinal = report?.status === "FINALIZED" || finalizedHere;

  // ── Crash recovery: detect a local snapshot ahead of the saved row ──────
  const initialSnap = useMemo(
    () => ({
      patientName,
      patientPhone,
      patientAge,
      patientSex,
      referredBy,
      studyKey,
      technique,
      scanDate,
      state,
    }),
    // Intentionally computed once from the initial mount values.
    [],
  );


  useEffect(() => {
    if (isFinal) return;
    const snap = loadDraft(dKey);
    if (snap && snapshotDiffers(snap, initialSnap)) setRestoreSnap(snap);
  }, [dKey, initialSnap]);

  // ── Debounced autosave of the composer snapshot ────────────────────────
  const currentSnap = useMemo<DraftSnapshot>(
    () => ({ savedAt: Date.now(), ...initialSnap, patientName, patientPhone, patientAge, patientSex, referredBy, studyKey, technique, scanDate, state }),
    [initialSnap, patientName, patientPhone, patientAge, patientSex, referredBy, studyKey, technique, scanDate, state],
  );

  useEffect(() => {
    if (isFinal) return;
    dirtyRef.current = snapshotDiffers({ ...currentSnap, savedAt: 0 }, initialSnap);
    if (!dirtyRef.current) return;
    const t = setTimeout(() => {
      if (saveDraft(dKey, { ...currentSnap, savedAt: Date.now() })) setLastAutosave(Date.now());
    }, 1200);
    return () => clearTimeout(t);
  }, [dKey, currentSnap, isFinal, initialSnap]);

  // ── Unsaved-changes guard on tab close / reload ──────────────────────
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current && !isFinal) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isFinal]);

  // ── Keyboard-first flow: Ctrl+S save · Ctrl+Enter finalize · Ctrl+K study ─
  const persistRef = useRef<((status: "" | "finalize") => Promise<string | null>) | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (!isFinal) setPickerOpen(true);
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!isFinal && !busyRef.current) void persistRef.current?.("");
      } else if (e.key === "Enter") {
        if (!isFinal && !busyRef.current) {
          e.preventDefault();
          void persistRef.current?.("finalize");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFinal]);

  const restoreDraft = () => {
    if (!restoreSnap) return;
    setPatientName(restoreSnap.patientName);
    setPatientPhone(restoreSnap.patientPhone);
    setPatientAge(restoreSnap.patientAge);
    setPatientSex(restoreSnap.patientSex as "F" | "M" | typeof USG_SEX_CHILD);
    setReferredBy(restoreSnap.referredBy);
    setScanDate(restoreSnap.scanDate);
    if (restoreSnap.technique) setTechnique(restoreSnap.technique);
    setState(normaliseState(restoreSnap.state, restoreSnap.studyKey));
    if (getStudy(restoreSnap.studyKey)) setStudyKey(restoreSnap.studyKey);
    setRestoreSnap(null);
    toast.success("Local draft restored");
  };

  const previewHtml = useMemo(
    () =>
      buildUsgReportHtml(
        { ...settings, usgPrintPaper: settings.usgPrintPaper ?? "a4" },
        {
          name: patientName || "—",
          age: patientAge,
          sex: patientSex === USG_SEX_CHILD ? "Child" : patientSex,
          referredBy,
          date: fmtPrintDate(scanDate),
          serial,
          // Draft discipline: an unfinalized sheet prints watermarked so it
          // can never be filed as the record by mistake.
          provisional: !isFinal,
        },
        resolved,
        [...images, ...pendingImages].map((i) => ({ dataUrl: i.dataUrl, caption: i.caption })),
      ),
    [settings, patientName, patientAge, patientSex, referredBy, scanDate, serial, resolved, isFinal, images, pendingImages],
  );

  const pickStudy = (k: string) => {
    const target = getStudy(k);
    if (!target) return;
    setStudyKey(k);
    setTechnique(target.technique);
    setState((s) => switchStudy(s, k, normalOverrides));
    // Study drives patient type: pregnancy studies are female, the child
    // scaffold switches the strip to the Child profile.
    if (k === "wa-child") setPatientSex(USG_SEX_CHILD);
    else if (target.sex) setPatientSex(target.sex);
  };

  const changeSex = (sex: "F" | "M" | typeof USG_SEX_CHILD) => {
    setPatientSex(sex);
    // Follow the doctor's convention: whole/lower abdomen track patient sex;
    // Child swaps to the paediatric scaffold; picking M/F on the child study
    // only changes what prints in the Sex box (the scaffold stays paediatric).
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

  const printedSex = patientSex === USG_SEX_CHILD ? "Child" : patientSex;

  const abnormalCount = state.organs.filter((o) => selectedPathologies(o).length).length;

  /** Chip toggle — null clears the organ to normal; a key toggles it, so an
   *  organ can carry several pathologies at once (combined findings). */
  const togglePathology = (organKey: string, key: string | null) => {
    setState((s) => {
      const cur = selectedPathologies(s.organs.find((o) => o.organ === organKey) ?? { pathology: null });
      const next = key === null ? [] : cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
      return applyPathologies(s, organKey, next, lookup, normalOverrides);
    });
  };

  /** LMP calculator — GA & EDD auto-fill into the pregnancy format tokens
   *  ({gaw}/{gad}/{edd}); typing biometry numbers afterwards still wins. */
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

  const lmpInfo = useMemo(() => {
    const d = parseLmpInput(lmp);
    return d ? lmpSummary(d) : null;
  }, [lmp]);

  /** Toggle browser fullscreen mode — the doctor presses a button, not F11. */
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
      // Some browsers/contexts block fullscreen — silently ignore
      setFullscreen((v) => !v);
    }
  };

  /** Listen for native fullscreen changes (Esc key exits fullscreen). */
  useEffect(() => {
    const onFsChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const persist = async (status: "" | "finalize"): Promise<string | null> => {
    if (!patientName.trim()) {
      toast.error("Patient name is required");
      return null;
    }
    setBusy(status === "finalize" ? "finalize" : "save");
    try {
      const payload = {
        patientName: patientName.trim(),
        patientPhone: patientPhone.trim(),
        patientAge: patientAge.trim(),
        patientSex,
        referredBy: referredBy.trim(),
        studyKey,
        technique,
        state,
        scanDate,
      };
      let id = savedIdRef.current;
      if (id) {
        const res = await fetch(`/api/usg/reports/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Save failed");
      } else {
        const res = await fetch("/api/usg/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Save failed");
        id = (await res.json()).report.id as string;
        savedIdRef.current = id;
      }
      if (status === "finalize" && id) {
        const res = await fetch(`/api/usg/reports/${id}/finalize`, { method: "POST" });
        if (!res.ok) throw new Error("Finalize failed");
        const body = (await res.json()) as { serialNo?: number };
        if (typeof body.serialNo === "number") setSerial(formatUsgSerial(body.serialNo));
        setFinalizedHere(true);
        dirtyRef.current = false;
        clearDraft(dKey);
        toast.success(`Report finalized — register no. ${formatUsgSerial(body.serialNo ?? 0)} frozen for reprint`);
      } else {
        dirtyRef.current = false;
        toast.success("Draft saved");
      }
      onSaved();
      if (id) await flushPendingImages(id);
      return id;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
      return null;
    } finally {
      setBusy("");
    }
  };
  persistRef.current = persist;

  /** Upload pending stills once the report row exists (called after save). */
  const flushPendingImages = async (id: string) => {
    if (!pendingImages.length) return;
    const queue = [...pendingImages];
    setPendingImages([]);
    for (const p of queue) {
      const res = await fetch(`/api/usg/reports/${id}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      if (res.ok) {
        const { image } = (await res.json()) as { image: ImageRow };
        setImages((prev) => [...prev, image]);
      } else {
        toast.error((await res.json().catch(() => ({}))).error ?? "Could not attach an image");
      }
    }
  };

  /** v6: reload attached stills from the server (after a PACS pick). */
  const reloadImages = async () => {
    const rid = savedIdRef.current ?? report?.id ?? null;
    if (!rid) return;
    const res = await fetch(`/api/usg/reports/${rid}`);
    if (!res.ok) return;
    const fresh = (await res.json()).report as UsgReportRow;
    if (Array.isArray(fresh.images)) setImages(fresh.images);
  };

  const addImage = (dataUrl: string) => {
    if (isFinal) {
      toast.error("Finalized reports keep their images frozen");
      return;
    }
    if (savedIdRef.current) {
      void (async () => {
        const res = await fetch(`/api/usg/reports/${savedIdRef.current}/images`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl }),
        });
        if (res.ok) {
          const { image } = (await res.json()) as { image: ImageRow };
          setImages((prev) => [...prev, image]);
        } else {
          toast.error((await res.json().catch(() => ({}))).error ?? "Could not attach the image");
        }
      })();
    } else {
      setPendingImages((prev) => [...prev, { dataUrl, caption: "" }]);
      toast.info("Still attached — saves with the draft (Save to keep it permanently)");
    }
  };

  const setCaption = (kind: "server" | "pending", key: string, caption: string) => {
    if (kind === "pending") {
      setPendingImages((prev) => prev.map((p, i) => (String(i) === key ? { ...p, caption } : p)));
      return;
    }
    setImages((prev) => prev.map((p) => (p.id === key ? { ...p, caption } : p)));
    if (captionTimer.current) clearTimeout(captionTimer.current);
    captionTimer.current = setTimeout(() => {
      void fetch(`/api/usg/reports/${savedIdRef.current}/images/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption }),
      });
    }, 600);
  };

  const removeImage = (kind: "server" | "pending", key: string) => {
    if (kind === "pending") {
      setPendingImages((prev) => prev.filter((_, i) => String(i) !== key));
      return;
    }
    setImages((prev) => prev.filter((p) => p.id !== key));
    void fetch(`/api/usg/reports/${savedIdRef.current}/images/${key}`, { method: "DELETE" });
  };

  const moveImage = (kind: "server" | "pending", key: string, dir: -1 | 1) => {
    if (kind === "pending") {
      setPendingImages((prev) => {
        const i = Number(key);
        const j = i + dir;
        if (j < 0 || j >= prev.length) return prev;
        const next = [...prev];
        [next[i], next[j]] = [next[j], next[i]];
        return next;
      });
      return;
    }
    setImages((prev) => {
      const i = prev.findIndex((p) => p.id === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      // Persist the new order (positions are 1-based × 10).
      for (const [idx, img] of next.entries()) {
        if (idx === i || idx === j) {
          void fetch(`/api/usg/reports/${savedIdRef.current}/images/${img.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sortOrder: (idx + 1) * 10 }),
          });
        }
      }
      return next.map((img, idx) => (idx === i || idx === j ? { ...img, sortOrder: (idx + 1) * 10 } : img));
    });
  };

  const print = async () => {
    if (!patientName.trim()) {
      toast.error("Patient name is required");
      return;
    }
    setBusy("print");
    try {
      // Finalized reports print their frozen snapshot; drafts print the live
      // preview — stamped PROVISIONAL so it can't be filed as the record.
      if (report?.status === "FINALIZED" && report.reportHtml) {
        printInIframe(report.reportHtml);
      } else if (finalizedHere) {
        // Finalized moments ago in this session — the live preview IS the snapshot.
        printInIframe(previewHtml);
      } else {
        const id = await persist("");
        if (id) {
          const res = await fetch(`/api/usg/reports/${id}`, { method: "GET" });
          const row = res.ok ? ((await res.json()).report as UsgReportRow) : null;
          if (row?.status === "FINALIZED" && row.reportHtml) {
            printInIframe(row.reportHtml);
          } else {
            printInIframe(previewHtml);
          }
        }
      }
    } finally {
      setBusy("");
    }
  };

  const printInIframe = (html: string) => {
    const frame = printRef.current;
    if (!frame) return;
    frame.srcdoc = html;
    const win = frame.contentWindow;
    if (win) {
      win.focus();
      setTimeout(() => win.print(), 150);
    }
  };

  const paperLabel = (settings.usgPrintPaper ?? "a4") === "a5" ? "A5" : "A4";

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ══ v6.8 COMPACT HEADER ════════════════════════════════════════════ */}
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

          {/* Fullscreen toggle — always visible at center-top */}
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); void toggleFullscreen(); }}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground shrink-0"
            title={fullscreen ? "Exit fullscreen (Esc)" : "Enter fullscreen — hides browser tabs"}>
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>

          {/* Quick actions — always visible */}
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="outline" onClick={() => persist("")} disabled={busy !== "" || isFinal}
              className="h-7 border-border bg-panel px-2 text-[10px]">
              {busy === "save" ? <Loader2 className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            </Button>
            <Button size="sm" onClick={() => setQualityOpen(true)} disabled={busy !== "" || isFinal}
              className="h-7 bg-emerald-600 px-2 hover:bg-emerald-700">
              {busy === "finalize" ? <Loader2 className="h-3.5 w-3.5" /> : <FileCheck2 className="h-3.5 w-3.5" />}
            </Button>
            <Button size="sm" variant="outline" onClick={print} disabled={busy !== ""}
              className="h-7 border-rose-200 bg-rose-50 px-2 text-rose-700 hover:bg-rose-100">
              {busy === "print" ? <Loader2 className="h-3.5 w-3.5" /> : <Printer className="h-3.5 w-3.5" />}
            </Button>
            {isFinal ? (
              <Button size="sm" variant="outline" onClick={() => downloadReportPdf({ reportId: savedIdRef.current ?? report?.id ?? "", patientName, serial, date: fmtPrintDate(scanDate) })}
                title="Download PDF" className="h-7 border-sky-200 bg-sky-50 px-2 text-sky-700 hover:bg-sky-100">
                <FileDown className="h-3.5 w-3.5" />
              </Button>
            ) : null}
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
          <span className="ml-auto hidden items-center gap-1 text-faint md:flex" title="Keyboard shortcuts">
            <Command className="h-2.5 w-2.5" /> Ctrl+S · Ctrl+↵ · ?
          </span>
        </div>

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

            {/* Patient inputs — compact single row */}
            <div className="flex flex-wrap items-end gap-1.5 border-t border-border px-3 py-2">
              <div className="grid flex-1 min-w-[140px] gap-0.5">
                <Label className="text-[9px] font-semibold uppercase tracking-wide text-faint">Patient</Label>
                <Input value={patientName} onChange={(e) => onNameChange(e.target.value)} placeholder="Name"
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
                <Input value={referredBy} onChange={(e) => setReferredBy(e.target.value)} placeholder="Dr. —"
                  className="h-8 border-border bg-panel text-[12px]" />
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
                    void shareReportPdf({ reportId: id, patientName, serial, date: fmtPrintDate(scanDate) }).then((r) => {
                      if (r === "shared") toast.success("Shared via the device share sheet");
                      else if (r === "downloaded") toast.success("PDF saved — WhatsApp opened");
                      else toast.error("Could not build the PDF");
                    });
                  }}
                  title="Share on WhatsApp" className="h-8 border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
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
          <UsgDiffPanel source={diffSource} state={state} pathologies={pathologies} />
        ) : null}

        {/* Pregnancy timeline */}
        {state.studyKey.startsWith("ob-") && patientReports.length > 0 && (
          <div className="px-3 py-1">
            <UsgPregnancyTimeline timeline={buildPregnancyTimeline(patientReports)} />
          </div>
        )}
      </div>

    </div>
  );
}
