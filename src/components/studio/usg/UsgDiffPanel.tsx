"use client";
/**
 * Follow-up diff panel — "Δ vs previous scan". Rendered at the top of the
 * composer for follow-up drafts: what changed between the last scan and the
 * current draft, per organ, at a glance.
 */
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ArrowRight, ChevronDown, GitCompare, Minus, Plus } from "lucide-react";
import type { UsgComposerState, UsgPathologyDef } from "@/lib/usg/types";
import { computeDiff, type UsgReportDiff } from "@/lib/usg/diff";

export type DiffSource = {
  id: string;
  serial?: string;
  date: string; // pre-formatted display date
  stateJson: string;
  impression: string;
};

export type UsgDiffPanelProps = {
  source: DiffSource;
  state: UsgComposerState;
  pathologies: UsgPathologyDef[];
};

export function UsgDiffPanel({ source, state, pathologies }: UsgDiffPanelProps) {
  const [open, setOpen] = useState(true);

  const diff: UsgReportDiff | null = useMemo(() => {
    try {
      const prev = JSON.parse(source.stateJson) as UsgComposerState;
      const prevLines = source.impression.split(/\n+/).map((l) => l.trim()).filter(Boolean);
      return computeDiff(prev, state, pathologies, prevLines.length ? prevLines : null);
    } catch {
      return null;
    }
  }, [source.stateJson, source.impression, state, pathologies]);

  if (!diff) return null;

  const total =
    diff.measurements.length +
    diff.addedPathologies.length +
    diff.clearedPathologies.length +
    diff.findings.length;

  return (
    <div className="shrink-0 border-b border-border bg-gradient-to-r from-sky-50/90 to-indigo-50/60 px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-sky-700"
        >
          <GitCompare className="h-3.5 w-3.5" />
          Δ vs previous scan{source.serial ? ` — ${source.serial}` : ""} · {source.date}
          <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        </button>
        {total === 0 ? (
          <span className="rounded-full bg-white px-2.5 py-0.5 text-[10.5px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
            no changes yet — identical to the last scan
          </span>
        ) : (
          <span className="rounded-full bg-white px-2.5 py-0.5 text-[10.5px] font-semibold text-sky-700 ring-1 ring-sky-200">
            {total} change{total > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {open && total > 0 ? (
        <div className="mt-2 space-y-1.5">
          {diff.measurements.map((m, i) => (
            <div key={`m${i}`} className="flex flex-wrap items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[11.5px] ring-1 ring-sky-100">
              <span className="font-bold text-foreground">
                {m.organLabel} — {m.label}
              </span>
              {m.from ? (
                <span className="font-semibold text-muted-foreground line-through decoration-muted-foreground/50">{m.from}{m.unit ? ` ${m.unit}` : ""}</span>
              ) : null}
              <ArrowRight className="h-3 w-3 text-sky-500" />
              <span className={cn("font-bold", !m.from ? "text-emerald-700" : "text-rose-700")}>
                {m.to || "cleared"}{m.unit ? ` ${m.unit}` : ""}
              </span>
            </div>
          ))}
          {diff.addedPathologies.map((p, i) => (
            <div key={`a${i}`} className="flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11.5px] ring-1 ring-rose-100">
              <Plus className="h-3 w-3 text-rose-600" />
              <span className="font-semibold text-rose-800">
                {p.organLabel} — {p.label} <span className="font-normal text-rose-500">(new since last scan)</span>
              </span>
            </div>
          ))}
          {diff.clearedPathologies.map((p, i) => (
            <div key={`c${i}`} className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11.5px] ring-1 ring-emerald-100">
              <Minus className="h-3 w-3 text-emerald-600" />
              <span className="font-semibold text-emerald-800">
                {p.organLabel} — {p.label} <span className="font-normal text-emerald-600">(resolved since last scan)</span>
              </span>
            </div>
          ))}
          {diff.findings.map((f, i) => (
            <div key={`f${i}`} className="rounded-lg bg-white px-2.5 py-1.5 text-[11px] ring-1 ring-sky-100">
              <span className="font-bold text-foreground">{f.organLabel} wording</span>
              <div className="mt-0.5 grid gap-1 md:grid-cols-2">
                <p className="text-muted-foreground"><span className="font-semibold text-sky-600">was:</span> {f.from}</p>
                <p className="text-foreground"><span className="font-semibold text-rose-600">now:</span> {f.to}</p>
              </div>
            </div>
          ))}
          {diff.impression ? (
            <div className="rounded-lg bg-white px-2.5 py-1.5 text-[11px] ring-1 ring-sky-100">
              <span className="font-bold text-foreground">Impression changed</span>
              <div className="mt-0.5 grid gap-1 md:grid-cols-2">
                <p className="text-muted-foreground"><span className="font-semibold text-sky-600">was:</span> {diff.impression.from.join(" · ")}</p>
                <p className="text-foreground"><span className="font-semibold text-rose-600">now:</span> {diff.impression.to.join(" · ")}</p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
