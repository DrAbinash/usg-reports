"use client";
/**
 * USG composer — the doctor's whole-abdomen workflow:
 *   patient strip → organ cards (quick-select pathologies that swap ONE
 *   organ's finding) → auto impression → live letterhead preview → print.
 */
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ArrowLeft, ChevronDown, FileCheck2, Loader2, Printer, Save, Search, Settings2 } from "lucide-react";
import type { UsgComposerState, UsgPathologyDef } from "@/lib/usg/types";
import { USG_STUDIES, getStudy } from "@/lib/usg/studies";
import {
  applyPathology,
  makeLookup,
  pathologiesForOrgan,
  resolve,
  setOrganText,
  setOrganVar,
  switchStudy,
} from "@/lib/usg/composer";
import { buildUsgReportHtml, type UsgPrintSettings } from "@/lib/usg/print";
import { UsgOrganCard } from "./UsgOrganCard";
import { UsgPathologyDialog } from "./UsgPathologyDialog";

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
};

export type UsgComposerProps = {
  pathologies: UsgPathologyDef[];
  settings: UsgPrintSettings;
  report: UsgReportRow | null; // existing draft to continue, or null = new
  onBack: () => void;
  onSaved: () => void; // refresh list
};

function today(): string {
  return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function UsgComposer({ pathologies, settings, report, onBack, onSaved }: UsgComposerProps) {
  const initial = useMemo(() => {
    if (!report) return null;
    try {
      return JSON.parse(report.stateJson) as UsgComposerState;
    } catch {
      return null;
    }
  }, [report]);

  const studyKey0 = report?.studyKey ?? "wa-female";
  const [patientName, setPatientName] = useState(report?.patientName ?? "");
  const [patientAge, setPatientAge] = useState(report?.patientAge ?? "");
  const [patientSex, setPatientSex] = useState(report?.patientSex ?? "F");
  const [referredBy, setReferredBy] = useState(report?.referredBy ?? "");
  const [studyKey, setStudyKey] = useState(studyKey0);
  const study = getStudy(studyKey) ?? USG_STUDIES[0];
  const [technique, setTechnique] = useState(report?.technique ?? study.technique);
  const [state, setState] = useState<UsgComposerState>(
    () => initial ?? { studyKey: studyKey0, organs: study.organs.map((o) => ({ organ: o.key, pathology: null, custom: false, text: o.normal, vars: {} })), impressionOverride: null },
  );
  const [impressionManual, setImpressionManual] = useState(!!initial?.impressionOverride);
  const [showTechnique, setShowTechnique] = useState(false);
  const [busy, setBusy] = useState<"" | "save" | "finalize" | "print">("");
  /** Id learned from the first POST — later saves PUT the same row (no duplicates). */
  const savedIdRef = useRef<string | null>(report?.id ?? null);
  const [finalizedHere, setFinalizedHere] = useState(report?.status === "FINALIZED");
  const [dialogOrgan, setDialogOrgan] = useState<string | null>(null);
  const printRef = useRef<HTMLIFrameElement>(null);

  const lookup = useMemo(() => makeLookup(pathologies), [pathologies]);
  const resolved = useMemo(() => resolve(state, lookup, technique), [state, lookup, technique]);

  const previewHtml = useMemo(
    () =>
      buildUsgReportHtml(
        settings,
        { name: patientName || "—", age: patientAge, sex: patientSex, referredBy, date: today() },
        resolved,
      ),
    [settings, patientName, patientAge, patientSex, referredBy, resolved],
  );

  const pickStudy = (k: string) => {
    const target = getStudy(k);
    if (!target) return;
    setStudyKey(k);
    setTechnique(target.technique);
    setState((s) => switchStudy(s, k));
  };

  const changeSex = (sex: "F" | "M") => {
    setPatientSex(sex);
    // Follow the doctor's convention: whole/lower abdomen track patient sex.
    if (sex === "M" && (studyKey === "wa-female" || studyKey === "la-female")) {
      pickStudy(studyKey === "wa-female" ? "wa-male" : "la-male");
    } else if (sex === "F" && (studyKey === "wa-male" || studyKey === "la-male")) {
      pickStudy(studyKey === "wa-male" ? "wa-female" : "la-female");
    }
  };

  const abnormalCount = state.organs.filter((o) => o.pathology).length;

  const persist = async (status: "" | "finalize"): Promise<string | null> => {
    if (!patientName.trim()) {
      toast.error("Patient name is required");
      return null;
    }
    setBusy(status === "finalize" ? "finalize" : "save");
    try {
      const payload = {
        patientName: patientName.trim(),
        patientAge: patientAge.trim(),
        patientSex,
        referredBy: referredBy.trim(),
        studyKey,
        technique,
        state,
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
        setFinalizedHere(true);
        toast.success("Report finalized — snapshot frozen for reprint");
      } else {
        toast.success("Draft saved");
      }
      onSaved();
      return id;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
      return null;
    } finally {
      setBusy("");
    }
  };

  const print = async () => {
    if (!patientName.trim()) {
      toast.error("Patient name is required");
      return;
    }
    setBusy("print");
    try {
      // Finalized reports print their frozen snapshot; drafts print the live preview.
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
            <Input value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Name"
              className="h-9 border-border bg-panel text-[13px] font-semibold" />
          </div>
          <div className="grid w-[90px] gap-1">
            <Label className="text-[10px] font-semibold uppercase tracking-wide text-faint">Age</Label>
            <Input value={patientAge} onChange={(e) => setPatientAge(e.target.value)} placeholder="Yrs"
              className="h-9 border-border bg-panel text-[13px]" />
          </div>
          <div className="grid w-[80px] gap-1">
            <Label className="text-[10px] font-semibold uppercase tracking-wide text-faint">Sex</Label>
            <Select value={patientSex} onValueChange={(v) => changeSex(v as "F" | "M")}>
              <SelectTrigger className="h-9 border-border bg-panel text-[13px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="F">F</SelectItem>
                <SelectItem value="M">M</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid flex-1 min-w-[180px] gap-1">
            <Label className="text-[10px] font-semibold uppercase tracking-wide text-faint">Referred by</Label>
            <Input value={referredBy} onChange={(e) => setReferredBy(e.target.value)} placeholder="Dr. —"
              className="h-9 border-border bg-panel text-[13px]" />
          </div>
          <div className="grid min-w-[190px] gap-1">
            <Label className="text-[10px] font-semibold uppercase tracking-wide text-faint">Study</Label>
            <Select value={studyKey} onValueChange={pickStudy}>
              <SelectTrigger className="h-9 border-border bg-panel text-[13px] font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {USG_STUDIES.map((s) => (
                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={() => persist("")} disabled={busy !== "" || finalizedHere}
              className="h-9 border-border bg-panel">
              {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
            <Button size="sm" onClick={() => persist("finalize")} disabled={busy !== "" || finalizedHere}
              className="h-9 bg-emerald-600 hover:bg-emerald-700">
              {busy === "finalize" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}
              Finalize
            </Button>
            <Button size="sm" variant="outline" onClick={print} disabled={busy !== ""}
              className="h-9 border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100">
              {busy === "print" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              Print A4
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
          <span className="font-semibold text-foreground">{resolved.title}</span>
          <span className={cn("rounded-full px-2 py-0.5 font-semibold", abnormalCount ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700")}>
            {abnormalCount ? `${abnormalCount} finding${abnormalCount > 1 ? "s" : ""}` : "All normal"}
          </span>
          {report?.status === "FINALIZED" || finalizedHere ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">finalized — reprint only</span>
          ) : null}
        </div>
        {showTechnique ? (
          <Textarea value={technique} onChange={(e) => setTechnique(e.target.value)} rows={2}
            className="mt-2 border-border bg-panel text-[12px]" />
        ) : null}
      </div>

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
                onSelect={(k) => setState((s) => applyPathology(s, def.key, k, lookup))}
                onVar={(k, v) => setState((s) => setOrganVar(s, def.key, k, v))}
                onText={(t) => setState((s) => setOrganText(s, def.key, t))}
                onAddCustom={(organ) => setDialogOrgan(organ)}
              />
            );
          })}
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
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Live preview — A4</span>
              <span className="ml-auto text-[10px] text-faint">tick “Background graphics” when printing</span>
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
