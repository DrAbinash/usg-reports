"use client";
/**
 * Findings editor — R2-mini: atomic rows + slot replacement.
 * Format bar (one-click complete report) → chips → composer
 * (level/laterality/severity) → FindingRow list → auto-compiled
 * impression (manual edits preserved until recompile).
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { SectionLabel, SeverityPill } from "./bits";
import { compileImpressionText } from "@/lib/compile";
import { MicButton, DictationBar } from "./Dictation";
import { KeyImages, type KeyImage } from "./KeyImages";
import { Plus, Trash2, Quote, StickyNote, Pencil, WandSparkles, Check, Zap, LayoutTemplate, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type Phrase = {
  id: string; region: string; modality: string; label: string;
  concept: string; level?: string | null; laterality?: string | null; severity?: string | null;
  text: string; titleFragment?: string | null; sortOrder: number;
};

export type Finding = {
  id: string; region: string; concept: string; level: string | null;
  laterality: string | null; severity: string | null; text: string;
  inImpression: boolean; titleFragment?: string | null;
  newParagraph?: boolean; impressionOnly?: boolean; sortOrder: number;
};

export type ReportCore = {
  id: string; technique: string; impression: string; impressionManual: boolean;
  recommendation: string; status: string;
  studyName?: string | null; formatKey?: string | null; titleManual?: boolean;
  findingsOpening?: string | null; openingManual?: boolean;
};

export type FormatOption = {
  key: string; modality: string; region: string; name: string;
  studyTitle: string; titleSuffix: string; isNormal: boolean; sortOrder: number;
};

const LEVELS: Record<string, string[]> = {
  "LS Spine": ["L1-L2", "L2-L3", "L3-L4", "L4-L5", "L5-S1"],
  "Cervical Spine": ["C2-C3", "C3-C4", "C4-C5", "C5-C6", "C6-C7", "C7-T1"],
  "CT Spine": ["C5-C6", "C6-C7", "D4-D5", "D8-D9", "D11-D12", "D12-L1", "L1-L2", "L3-L4", "L4-L5", "L5-S1"],
};

const SEVERITY_OPTIONS: Record<string, string[]> = {
  modic: ["I", "II", "III"],
  endplate: ["I", "II", "III"],
  spondylolisthesis: ["I", "II", "III", "IV"],
  fazekas: ["I", "II", "III"],
  fracture: ["acute", "chronic"],
  midline: ["3", "5", "8", "10"],
  wmh: ["mild", "few"],
};

function severityOptionsFor(concept: string): string[] {
  return SEVERITY_OPTIONS[concept] ?? ["mild", "moderate", "severe"];
}

export function FindingsEditor({
  report, order, findings, phrases, formats, images: initialImages, onMetaChange, onImagesChanged,
}: {
  report: ReportCore;
  order: { bodyRegion: string; modality: string; testName: string | null; studyInstanceUid?: string | null };
  findings: Finding[];
  phrases: Phrase[];
  formats: FormatOption[];
  images: KeyImage[];
  onMetaChange?: (meta: { studyName?: string | null }) => void;
  onImagesChanged?: () => void;
}) {
  const [rows, setRows] = useState<Finding[]>(findings);
  const [technique, setTechnique] = useState(report.technique);
  const [impression, setImpression] = useState(report.impression);
  const [manual, setManual] = useState(report.impressionManual);
  const [recommendation, setRecommendation] = useState(report.recommendation);
  const [opening, setOpening] = useState(report.findingsOpening ?? "");
  const [images, setImages] = useState<KeyImage[]>(initialImages);
  const [dictating, setDictating] = useState(false);
  const [appliedFormatKey, setAppliedFormatKey] = useState<string | null>(report.formatKey ?? null);
  const [confirmFormat, setConfirmFormat] = useState<FormatOption | null>(null);
  const [applying, setApplying] = useState(false);
  const [region, setRegion] = useState(order.bodyRegion || phrases[0]?.region || "LS Spine");
  const [composer, setComposer] = useState<{ phrase: Phrase; level: string; laterality: string; severity: string } | null>(null);
  const [conflict, setConflict] = useState<{ phrase: Phrase; level: string; laterality: string; severity: string; existingText: string } | null>(null);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [rowDraft, setRowDraft] = useState("");
  const [dirty, setDirty] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Server rows are the source of truth after every mutation; local list is
  // refreshed from mutation responses — never re-synced through effects.
  const refreshRows = useCallback(async (opts?: { syncMeta?: boolean }) => {
    const r = await fetch(`/api/reports/${report.id}`).then((res) => res.json()).catch(() => null);
    if (!r || r.error) return;
    setRows(r.findings);
    setImages(r.images ?? []);
    if (!r.report.impressionManual) {
      setImpression(r.report.impression);
      setManual(false);
    } else {
      setManual(true);
    }
    if (typeof r.report.findingsOpening !== "undefined" && !r.report.openingManual) {
      setOpening(r.report.findingsOpening ?? "");
    }
    if (opts?.syncMeta) {
      setTechnique(r.report.technique);
      setRecommendation(r.report.recommendation);
      setOpening(r.report.findingsOpening ?? "");
    }
    if (typeof r.report.studyName !== "undefined") {
      onMetaChange?.({ studyName: r.report.studyName });
    }
    if (typeof r.report.formatKey !== "undefined") {
      setAppliedFormatKey(r.report.formatKey);
    }
  }, [report.id, onMetaChange]);

  const regions = useMemo(() => {
    const set = new Set<string>(phrases.map((p) => p.region));
    if (order.bodyRegion) set.add(order.bodyRegion);
    return [...set];
  }, [phrases, order.bodyRegion]);

  const regionPhrases = phrases.filter((p) => p.region === region);
  const levels = LEVELS[region] ?? null;

  const applyImpression = (list: Finding[]) => {
    if (!manual) setImpression(compileImpressionText(list));
  };

  const postFinding = useCallback(async (payload: Record<string, unknown>, confirmReplace = false) => {
    const r = await fetch(`/api/reports/${report.id}/findings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, confirmReplace }),
    }).then((res) => res.json());
    if (r.conflict) return r;
    if (r.error) {
      toast.error(r.error);
      return null;
    }
    if (r.replaced) toast.success("Replaced the earlier finding on the same slot");
    return r;
  }, [report.id]);

  const addPhrase = async (phrase: Phrase, level = "", laterality = "", severity = "") => {
    const payload = {
      region: phrase.region,
      concept: phrase.concept,
      level: level || phrase.level || null,
      laterality: laterality || phrase.laterality || null,
      severity: severity || phrase.severity || null,
      text: phrase.text,
      titleFragment: phrase.titleFragment ?? null,
    };
    const r = await postFinding(payload);
    if (r?.conflict) {
      setConflict({ phrase, level, laterality, severity, existingText: r.existingText });
      return;
    }
    if (r?.ok) {
      setComposer(null);
      await refreshRows();
    }
  };

  const confirmReplace = async () => {
    if (!conflict) return;
    const c = conflict;
    setConflict(null);
    const r = await postFinding(
      {
        region: c.phrase.region, concept: c.phrase.concept,
        level: c.level || null, laterality: c.laterality || null,
        severity: c.severity || null, text: c.phrase.text,
        titleFragment: c.phrase.titleFragment ?? null,
      },
      true,
    );
    if (r?.ok) await refreshRows();
  };

  const applyFormat = async (format: FormatOption, confirmed = false) => {
    setApplying(true);
    const r = await fetch(`/api/reports/${report.id}/apply-format`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ formatKey: format.key, confirm: confirmed }),
    }).then((res) => res.json()).catch(() => null);
    setApplying(false);
    if (r?.confirmNeeded) {
      setConfirmFormat(format);
      return;
    }
    if (!r || r.error) {
      toast.error(r?.error ?? "Could not apply format");
      return;
    }
    // A pending autosave would overwrite the freshly applied sections.
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setDirty(false);
    setManual(false);
    setAppliedFormatKey(format.key);
    await refreshRows({ syncMeta: true });
    toast.success(`“${format.name}” applied — report ready to print`);
  };

  const removeRow = async (fid: string) => {
    setRows((rs) => {
      const next = rs.filter((r) => r.id !== fid);
      applyImpression(next);
      return next;
    });
    await fetch(`/api/reports/${report.id}/findings/${fid}`, { method: "DELETE" });
    await refreshRows();
  };

  const toggleImpression = async (row: Finding) => {
    setRows((rs) => {
      const next = rs.map((r) => (r.id === row.id ? { ...r, inImpression: !r.inImpression } : r));
      applyImpression(next);
      return next;
    });
    await fetch(`/api/reports/${report.id}/findings/${row.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ inImpression: !row.inImpression }),
    });
    await refreshRows();
  };

  const saveRowText = async (fid: string) => {
    const text = rowDraft.trim();
    if (!text) return;
    setRows((rs) => {
      const next = rs.map((r) => (r.id === fid ? { ...r, text } : r));
      applyImpression(next);
      return next;
    });
    await fetch(`/api/reports/${report.id}/findings/${fid}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    setEditingRow(null);
    await refreshRows();
  };

  const addNote = async () => {
    const r = await postFinding({ region, concept: "note", text: "…" });
    if (r?.ok) {
      await refreshRows();
      setEditingRow(r.row.id);
      setRowDraft("");
    }
  };

  /** Dictated finding → note row, straight into edit mode. */
  const addDictated = async (text: string) => {
    setDictating(false);
    const r = await postFinding({ region, concept: "note", text });
    if (r?.ok) await refreshRows();
  };

  const recompile = async () => {
    const r = await fetch(`/api/reports/${report.id}/recompile`, { method: "POST" }).then((res) => res.json());
    if (r.ok) {
      setImpression(r.impression);
      setManual(false);
      toast.success("Impression recompiled from findings");
    }
  };

  // Debounced autosave for technique / impression / recommendation / opening
  const queueSave = () => {
    setDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await fetch(`/api/reports/${report.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ technique, impression, recommendation, findingsOpening: opening }),
      });
      setDirty(false);
    }, 900);
  };

  const compiled = compileImpressionText(rows);
  const finalized = report.status === "FINALIZED";

  const visibleRows = useMemo(() => rows.filter((r) => !r.impressionOnly), [rows]);

  const groupByRegion = useMemo(() => {
    const groups: { region: string; items: Finding[] }[] = [];
    for (const r of visibleRows) {
      let g = groups.find((x) => x.region === r.region);
      if (!g) { g = { region: r.region, items: [] }; groups.push(g); }
      g.items.push(r);
    }
    return groups;
  }, [visibleRows]);

  return (
    <div className="space-y-5">
      {/* Report format — one click fills the whole report */}
      {formats.length > 0 ? (
        <section className="rounded-xl border border-primary/25 bg-panel/70 p-3.5 shadow-sm">
          <div className="mb-2.5 flex items-center justify-between">
            <SectionLabel>Report format — one click fills everything</SectionLabel>
            {appliedFormatKey ? (
              <span className="flex items-center gap-1 rounded-full bg-ok-bg px-2 py-0.5 text-[10.5px] font-semibold text-ok ring-1 ring-ok-line">
                <Check className="h-3 w-3" />
                {formats.find((f) => f.key === appliedFormatKey)?.name ?? appliedFormatKey}
              </span>
            ) : (
              <span className="text-[10px] text-faint">then fine-tune with phrase chips below</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {formats.map((f) => {
              const applied = appliedFormatKey === f.key;
              if (f.isNormal) {
                return (
                  <button
                    key={f.key}
                    disabled={applying}
                    onClick={() => applyFormat(f)}
                    data-testid={`format-${f.key}`}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[13px] font-bold shadow-md transition-all active:scale-[0.97] disabled:opacity-60",
                      applied
                        ? "bg-ok text-white ring-2 ring-ok ring-offset-2 ring-offset-panel"
                        : "bg-ok text-white hover:brightness-110",
                    )}
                  >
                    <Zap className="h-4 w-4" />
                    {f.name} report
                  </button>
                );
              }
              return (
                <button
                  key={f.key}
                  disabled={applying}
                  onClick={() => applyFormat(f)}
                  data-testid={`format-${f.key}`}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-3.5 py-2.5 text-[12.5px] font-semibold shadow-sm transition-all hover:border-primary/50 hover:bg-accent active:scale-[0.97] disabled:opacity-60",
                    applied
                      ? "border-primary bg-accent text-accent-foreground ring-1 ring-primary/40"
                      : "border-border bg-card text-foreground",
                  )}
                >
                  <LayoutTemplate className="h-3.5 w-3.5 text-primary" />
                  {f.name}
                  {applied ? <Check className="h-3 w-3 text-primary" /> : null}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Technique */}
      <section>
        <div className="mb-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SectionLabel>Technique</SectionLabel>
            <MicButton label="technique" onFinal={(chunk) => { const v = (technique ? technique.trimEnd() + " " : "") + chunk; setTechnique(v); queueSave(); }} />
          </div>
        </div>
        <Textarea
          value={technique}
          onChange={(e) => { setTechnique(e.target.value); queueSave(); }}
          rows={2}
          className="border-border bg-card text-[13px] leading-relaxed"
          placeholder="Sequences obtained…"
        />
      </section>

      {/* Findings */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <SectionLabel>Findings · {visibleRows.length}</SectionLabel>
          <div className="flex items-center gap-1.5">
            {!dictating && !finalized ? (
              <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[11px] text-muted-foreground" onClick={() => setDictating(true)} title="Dictate a finding by voice">
                <Volume2 className="h-3 w-3" /> Dictate
              </Button>
            ) : null}
            {!finalized ? (
              <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[11px] text-muted-foreground" onClick={addNote}>
                <StickyNote className="h-3 w-3" /> Add note
              </Button>
            ) : null}
          </div>
        </div>

        {dictating ? (
          <DictationBar
            onFinalText={addDictated}
            onCancel={() => setDictating(false)}
          />
        ) : null}

        {/* Opening line — the composed phrase ("MRI BRAIN WITH FAZEKAS GRADE 1
            CHANGES AND SENILE CHANGES") lives HERE, not in the heading. */}
        {opening.trim() || appliedFormatKey ? (
          <div className="mb-2.5">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary/70">Findings opening line</span>
              <span className="text-[9.5px] text-faint">— printed bold; the heading stays “{report.studyName || order.testName}”</span>
            </div>
            <Textarea
              value={opening}
              onChange={(e) => { setOpening(e.target.value); queueSave(); }}
              rows={2}
              data-testid="findings-opening"
              className="border-primary/25 bg-accent/40 text-[12.5px] font-semibold uppercase leading-relaxed tracking-wide text-foreground"
              placeholder="MRI BRAIN WITH …"
            />
          </div>
        ) : null}

        {/* Region switcher */}
        {regions.length > 1 ? (
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {regions.map((r) => (
              <button
                key={r}
                onClick={() => { setRegion(r); setComposer(null); }}
                className={cn(
                  "rounded-full px-3 py-1 text-[11px] font-semibold transition-all",
                  r === region
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-card text-muted-foreground ring-1 ring-border hover:text-foreground",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        ) : null}

        {/* Phrase chips */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {regionPhrases.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                if (p.text.includes("{") ) {
                  setComposer({ phrase: p, level: levels?.[3] ?? "", laterality: "", severity: "" });
                } else {
                  addPhrase(p);
                }
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-[12px] font-medium shadow-sm transition-all hover:border-primary/50 hover:bg-accent hover:shadow active:scale-[0.97]",
                composer?.phrase.id === p.id && "border-primary bg-accent",
              )}
              title={p.text}
            >
              <Plus className="h-3 w-3 text-primary" />
              {p.label}
            </button>
          ))}
        </div>

        {/* Composer */}
        {composer ? (
          <div className="mb-3 rounded-lg border border-primary/30 bg-accent/60 p-3 ring-1 ring-primary/10">
            <div className="flex flex-wrap items-center gap-2">
              {levels && composer.phrase.text.includes("{level}") ? (
                <Select value={composer.level} onValueChange={(v) => setComposer({ ...composer, level: v })}>
                  <SelectTrigger className="h-8 w-[110px] border-border bg-card text-[12px]">
                    <SelectValue placeholder="Level" />
                  </SelectTrigger>
                  <SelectContent>
                    {levels.map((l) => <SelectItem key={l} value={l} className="text-[12px]">{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : null}
              {composer.phrase.text.includes("{laterality}") ? (
                <Select value={composer.laterality} onValueChange={(v) => setComposer({ ...composer, laterality: v })}>
                  <SelectTrigger className="h-8 w-[120px] border-border bg-card text-[12px]">
                    <SelectValue placeholder="Side" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left" className="text-[12px]">Left</SelectItem>
                    <SelectItem value="right" className="text-[12px]">Right</SelectItem>
                    <SelectItem value="bilateral" className="text-[12px]">Bilateral</SelectItem>
                  </SelectContent>
                </Select>
              ) : null}
              {composer.phrase.text.includes("{severity}") ? (
                <Select value={composer.severity} onValueChange={(v) => setComposer({ ...composer, severity: v })}>
                  <SelectTrigger className="h-8 w-[120px] border-border bg-card text-[12px]">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    {severityOptionsFor(composer.phrase.concept).map((s) => (
                      <SelectItem key={s} value={s} className="text-[12px] capitalize">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="ghost" className="h-8 text-[12px]" onClick={() => setComposer(null)}>Cancel</Button>
                <Button
                  size="sm"
                  className="h-8 text-[12px]"
                  onClick={() => addPhrase(composer.phrase, composer.level, composer.laterality, composer.severity)}
                >
                  Add finding
                </Button>
              </div>
            </div>
            <p className="mt-2 text-[12px] italic leading-relaxed text-muted-foreground">
              “{composer.phrase.text
                .replace("{level}", composer.level || "…")
                .replace("{laterality}", composer.laterality || "…")
                .replace("{severity}", composer.severity || "…")}”
            </p>
          </div>
        ) : null}

        {/* Rows */}
        {groupByRegion.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card/50 px-3 py-8 text-center">
            <p className="text-[12px] text-faint">No findings yet — tap a phrase above.</p>
            <p className="mt-1 text-[11px] text-faint/70">Normal phrases first, then abnormal; same slot replaces automatically.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupByRegion.map((g) => (
              <div key={g.region}>
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-primary/70">{g.region}</div>
                <div className="space-y-1.5">
                  {g.items.map((row) => (
                    <div
                      key={row.id}
                      className={cn(
                        "group flex items-start gap-2 rounded-lg border bg-card px-3 py-2 transition-all",
                        row.concept === "note" ? "border-dashed border-warn-line bg-warn-bg/30" : "border-border",
                      )}
                    >
                      {row.level ? (
                        <span className="mt-0.5 shrink-0 rounded bg-panel px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">{row.level}</span>
                      ) : null}
                      {editingRow === row.id ? (
                        <div className="min-w-0 flex-1">
                          <Textarea
                            value={rowDraft}
                            onChange={(e) => setRowDraft(e.target.value)}
                            rows={2}
                            autoFocus
                            className="border-border bg-card text-[12.5px]"
                          />
                          <div className="mt-1.5 flex gap-2">
                            <Button size="sm" className="h-7 text-[11px]" onClick={() => saveRowText(row.id)}>
                              <Check className="mr-1 h-3 w-3" /> Save
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setEditingRow(null)}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <p
                          className={cn(
                            "min-w-0 flex-1 cursor-text text-[12.5px] leading-relaxed",
                            row.concept === "note" ? "italic text-warn" : "text-foreground",
                          )}
                          onClick={() => { setEditingRow(row.id); setRowDraft(row.text); }}
                          title="Click to edit"
                        >
                          {row.text}
                          <Pencil className="ml-1.5 inline h-3 w-3 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
                        </p>
                      )}
                      <div className="flex shrink-0 items-center gap-1">
                        {row.concept !== "note" ? <SeverityPill severity={row.severity} /> : null}
                        <button
                          onClick={() => toggleImpression(row)}
                          title={row.inImpression ? "In impression — click to exclude" : "Click to include in impression"}
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded transition-all",
                            row.inImpression ? "bg-primary/10 text-primary" : "text-faint hover:text-foreground",
                          )}
                        >
                          <Quote className={cn("h-3.5 w-3.5", row.inImpression && "fill-primary")} />
                        </button>
                        <button
                          onClick={() => removeRow(row.id)}
                          title="Remove"
                          className="flex h-6 w-6 items-center justify-center rounded text-faint transition-colors hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Key images — captured from OHIF, printed in the report */}
      <KeyImages
        reportId={report.id}
        images={images}
        finalized={finalized}
        studyInstanceUid={order.studyInstanceUid}
        onChange={() => { void refreshRows(); onImagesChanged?.(); }}
      />

      {/* Impression */}
      <section>
        <div className="mb-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SectionLabel>Impression</SectionLabel>
            <MicButton label="impression" onFinal={(chunk) => { const v = (impression ? impression.trimEnd() + " " : "") + chunk; setImpression(v); setManual(true); queueSave(); }} />
          </div>
          {manual ? (
            <button onClick={recompile} className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
              <WandSparkles className="h-3 w-3" />
              Edited manually — recompile from findings?
            </button>
          ) : (
            <span className="text-[10px] text-faint">auto-compiled from quoted findings</span>
          )}
        </div>
        <Textarea
          value={impression}
          onChange={(e) => { setImpression(e.target.value); setManual(true); queueSave(); }}
          rows={4}
          className="border-border bg-card text-[13px] leading-relaxed"
          placeholder="1. …"
        />
        {!manual && compiled.trim() === "" ? (
          <p className="mt-1 text-[11px] text-faint">Quote findings (the “ icon) to build the impression.</p>
        ) : null}
      </section>

      {/* Recommendation */}
      <section>
        <div className="mb-1.5 flex items-center gap-2">
          <SectionLabel>Recommendation</SectionLabel>
          <MicButton label="recommendation" onFinal={(chunk) => { const v = (recommendation ? recommendation.trimEnd() + " " : "") + chunk; setRecommendation(v); queueSave(); }} />
        </div>
        <Textarea
          value={recommendation}
          onChange={(e) => { setRecommendation(e.target.value); queueSave(); }}
          rows={2}
          className="border-border bg-card text-[13px] leading-relaxed"
          placeholder="Optional…"
        />
      </section>

      {dirty ? <p className="text-[11px] text-faint">Saving…</p> : null}

      {/* Slot replacement confirm */}
      <AlertDialog open={!!conflict} onOpenChange={(v) => !v && setConflict(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px]">Replace the existing finding?</AlertDialogTitle>
            <AlertDialogDescription className="text-[12.5px] leading-relaxed">
              This occupies the same slot as an earlier finding on {conflict?.level || "this region"} — two facts
              about one place cannot both stand.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 rounded-lg border border-border bg-panel p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-bad">Existing</p>
            <p className="text-[12.5px] leading-relaxed text-muted-foreground line-through">{conflict?.existingText}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ok">New</p>
            <p className="text-[12.5px] font-medium leading-relaxed">
              {conflict?.phrase.text
                .replace("{level}", conflict.level || "…")
                .replace("{laterality}", conflict.laterality || "…")
                .replace("{severity}", conflict.severity || "…")}
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-[12px]">Keep both (cancel)</AlertDialogCancel>
            <AlertDialogAction className="text-[12px]" onClick={confirmReplace}>Replace</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Format replace confirm */}
      <AlertDialog open={!!confirmFormat} onOpenChange={(v) => !v && setConfirmFormat(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px]">
              Replace the current report with “{confirmFormat?.name}”?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[12.5px] leading-relaxed">
              This report already has content. Applying a format replaces the findings, technique,
              impression and recommendation with the format’s complete skeleton.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-[12px]">Keep current</AlertDialogCancel>
            <AlertDialogAction
              className="text-[12px]"
              onClick={() => {
                const f = confirmFormat;
                setConfirmFormat(null);
                if (f) applyFormat(f, true);
              }}
            >
              Apply format
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
