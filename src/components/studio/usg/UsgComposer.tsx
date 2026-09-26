"use client";
/**
 * USG composer — orchestrator. Owns all state/data-flow; UI lives in
 * composer/{OrganCard,ChipRow,ComposerToolbar,ImpressionZone,PreviewZone}.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { UsgComposerState, UsgPathologyDef } from "@/lib/usg/types";
import { USG_SEX_CHILD } from "@/lib/usg/types";
import { USG_STUDIES, applyNormalOverrides, getStudy, initialState as freshComposerState, normalOverrideKey, studyKeyForBillTest, type NormalOverrides } from "@/lib/usg/studies";
import { isObStudyKey } from "@/lib/usg/orderStudy";
import {
  applyPathologies,
  makeLookup,
  normaliseState,
  resolve,
  selectedPathologies,
  setOrganVar,
  switchStudy,
} from "@/lib/usg/composer";
import { studyAllowsRushNormals } from "@/lib/usg/quickActions";
import { type PathologyWordingOverrides } from "@/lib/usg/triad";
import { buildUsgReportHtml, formatUsgSerial, type UsgPrintSettings } from "@/lib/usg/print";
import { lmpSummary, parseLmpInput } from "@/lib/usg/lmp";
import { toScanDateInput } from "@/lib/usg/dates";
import { UsgImagesCard, type ImageRow, type PendingImage } from "./UsgImagesCard";
import { UsgDicomPicker } from "./UsgDicomPicker";
import { UsgFormFDialog, type FormFDefaults, type FormFOrderLite } from "./UsgFormFDialog";
import { UsgPathologyDialog } from "./UsgPathologyDialog";
import { UsgStudyPicker } from "./UsgStudyPicker";
import { UsgQualityChecklist } from "./UsgQualityChecklist";
import { UsgMeasurementReviewDialog } from "./UsgMeasurementReviewDialog";
import { UsgCriticalCommDialog } from "./UsgCriticalCommDialog";
import { clearDraft, draftKey, loadDraft, saveDraft, snapshotDiffers, type DraftSnapshot } from "@/lib/usg/drafts";
import { type BiradsCategory } from "@/lib/usg/birads";
import { ComposerToolbar, ComposerHotkeys, pullFromMachine as pullFromMachineFn } from "./composer/ComposerToolbar";
import { OrganCard, saveNormalOverride, resetNormalOverride } from "./composer/OrganCard";
import { ImpressionZone } from "./composer/ImpressionZone";
import {
  PreviewZone,
  addImage,
  setCaption,
  removeImage,
  moveImage,
  persistReport,
  printReport,
  finalizeFastReport,
  ComposerDialogs,
} from "./composer/PreviewZone";
import { StickyActionBar } from "./composer/StickyActionBar";
import type { DiffSource } from "./UsgDiffPanel";

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
  serialNo?: number | null;
  scanDate?: string | null;
  patient?: { id: string; name: string; phone: string } | null;
  images?: ImageRow[];
  order?: ReportOrderLite | null;
};

type PatientSuggestion = { id: string; name: string; phone: string; scanCount: number };

export type UsgComposerProps = {
  pathologies: UsgPathologyDef[];
  settings: UsgPrintSettings;
  report: UsgReportRow | null; // existing draft to continue, or null = new
  prefill?: { patientName?: string; patientPhone?: string; patientAge?: string; patientSex?: string; referredBy?: string } | null;
  diffSource?: DiffSource | null;
  normalOverrides?: NormalOverrides | null;
  pathologyWording?: PathologyWordingOverrides | null;
  onPathologyWordingChange?: (next: PathologyWordingOverrides) => void;
  order?: ReportOrderLite | null;
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

export function UsgComposer({ pathologies, settings, report, prefill, diffSource, normalOverrides, pathologyWording, onPathologyWordingChange, order, formFDefaults, onBack, onSaved }: UsgComposerProps) {
  const lastStudyKey =
    typeof window !== "undefined" ? localStorage.getItem("usg:lastStudyKey") : null;
  const studyKey0 =
    report?.studyKey ??
    studyKeyForBillTest(
      (report as any)?.testName ?? (prefill as any)?.testName ?? "",
      (report as any)?.sex ?? (report as any)?.gender ?? (report as any)?.patientGender ?? "",
    ) ??
    (lastStudyKey && getStudy(lastStudyKey) ? lastStudyKey : null) ??
    "wa-female";

  const initial = useMemo(() => {
    if (!report) return null;
    try {
      const raw = JSON.parse(report.stateJson) as unknown;
      // Strict: NEVER migrate FINALIZED stateJson — frozen forever.
      if (report.status === "FINALIZED") return raw as UsgComposerState;
      // Draft reopen/edit — coerce grid rows in memory (persisted only on save).
      return normaliseState(raw, report.studyKey ?? studyKey0, normalOverrides);
    } catch {
      return null;
    }
  }, [report, normalOverrides, studyKey0]);

  const [patientName, setPatientName] = useState(report?.patientName ?? prefill?.patientName ?? "");
  const [patientPhone, setPatientPhone] = useState(report?.patient?.phone ?? prefill?.patientPhone ?? "");
  const [patientAge, setPatientAge] = useState(report?.patientAge ?? prefill?.patientAge ?? "");
  const [patientSex, setPatientSex] = useState(
    (report?.patientSex ?? prefill?.patientSex ?? "F") as "F" | "M" | typeof USG_SEX_CHILD,
  );
  const [referredBy, setReferredBy] = useState(report?.referredBy ?? prefill?.referredBy ?? (typeof window !== "undefined" ? localStorage.getItem("usg:lastReferredBy") ?? "" : ""));
  const [studyKey, setStudyKey] = useState(studyKey0);
  const study = useMemo(
    () => applyNormalOverrides(getStudy(studyKey) ?? USG_STUDIES[0], normalOverrides),
    [studyKey, normalOverrides],
  );
  const [technique, setTechnique] = useState(report?.technique ?? study.technique);
  const [state, setState] = useState<UsgComposerState>(
    () => initial ?? freshComposerState(studyKey0, normalOverrides),
  );
  const [scanDate, setScanDate] = useState(() => toScanDateInput(report?.scanDate ? new Date(report.scanDate) : null));

  useEffect(() => {
    if (referredBy && referredBy.length > 2 && typeof window !== "undefined") {
      try { localStorage.setItem("usg:lastReferredBy", referredBy); } catch {}
    }
  }, [referredBy]);
  useEffect(() => {
    if (!studyKey || typeof window === "undefined") return;
    try { localStorage.setItem("usg:lastStudyKey", studyKey); } catch {}
  }, [studyKey]);
  const [lmp, setLmp] = useState("");
  const [impressionManual, setImpressionManual] = useState(!!initial?.impressionOverride);
  const [showTechnique, setShowTechnique] = useState(false);
  const [busy, setBusy] = useState<"" | "save" | "finalize" | "print">("");
  const savedIdRef = useRef<string | null>(report?.id ?? null);
  const [serial, setSerial] = useState<string | undefined>(
    report?.serialNo != null ? formatUsgSerial(report.serialNo) : undefined,
  );
  const [finalizedHere, setFinalizedHere] = useState(report?.status === "FINALIZED");
  const [qualityOpen, setQualityOpen] = useState(false);
  // Collapse demography whenever patient context already exists so OHIF +
  // composer keep ≥ half the viewport. Only a blank new report opens expanded.
  const [headerCollapsed, setHeaderCollapsed] = useState(
    !!(report || order || prefill?.patientName),
  );
  const [focusMode, setFocusMode] = useState<'workspace' | 'preview' | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewSrResult, setReviewSrResult] = useState<{ vars: Record<string, Record<string, string>>; extras: Record<string, string>; matchedCount: number } | null>(null);
  const [reviewSrMeasurements, setReviewSrMeasurements] = useState<Array<{ conceptName: string; value: string; unit: string; path?: string }>>([]);
  const [dialogOrgan, setDialogOrgan] = useState<string | null>(null);
  const printRef = useRef<HTMLIFrameElement>(null);
  const frozenHtmlRef = useRef<string | null>(
    report?.status === "FINALIZED" && report.reportHtml ? report.reportHtml : null,
  );

  // first save creates the report row they belong to).
  const [images, setImages] = useState<ImageRow[]>(report?.images ?? []);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const captionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // for restore; a debounced autosave keeps the snapshot fresh.
  const dKey = useMemo(() => draftKey(report?.id ?? null), [report]);
  const [restoreSnap, setRestoreSnap] = useState<DraftSnapshot | null>(null);
  const [lastAutosave, setLastAutosave] = useState<number | null>(null);
  const dirtyRef = useRef(false);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const [pickerOpen, setPickerOpen] = useState(false);

  const [dicomOpen, setDicomOpen] = useState(false);
  const [formFOpen, setFormFOpen] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pullSummary, setPullSummary] = useState<{ source: string; matchedCount: number; extras: Record<string, string> } | null>(null);

  const [commOpen, setCommOpen] = useState(false);

  const [birads, setBirads] = useState<BiradsCategory | null>(null);

  const orderUid = order?.studyInstanceUid ?? null;
  const reportIdForPacs = savedIdRef.current ?? report?.id ?? null;

  const pullMutation = useMutation({
    mutationFn: async () =>
      pullFromMachineFn({
        savedId: savedIdRef.current,
        reportId: report?.id,
        setPulling,
        setState,
        setReviewSrResult,
        setReviewSrMeasurements,
        setReviewOpen,
        setPullSummary,
      }),
  });
  const pullFromMachine = async () => {
    await pullMutation.mutateAsync();
  };
  const queryClient = useQueryClient();
  const lookup = useMemo(() => makeLookup(pathologies), [pathologies]);
  const resolved = useMemo(
    () => resolve(state, lookup, technique, normalOverrides, pathologyWording),
    [state, lookup, technique, normalOverrides, pathologyWording],
  );

  const patientsQ = useQuery({
    queryKey: ["usg", "patients"],
    queryFn: async () => {
      const r = await fetch("/api/usg/patients");
      if (!r.ok) return [] as PatientSuggestion[];
      const d = await r.json();
      return ((d.patients ?? []) as PatientSuggestion[]).slice(0, 300);
    },
  });
  const patients = patientsQ.data ?? [];

  const patientReportsQ = useQuery({
    queryKey: ["usg", "reports", "by-name", patientName.trim()],
    enabled: !!patientName.trim() && isObStudyKey(state.studyKey),
    queryFn: async () => {
      const r = await fetch(`/api/usg/reports?patientName=${encodeURIComponent(patientName.trim())}&limit=20`);
      if (!r.ok) return [] as Array<{ id: number; scanDate: string | null; stateJson: string | null; studyKey: string | null; status: string }>;
      const d = await r.json();
      return (d.reports ?? d ?? []) as Array<{ id: number; scanDate: string | null; stateJson: string | null; studyKey: string | null; status: string }>;
    },
  });
  const patientReports = patientReportsQ.data ?? [];

  const priorFinalizedQ = useQuery({
    queryKey: ["usg", "reports", "prior-finalized", patientPhone.trim(), patientName.trim().toLowerCase(), report?.id ?? ""],
    enabled: patientPhone.trim().length >= 6 || patientName.trim().length >= 2,
    queryFn: async () => {
      const phone = patientPhone.trim();
      const name = patientName.trim();
      const url =
        phone.length >= 6
          ? `/api/usg/reports?patientPhone=${encodeURIComponent(phone)}&status=FINALIZED&limit=8`
          : `/api/usg/reports?patientName=${encodeURIComponent(name)}&status=FINALIZED&limit=20`;
      const r = await fetch(url);
      if (!r.ok) return [] as Array<{ id: string; scanDate: string | null; stateJson: string | null; studyKey: string | null }>;
      const d = await r.json();
      const rows = (d.reports ?? []) as Array<{
        id: string;
        scanDate: string | null;
        stateJson: string | null;
        studyKey: string | null;
        status: string;
        patientName?: string;
      }>;
      const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
      return rows
        .filter((row) => row.status === "FINALIZED" && row.stateJson && row.id !== report?.id)
        .filter((row) =>
          phone.length >= 6
            ? true
            : norm(row.patientName ?? "") === norm(name),
        )
        .slice(0, 5);
    },
  });
  const priorFinalized = priorFinalizedQ.data ?? [];

  const saveNormalMut = useMutation({
    mutationFn: async ({ organKey, text }: { organKey: string; text: string }) => {
      await saveNormalOverride(studyKey, organKey, text, setState);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["usg", "normals"] });
    },
  });
  const resetNormalMut = useMutation({
    mutationFn: async ({ organKey }: { organKey: string }) => {
      await resetNormalOverride(studyKey, organKey, setState);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["usg", "normals"] });
    },
  });

  const normName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const onNameChange = (v: string) => {
    setPatientName(v);
    const hit = patients.find((p) => normName(p.name) === normName(v));
    if (hit && hit.phone) setPatientPhone((prev) => prev.trim() || hit.phone);
  };

  const isPregnancyStudy = studyKey === "ob" || studyKey === "ep";
  const isFinal = report?.status === "FINALIZED" || finalizedHere;

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
    }, 400);
    return () => clearTimeout(t);
  }, [dKey, currentSnap, isFinal, initialSnap]);

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

  const persistRef = useRef<((status: "" | "finalize") => Promise<string | null>) | null>(null);
  const printRefFn = useRef<() => Promise<void>>(async () => {});
  const finalizeFastRef = useRef<(alsoPrint?: boolean) => Promise<void>>(async () => {});
  const togglePathologyRef = useRef<(organKey: string, key: string | null) => void>(() => {});
  const pendingPrintAfterQc = useRef(false);
  const [focusedOrganIdx, setFocusedOrganIdx] = useState(0);

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
  // Debounce iframe srcDoc + share the same 400 ms window as autosave (Ctrl+S stays immediate).
  const [debouncedPreviewHtml, setDebouncedPreviewHtml] = useState(previewHtml);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedPreviewHtml(previewHtml), 400);
    return () => clearTimeout(t);
  }, [previewHtml]);

  const pickStudy = (k: string) => {
    const target = getStudy(k);
    if (!target) return;
    const prevStudy = getStudy(studyKey);
    const prevDefault = settings.studyTechniqueDefaults?.[studyKey]?.trim() || prevStudy?.technique?.trim() || "";
    const nextDefault = settings.studyTechniqueDefaults?.[k]?.trim() || target.technique;
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
  togglePathologyRef.current = togglePathology;

  const lmpInfo = useMemo(() => {
    const d = parseLmpInput(lmp);
    return d ? lmpSummary(d) : null;
  }, [lmp]);

  const persistDeps = () => ({
    patientName, patientPhone, patientAge, patientSex, referredBy, studyKey, technique, state, scanDate,
    savedIdRef, frozenHtmlRef, dirtyRef, dKey, pendingImages, setPendingImages, setImages,
    setBusy, setSerial, setFinalizedHere, onSaved,
  });
  const persistMutation = useMutation({
    mutationFn: async (status: "" | "finalize") => persistReport(status, persistDeps()),
    onSuccess: (id, status) => {
      void queryClient.invalidateQueries({ queryKey: ["usg", "reports"] });
      if (id) void queryClient.invalidateQueries({ queryKey: ["usg", "report", id] });
      if (status === "finalize") void queryClient.invalidateQueries({ queryKey: ["usg", "patients"] });
    },
  });
  const persist = async (status: "" | "finalize") => persistMutation.mutateAsync(status);
  persistRef.current = persist;

  const printMutation = useMutation({
    mutationFn: async () =>
      printReport({
        patientName,
        setBusy,
        report,
        finalizedHere,
        frozenHtmlRef,
        savedIdRef,
        printRef,
        previewHtml,
        persist,
      }),
  });
  const print = async () => printMutation.mutateAsync();
  const finalizeFast = async (alsoPrint = false) =>
    finalizeFastReport({
      isFinal,
      busyRef,
      state,
      persist,
      frozenHtmlRef,
      printRef,
      setQualityOpen,
      alsoPrint,
      pendingPrintAfterQc,
    });
  finalizeFastRef.current = finalizeFast;
  printRefFn.current = print;

  const paperLabel = (settings.usgPrintPaper ?? "a4") === "a5" ? "A5" : "A4";

  
  const onAddImage = (dataUrl: string) =>
    addImage(dataUrl, { isFinal, savedId: savedIdRef.current, setImages, setPendingImages });
  const onCaption = (kind: "server" | "pending", key: string, caption: string) =>
    setCaption(kind, key, caption, { setImages, setPendingImages, captionTimer, savedIdRef });
  const onRemoveImage = (kind: "server" | "pending", key: string) =>
    removeImage(kind, key, { setImages, setPendingImages, savedIdRef });
  const onMoveImage = (kind: "server" | "pending", key: string, dir: -1 | 1) =>
    moveImage(kind, key, dir, { setImages, setPendingImages, savedIdRef });

  const onSaveNormal = useCallback(
    (organKey: string, text: string) => void saveNormalMut.mutateAsync({ organKey, text }),
    [saveNormalMut],
  );
  const onResetNormal = useCallback(
    (organKey: string) => void resetNormalMut.mutateAsync({ organKey }),
    [resetNormalMut],
  );
  const onTogglePathology = useCallback(
    (organKey: string, key: string | null) => togglePathology(organKey, key),
    // togglePathology closes over lookup/normalOverrides via setState updater
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lookup, normalOverrides],
  );
  const onFocusOrgan = useCallback((idx: number) => setFocusedOrganIdx(idx), []);
  const onAddCustom = useCallback((organKey: string) => setDialogOrgan(organKey), []);
  const lookupPathology = useCallback((key: string) => pathologies.find((p) => p.key === key), [pathologies]);
  const onEnlargePreview = useCallback(() => setFocusMode("preview"), []);
  const onResetFocus = useCallback(() => setFocusMode(null), []);
  const onWorkspaceFocus = useCallback(() => setFocusMode("workspace"), []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ComposerHotkeys
        isFinal={isFinal}
        study={study}
        state={state}
        setState={setState}
        pathologies={pathologies}
        focusedOrganIdx={focusedOrganIdx}
        setFocusedOrganIdx={setFocusedOrganIdx}
        setQualityOpen={setQualityOpen}
        setPickerOpen={setPickerOpen}
        persistRef={persistRef}
        printRefFn={printRefFn}
        finalizeFastRef={finalizeFastRef}
        togglePathologyRef={togglePathologyRef}
        busyRef={busyRef}
      />
      <ComposerToolbar
        onBack={onBack}
        headerCollapsed={headerCollapsed}
        setHeaderCollapsed={setHeaderCollapsed}
        patientName={patientName}
        patientAge={patientAge}
        patientSex={patientSex}
        referredBy={referredBy}
        setReferredBy={setReferredBy}
        resolved={resolved}
        abnormalCount={abnormalCount}
        serial={serial}
        isFinal={isFinal}
        fullscreen={fullscreen}
        setFullscreen={setFullscreen}
        persist={persist}
        busy={busy}
        finalizeFast={finalizeFast}
        print={print}
        settings={settings}
        normalOverrides={normalOverrides}
        state={state}
        setState={setState}
        setCommOpen={setCommOpen}
        savedIdRef={savedIdRef}
        report={report}
        scanDate={scanDate}
        setScanDate={setScanDate}
        fmtPrintDate={fmtPrintDate}
        lastAutosave={lastAutosave}
        order={order}
        orderUid={orderUid}
        pullFromMachine={pullFromMachine}
        pulling={pulling}
        study={study}
        formFDefaults={formFDefaults}
        setFormFOpen={setFormFOpen}
        pullSummary={pullSummary}
        setPullSummary={setPullSummary}
        onNameChange={onNameChange}
        patients={patients}
        patientPhone={patientPhone}
        setPatientPhone={setPatientPhone}
        setPatientAge={setPatientAge}
        studyKey={studyKey}
        setStudyKey={setStudyKey}
        setTechnique={setTechnique}
        setPatientSex={setPatientSex}
        showTechnique={showTechnique}
        setShowTechnique={setShowTechnique}
        isPregnancyStudy={isPregnancyStudy}
        lmp={lmp}
        setLmp={setLmp}
        lmpInfo={lmpInfo}
        technique={technique}
        restoreSnap={restoreSnap}
        setRestoreSnap={setRestoreSnap}
        restoreDraft={restoreDraft}
        dKey={dKey}
        diffSource={diffSource}
        pathologies={pathologies}
        patientReports={patientReports}
        togglePathology={togglePathology}
      />

      <div className={`grid min-h-0 flex-1 gap-2 overflow-hidden px-2 pb-2 pt-1 ${focusMode === 'preview' ? "lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)] xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,1fr)]" : "lg:grid-cols-[minmax(320px,1fr)_minmax(0,1.35fr)] xl:grid-cols-[minmax(360px,1fr)_minmax(0,1.4fr)]"}`}>
        <PreviewZone
          focusMode={focusMode}
          previewHtml={debouncedPreviewHtml}
          orderUid={orderUid}
          onEnlarge={onEnlargePreview}
          onResetFocus={onResetFocus}
        />

        <div className="studio-scroll min-h-0 space-y-3 overflow-y-auto pr-1 cursor-pointer" onClick={(e) => { e.stopPropagation(); onWorkspaceFocus(); }} onDoubleClick={(e) => { e.stopPropagation(); onResetFocus(); }} title="Click to focus workspace · Double-click to reset">
          <div className="space-y-3">
            {study.organs.map((def, organIdx) => {
              const st = state.organs.find((o) => o.organ === def.key);
              if (!st) return null;
              const overrideKey = normalOverrideKey(studyKey, def.key);
              const override = normalOverrides?.[overrideKey] ?? null;
              return (
                <OrganCard
                  key={def.key}
                  organIdx={organIdx}
                  focused={focusedOrganIdx === organIdx}
                  def={def}
                  organState={st}
                  pathologies={pathologies}
                  preferNoSizeChips={studyAllowsRushNormals(study)}
                  normalOverride={override}
                  isFinal={isFinal}
                  onFocus={onFocusOrgan}
                  onSaveNormal={onSaveNormal}
                  onResetNormal={onResetNormal}
                  onTogglePathology={onTogglePathology}
                  setState={setState}
                  onAddCustom={onAddCustom}
                  lookupPathology={lookupPathology}
                  triadAdviceTexts={resolved.advice}
                />
              );
            })}

            <UsgImagesCard
              images={images}
              pending={pendingImages}
              readOnly={isFinal}
              onAdd={onAddImage}
              onCaption={onCaption}
              onRemove={onRemoveImage}
              onMove={onMoveImage}
              onPickDicom={orderUid ? () => setDicomOpen(true) : undefined}
              pacsLinked={!!orderUid}
              onOcrMeasurements={(vars) => {
                let applied = 0;
                setState((s) => {
                  let next = s;
                  for (const [organ, kv] of Object.entries(vars)) {
                    for (const [k, v] of Object.entries(kv)) {
                      if (!v) continue;
                      next = setOrganVar(next, organ, k, v);
                      applied++;
                    }
                  }
                  return next;
                });
                if (applied > 0) toast.success(`OCR filled ${applied} measurement slot(s) — verify values`);
              }}
            />
          </div>

          <ImpressionZone
            resolved={resolved}
            state={state}
            setState={setState}
            isFinal={isFinal}
            studyKey={studyKey}
            impressionManual={impressionManual}
            setImpressionManual={setImpressionManual}
            declarationLine={settings.usgDeclarationLine}
            paperLabel={paperLabel}
            enableBirads={settings.enableBirads !== false}
            birads={birads}
            setBirads={setBirads}
            priorFinalized={priorFinalized}
            pathologyWording={pathologyWording}
            onPathologyWordingChange={onPathologyWordingChange}
            savedId={savedIdRef.current}
            patientAge={patientAge}
            patientSex={patientSex === "F" || patientSex === "M" ? patientSex : undefined}
            lmp={lmp}
          />
        </div>
      </div>

      <iframe
        ref={printRef}
        title="print"
        className="pointer-events-none fixed left-[-10000px] top-0 h-[1px] w-[1px] opacity-0"
        aria-hidden
      />
      <ComposerDialogs
        dicomOpen={dicomOpen} setDicomOpen={setDicomOpen}
        formFOpen={formFOpen} setFormFOpen={setFormFOpen}
        formFDefaults={formFDefaults} order={order} report={report} onSaved={onSaved}
        dialogOrgan={dialogOrgan} setDialogOrgan={setDialogOrgan} study={study}
        pickerOpen={pickerOpen} setPickerOpen={setPickerOpen} pickStudy={pickStudy} studyKey={studyKey}
        qualityOpen={qualityOpen} setQualityOpen={setQualityOpen} state={state} resolved={resolved} persist={persist}
        reviewSrResult={reviewSrResult} reviewOpen={reviewOpen} setReviewOpen={setReviewOpen}
        reviewSrMeasurements={reviewSrMeasurements} setState={setState}
        commOpen={commOpen} setCommOpen={setCommOpen} savedIdRef={savedIdRef}
        patientName={patientName} impressionManual={impressionManual} setImpressionManual={setImpressionManual}
        referredBy={referredBy} settings={settings} isPregnancyStudy={isPregnancyStudy} orderUid={orderUid}
        pendingPrintAfterQc={pendingPrintAfterQc}
        frozenHtmlRef={frozenHtmlRef}
        printRef={printRef}
        technique={technique}
        togglePathology={togglePathology}
      />
      <StickyActionBar
        hidden={
          qualityOpen || pickerOpen || dicomOpen || formFOpen || commOpen || reviewOpen || dialogOrgan !== null
        }
        busy={busy}
        isFinal={isFinal}
        onSave={() => void persist("")}
        onFinalize={() => void finalizeFast(false)}
        onPrint={() => void print()}
        onNext={onBack}
      />
    </div>
  );
}

