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
import { ArrowLeft, CalendarDays, ChevronDown, Command, FileCheck2, Loader2, Phone, Printer, Save, Search, Settings2 } from "lucide-react";
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
      {/* v6 — CARE order banner: bill-desk context + PACS + Form F */}
      {order ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-sky-100 bg-sky-50/60 px-4 py-2 text-[11.5px]">
          <Link2 className="h-3.5 w-3.5 text-sky-600" />
          <span className="font-mono font-bold text-sky-800">{order.accessionNumber}</span>
          {order.billNumber ? <span className="text-sky-700">· Bill {order.billNumber}</span> : null}
          {order.testName ? <span className="truncate text-sky-700">· {order.testName}</span> : null}
          {order.billingStatus ? (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold ring-1",
                order.billingStatus === "PAID"
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : order.billingStatus === "DUE"
                    ? "bg-amber-50 text-amber-700 ring-amber-200"
                    : "bg-sky-50 text-sky-700 ring-sky-200",
              )}
            >
              {order.billingStatus.replace("_", " ")}
            </span>
          ) : null}
          {orderUid ? (
            <span className="flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200">
              <ScanLine className="h-3 w-3" /> PACS
            </span>
          ) : null}
          <div className="ml-auto flex items-center gap-1.5">
            {orderUid ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void pullFromMachine()}
                disabled={pulling || isFinal}
                className="h-7 border-violet-200 bg-white px-2 text-[11px] font-semibold text-violet-700 hover:bg-violet-50"
                title="Fill this study's measurement slots from the machine (DICOM SR, OCR fallback)"
              >
                {pulling ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <ScanLine className="mr-1 h-3 w-3" />}
                Pull from machine
              </Button>
            ) : null}
            {study.pcpndt && formFDefaults ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setFormFOpen(true)}
                className="h-7 border-rose-200 bg-white px-2 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                title="PC-PNDT Form F — demographics pre-filled from the bill desk"
              >
                <FileCheck2Icon className="mr-1 h-3 w-3" />
                Form F
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Machine measurement pull summary — what matched, what didn't */}
      {pullSummary ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-violet-100 bg-violet-50/50 px-4 py-1.5 text-[11px] text-violet-800">
          <b>Pulled {pullSummary.matchedCount} slot(s)</b>
          <span className="text-violet-600">{pullSummary.source === "sr" ? "from machine SR" : pullSummary.source === "ocr" ? "via OCR — verify" : "nothing found"}</span>
          {Object.keys(pullSummary.extras).length ? (
            <span className="truncate text-violet-600">
              · unmatched: {Object.entries(pullSummary.extras).slice(0, 6).map(([k, v]) => `${k} ${v}`).join("; ")}
            </span>
          ) : null}
          <button className="ml-auto text-[10px] font-bold text-violet-500 underline" onClick={() => setPullSummary(null)}>
            dismiss
          </button>
        </div>
      ) : null}

      {/* Patient strip */}
      <div className="shrink-0 border-b border-border bg-card/80 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-end gap-2.5">
          <Button variant="ghost" size="sm" onClick={onBack} className="h-8 px-2 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="grid flex-1 min-w-[180px] gap-1">
            <Label className="text-[10px] font-semibold uppercase tracking-wide text-faint">Patient</Label>
            <Input value={patientName} onChange={(e) => onNameChange(e.target.value)} placeholder="Name"
              list="usg-patient-names"
              className="h-9 border-border bg-panel text-[13px] font-semibold" />
            <datalist id="usg-patient-names">
              {patients.map((p) => (
                <option key={p.id} value={p.name}>{p.phone ? `${p.phone}${p.scanCount ? ` · ${p.scanCount} scan${p.scanCount > 1 ? "s" : ""}` : ""}` : p.scanCount ? `${p.scanCount} scan${p.scanCount > 1 ? "s" : ""}` : ""}</option>
              ))}
            </datalist>
          </div>
          <div className="grid w-[150px] gap-1">
            <Label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-faint">
              <Phone className="h-3 w-3" /> Phone
            </Label>
            <Input value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} placeholder="Optional"
              inputMode="tel" disabled={isFinal}
              title={isFinal ? "Finalized reports keep their patient details" : "Links repeat scans into one patient history"}
              className="h-9 border-border bg-panel text-[12.5px]" />
          </div>
          <div className="grid w-[90px] gap-1">
            <Label className="text-[10px] font-semibold uppercase tracking-wide text-faint">Age</Label>
            <Input value={patientAge} onChange={(e) => setPatientAge(e.target.value)} placeholder="Yrs"
              className="h-9 border-border bg-panel text-[13px]" />
          </div>
          <div className="grid w-[92px] gap-1">
            <Label className="text-[10px] font-semibold uppercase tracking-wide text-faint">Sex</Label>
            <Select value={patientSex} onValueChange={(v) => changeSex(v as "F" | "M" | typeof USG_SEX_CHILD)}>
              <SelectTrigger className="h-9 border-border bg-panel text-[13px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="F">F</SelectItem>
                <SelectItem value="M">M</SelectItem>
                <SelectItem value={USG_SEX_CHILD}>Child</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid flex-1 min-w-[180px] gap-1">
            <Label className="text-[10px] font-semibold uppercase tracking-wide text-faint">Referred by</Label>
            <Input value={referredBy} onChange={(e) => setReferredBy(e.target.value)} placeholder="Dr. —"
              className="h-9 border-border bg-panel text-[13px]" />
          </div>
          <div className="grid w-[150px] gap-1">
            <Label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-faint">
              <CalendarDays className="h-3 w-3" /> Scan date
            </Label>
            <Input
              type="date"
              value={scanDate}
              onChange={(e) => setScanDate(e.target.value)}
              disabled={isFinal}
              title={isFinal ? "Finalized reports keep their scan date" : "Back-date if the report is typed up later"}
              className="h-9 border-border bg-panel text-[12.5px]" />
          </div>
          <div className="grid min-w-[190px] gap-1">
            <Label className="text-[10px] font-semibold uppercase tracking-wide text-faint">Study</Label>
            <Select value={studyKey} onValueChange={pickStudy}>
              <SelectTrigger className="h-9 border-border bg-panel text-[13px] font-semibold">
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
                        <SelectItem key={s.key} value={s.key} className="text-[12.5px]">{s.label}</SelectItem>
                      ))}
                    </SelectGroup>
                  );
                })}
                {/* Ungrouped fallback (should not happen — every study has a group). */}
                {USG_STUDIES.filter((s) => !s.group || !STUDY_GROUPS.some((g) => g.key === s.group)).map((s) => (
                  <SelectItem key={s.key} value={s.key} className="text-[12.5px]">{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={() => persist("")} disabled={busy !== "" || isFinal}
              className="h-9 border-border bg-panel">
              {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
            <Button size="sm" onClick={() => persist("finalize")} disabled={busy !== "" || isFinal}
              className="h-9 bg-emerald-600 hover:bg-emerald-700">
              {busy === "finalize" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}
              Finalize
            </Button>
            <Button size="sm" variant="outline" onClick={print} disabled={busy !== ""}
              className="h-9 border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100">
              {busy === "print" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              Print {paperLabel}
            </Button>
            {isFinal ? (
              <>
                <Button size="sm" variant="outline" onClick={() => downloadReportPdf({ reportId: savedIdRef.current ?? report?.id ?? "", patientName, serial, date: fmtPrintDate(scanDate) })}
                  title="Download the report as a PDF (with the verification QR)"
                  className="h-9 border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100">
                  <FileDown className="h-4 w-4" /> PDF
                </Button>
                <Button size="sm" variant="outline" disabled={busy !== ""}
                  onClick={() => {
                    const id = savedIdRef.current ?? report?.id;
                    if (!id) return;
                    void shareReportPdf({ reportId: id, patientName, serial, date: fmtPrintDate(scanDate) }).then((r) => {
                      if (r === "shared") toast.success("Shared via the device share sheet");
                      else if (r === "downloaded") toast.success("PDF saved — WhatsApp opened to attach it");
                      else toast.error("Could not build the PDF");
                    });
                  }}
                  title="Share on WhatsApp — PDF via the mobile share sheet, or download + wa.me on desktop"
                  className="h-9 border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </Button>
              </>
            ) : null}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <button
            onClick={() => setShowTechnique((v) => !v)}
            className="flex items-center gap-1 rounded-full border border-border bg-panel px-2 py-0.5 hover:text-foreground"
          >
            <Settings2 className="h-3 w-3" /> Technique
            <ChevronDown className={cn("h-3 w-3 transition-transform", showTechnique && "rotate-180")} />
          </button>
          <UsgCalculators />
          {lastAutosave && !isFinal ? (
            <span
              className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"
              title="A crash-recovery copy is kept on this device while you type"
            >
              autosaved {new Date(lastAutosave).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          ) : null}
          <span className="hidden items-center gap-1 rounded-full border border-border bg-panel px-2 py-0.5 text-[10px] font-medium text-faint md:flex" title="Keyboard shortcuts">
            <Command className="h-3 w-3" /> K study · Ctrl+S save · Ctrl+↵ finalize
          </span>
          <span className="font-semibold text-foreground">{resolved.title}</span>
          <span className={cn("rounded-full px-2 py-0.5 font-semibold", abnormalCount ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700")}>
            {abnormalCount ? `${abnormalCount} organ${abnormalCount > 1 ? "s" : ""} affected` : "All normal"}
          </span>
          {serial ? (
            <span className="rounded-full bg-sky-50 px-2 py-0.5 font-bold tracking-wide text-sky-700">{serial}</span>
          ) : isFinal ? null : (
            <span className="text-faint">register no. assigned on finalize</span>
          )}
          {isFinal ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">finalized — reprint only</span>
          ) : (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">draft — prints PROVISIONAL</span>
          )}
        </div>
        {showTechnique ? (
          <div className="mt-2 flex items-start gap-1">
            <Textarea
              value={technique}
              onChange={(e) => setTechnique(e.target.value)}
              rows={2}
              disabled={isFinal}
              className="border-border bg-panel text-[12px]"
              placeholder="Technique…"
            />
            <DictationButton
              onText={(t) => setTechnique((prev) => appendTranscript(prev, t))}
              title="Dictate the technique — recognised speech appends here"
            />
          </div>
        ) : null}
      </div>

      {/* Crash-recovery banner — a local snapshot newer than the saved row */}
      {restoreSnap ? (
        <div className="shrink-0 border-b border-amber-200 bg-amber-50/90 px-4 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11.5px] font-semibold text-amber-800">
              Unsaved draft found on this device from{" "}
              {new Date(restoreSnap.savedAt).toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              — newer than the saved copy.
            </span>
            <div className="ml-auto flex gap-1.5">
              <Button
                size="sm"
                className="h-7 bg-amber-600 px-2.5 text-[11px] hover:bg-amber-700"
                onClick={restoreDraft}
              >
                Restore
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-[11px]"
                onClick={() => {
                  clearDraft(dKey);
                  setRestoreSnap(null);
                }}
              >
                Discard
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Follow-up diff — what changed vs the previous scan */}
      {diffSource && !isFinal ? (
        <UsgDiffPanel source={diffSource} state={state} pathologies={pathologies} />
      ) : null}

      {/* LMP calculator — pregnancy studies */}
      {isPregnancyStudy ? (
        <div className="shrink-0 border-b border-border bg-gradient-to-r from-pink-50/80 to-rose-50/60 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <Label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-rose-600">
              <CalendarDays className="h-3 w-3" /> LMP calculator
            </Label>
            <Input
              type="date"
              value={lmp}
              onChange={(e) => applyLmp(e.target.value)}
              className="h-8 w-[150px] border-rose-200 bg-white text-[12.5px]"
              title="Last menstrual period — fills GA & EDD below"
            />
            {lmpInfo ? (
              <span className="rounded-full bg-white px-3 py-1 text-[11.5px] font-bold text-rose-700 ring-1 ring-rose-200">
                GA {lmpInfo.weeks} wk {lmpInfo.days} d · EDD {lmpInfo.edd}
              </span>
            ) : (
              <span className="text-[11px] text-rose-400">enter LMP — GA &amp; EDD auto-fill into the biometry slots</span>
            )}
          </div>
        </div>
      ) : null}

      {/* Hadlock biometry calculator — antenatal scans (the format's mm slots) */}
      {studyKey === "ob" ? (
        <UsgBiometryCalc
          scanDate={scanDate}
          onFill={(vars) =>
            setState((s) => {
              let next = s;
              for (const [k, v] of Object.entries(vars)) next = setOrganVar(next, "biometry", k, v);
              return next;
            })
          }
        />
      ) : null}

      {/* Body: organ cards + preview */}
      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
        <div className="studio-scroll min-h-0 space-y-3 overflow-y-auto pr-1">
          {study.organs.map((def) => {
            const st = state.organs.find((o) => o.organ === def.key);
            if (!st) return null;
            return (
              <UsgOrganCard
                key={def.key}
                def={def}
                state={st}
                pathologies={pathologiesForOrgan(pathologies, def.key)}
                normalOverride={normalOverrides?.[normalOverrideKey(studyKey, def.key)] ?? null}
                onSaveNormal={(text) => saveNormalOverride(def.key, text)}
                onResetNormal={() => resetNormalOverride(def.key)}
                onToggle={(k) => togglePathology(def.key, k)}
                onVar={(k, v) => setState((s) => setOrganVar(s, def.key, k, v))}
                onText={(t) => setState((s) => setOrganText(s, def.key, t))}
                onAddCustom={(organ) => setDialogOrgan(organ)}
              />
            );
          })}

          <UsgImagesCard
            images={images}
            pending={pendingImages}
            readOnly={isFinal}
            onAdd={addImage}
            onCaption={setCaption}
            onRemove={removeImage}
            onMove={moveImage}
            onPickDicom={orderUid ? () => setDicomOpen(true) : undefined}
            pacsLinked={!!orderUid}
          />
        </div>

        {/* Right rail: impression + live preview */}
        <div className="studio-scroll min-h-0 space-y-3 overflow-y-auto lg:sticky lg:top-0 lg:self-start">
          <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12px] font-bold tracking-wide">IMPRESSION</span>
              <div className="flex items-center gap-1.5">
                {impressionManual ? (
                  <DictationButton
                    onText={(t) =>
                      setState((s) => ({ ...s, impressionOverride: appendTranscript(s.impressionOverride ?? "", t) }))
                    }
                    title="Dictate the impression"
                  />
                ) : null}
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  manual
                <Switch
                  checked={impressionManual}
                  onCheckedChange={(v) => {
                    setImpressionManual(v);
                    setState((s) => ({
                      ...s,
                      impressionOverride: v ? resolved.impression.join("\n") : null,
                    }));
                  }}
                  className="scale-90 data-[state=checked]:bg-rose-500"
                />
              </label>
            </div>
            {impressionManual ? (
              <Textarea
                value={state.impressionOverride ?? ""}
                onChange={(e) => setState((s) => ({ ...s, impressionOverride: e.target.value }))}
                rows={4}
                className="text-[12px] leading-relaxed"
                placeholder="One impression line per row…"
              />
            ) : (
              <ol className="ml-4 space-y-1">
                {resolved.impression.map((l, i) => (
                  <li key={i} className="list-decimal text-[12px] font-semibold leading-snug text-foreground">{l}</li>
                ))}
              </ol>
            )}
            {resolved.suggestions.length ? (
              <div className="mt-2 space-y-0.5 border-t border-dashed border-border pt-2">
                {resolved.suggestions.map((s, i) => (
                  <p key={i} className="text-[11px] font-semibold text-amber-700">{s}</p>
                ))}
              </div>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-border bg-panel px-3 py-2">
              <Search className="h-3.5 w-3.5 text-faint" />
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Live preview — {paperLabel}
              </span>
              <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[9px] font-bold", isFinal ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
                {isFinal ? "FINAL" : "PROVISIONAL"}
              </span>
            </div>
            <iframe
              title="USG report preview"
              srcDoc={previewHtml}
              className="h-[640px] w-full bg-white"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      </div>
      </div>

      {/* Hidden print frame */}
      <iframe ref={printRef} title="print" className="hidden" />

      {/* v6 — Orthanc key-image picker + PC-PNDT Form F */}
      <UsgDicomPicker
        open={dicomOpen}
        onClose={() => setDicomOpen(false)}
        reportId={reportIdForPacs}
        studyInstanceUid={orderUid}
        onAdded={() => void reloadImages()}
      />
      {formFDefaults ? (
        <UsgFormFDialog
          open={formFOpen}
          onClose={() => setFormFOpen(false)}
          defaults={formFDefaults}
          order={order ?? null}
          report={report ? { id: report.id, stateJson: report.stateJson } : null}
        />
      ) : null}

      <UsgPathologyDialog
        open={dialogOrgan !== null}
        organKey={dialogOrgan ?? ""}
        organLabel={study.organs.find((o) => o.key === dialogOrgan)?.label ?? ""}
        editing={null}
        onClose={() => setDialogOrgan(null)}
        onSaved={onSaved}
      />

      <UsgStudyPicker
        open={pickerOpen}
        currentKey={studyKey}
        onPick={pickStudy}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}
