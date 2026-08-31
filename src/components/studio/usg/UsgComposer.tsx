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
import { ArrowLeft, CalendarDays, ChevronDown, FileCheck2, Loader2, Phone, Printer, Save, Search, Settings2 } from "lucide-react";
import type { UsgComposerState, UsgPathologyDef } from "@/lib/usg/types";
import { USG_SEX_CHILD } from "@/lib/usg/types";
import { USG_STUDIES, STUDY_GROUPS, getStudy } from "@/lib/usg/studies";
import {
  applyPathologies,
  makeLookup,
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
  onBack: () => void;
  onSaved: () => void; // refresh list
};

function fmtPrintDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function UsgComposer({ pathologies, settings, report, prefill, diffSource, onBack, onSaved }: UsgComposerProps) {
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
  const study = getStudy(studyKey) ?? USG_STUDIES[0];
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

  const lookup = useMemo(() => makeLookup(pathologies), [pathologies]);
  const resolved = useMemo(() => resolve(state, lookup, technique), [state, lookup, technique]);

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
    setState((s) => switchStudy(s, k));
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
      return applyPathologies(s, organKey, next, lookup);
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
        toast.success(`Report finalized — register no. ${formatUsgSerial(body.serialNo ?? 0)} frozen for reprint`);
      } else {
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
          <Textarea value={technique} onChange={(e) => setTechnique(e.target.value)} rows={2}
            className="mt-2 border-border bg-panel text-[12px]" />
        ) : null}
      </div>

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
          />
        </div>

        {/* Right rail: impression + live preview */}
        <div className="studio-scroll min-h-0 space-y-3 overflow-y-auto lg:sticky lg:top-0 lg:self-start">
          <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12px] font-bold tracking-wide">IMPRESSION</span>
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

      {/* Hidden print frame */}
      <iframe ref={printRef} title="print" className="hidden" />

      <UsgPathologyDialog
        open={dialogOrgan !== null}
        organKey={dialogOrgan ?? ""}
        organLabel={study.organs.find((o) => o.key === dialogOrgan)?.label ?? ""}
        editing={null}
        onClose={() => setDialogOrgan(null)}
        onSaved={onSaved}
      />
    </div>
  );
}
