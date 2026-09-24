"use client";
/**
 * Impression / advice triad zone + BI-RADS, copy-findings, legacy override,
 * declaration line. Callbacks stay behaviour-identical to the prior inline wiring.
 */
import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { UsgComposerState, UsgResolved, UsgTriadLine } from "@/lib/usg/types";
import { selectedPathologies } from "@/lib/usg/composer";
import { pathologyOverrideKey, type PathologyWordingOverrides } from "@/lib/usg/triad";
import { copyForwardFindings } from "@/lib/usg/quickActions";
import { biradsImpressionLine, biradsFollowUpDays, type BiradsCategory } from "@/lib/usg/birads";
import { UsgTriadZones } from "../UsgTriadZones";
import { UsgBiradsPicker } from "../UsgBiradsPicker";

export type PriorFinalizedRow = {
  id: string;
  scanDate: string | null;
  stateJson: string | null;
  studyKey: string | null;
};

export type ImpressionZoneProps = {
  resolved: UsgResolved;
  state: UsgComposerState;
  setState: React.Dispatch<React.SetStateAction<UsgComposerState>>;
  isFinal: boolean;
  studyKey: string;
  impressionManual: boolean;
  setImpressionManual: (v: boolean) => void;
  declarationLine?: string | null;
  paperLabel: string;
  enableBirads: boolean;
  birads: BiradsCategory | null;
  setBirads: (v: BiradsCategory | null) => void;
  priorFinalized: PriorFinalizedRow[];
  pathologyWording?: PathologyWordingOverrides | null;
  onPathologyWordingChange?: (next: PathologyWordingOverrides) => void;
  savedId: string | null;
};

function impressionEqual(a: ImpressionZoneProps, b: ImpressionZoneProps): boolean {
  return (
    a.resolved === b.resolved &&
    a.state === b.state &&
    a.setState === b.setState &&
    a.isFinal === b.isFinal &&
    a.studyKey === b.studyKey &&
    a.impressionManual === b.impressionManual &&
    a.setImpressionManual === b.setImpressionManual &&
    a.declarationLine === b.declarationLine &&
    a.paperLabel === b.paperLabel &&
    a.enableBirads === b.enableBirads &&
    a.birads === b.birads &&
    a.setBirads === b.setBirads &&
    a.priorFinalized === b.priorFinalized &&
    a.pathologyWording === b.pathologyWording &&
    a.onPathologyWordingChange === b.onPathologyWordingChange &&
    a.savedId === b.savedId
  );
}

export const ImpressionZone = memo(function ImpressionZone({
  resolved,
  state,
  setState,
  isFinal,
  studyKey,
  impressionManual,
  setImpressionManual,
  declarationLine,
  paperLabel,
  enableBirads,
  birads,
  setBirads,
  priorFinalized,
  pathologyWording,
  onPathologyWordingChange,
  savedId,
}: ImpressionZoneProps) {
  const impressionLines: UsgTriadLine[] =
    resolved.impressionLines ??
    resolved.impression.map((t) => ({
      text: t,
      pathologyKey: "",
      edited: false,
      legacy: !!state.impressionOverride,
    }));
  const adviceLines: UsgTriadLine[] =
    resolved.adviceLines ??
    (resolved.advice ?? resolved.suggestions).map((t) => ({
      text: t,
      pathologyKey: "",
      edited: false,
    }));

  return (
    <>
      {state.studyKey === "breast" && enableBirads && !isFinal ? (
        <UsgBiradsPicker
          value={birads}
          onChange={(v) => {
            setBirads(v);
            const line = biradsImpressionLine(v);
            if (!line) return;
            setState((s) => {
              const current = (s.impressionAddendum ?? "")
                .split("\n")
                .filter((l) => !/^BI-RADS\s/i.test(l.trim()))
                .join("\n")
                .trim();
              const next = current ? `${current}\n${line}` : line;
              return { ...s, impressionAddendum: next };
            });
            const followDays = biradsFollowUpDays(v);
            if (followDays && savedId) {
              const d = new Date();
              d.setDate(d.getDate() + followDays);
              fetch(`/api/usg/reports/${savedId}/follow-up`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  followUpDate: d.toISOString().slice(0, 10),
                  followUpNote: `BI-RADS 3 — short-interval follow-up (${Math.round(followDays / 30)} months)`,
                }),
              }).then(
                () => toast.success(`BI-RADS 3 follow-up set for ${d.toLocaleDateString("en-IN")}`),
                () => {},
              );
            }
          }}
        />
      ) : null}

      {!isFinal && priorFinalized.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {priorFinalized.slice(0, 2).map((p) => {
            const label = p.scanDate
              ? new Date(p.scanDate).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : "prior scan";
            return (
              <Button
                key={p.id}
                type="button"
                size="sm"
                variant="outline"
                className="h-7 border-emerald-200 bg-emerald-50/60 px-2.5 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-100"
                title="Merge organ findings (pathologies, measurements, grid rows) from this finalized report"
                onClick={() => {
                  try {
                    const prior = JSON.parse(p.stateJson ?? "{}") as UsgComposerState;
                    const { state: next, mergedOrgans } = copyForwardFindings(state, prior);
                    setState(next);
                    toast.success(
                      mergedOrgans > 0
                        ? `Copied findings from ${label} (${mergedOrgans} organ${mergedOrgans === 1 ? "" : "s"})`
                        : `No findings to copy from ${label}`,
                    );
                  } catch {
                    toast.error("Could not read prior report");
                  }
                }}
              >
                Copy findings from {label}
              </Button>
            );
          })}
        </div>
      ) : null}

      <UsgTriadZones
        impressionLines={impressionLines}
        adviceLines={adviceLines}
        disabled={isFinal}
        impressionAddendum={state.impressionAddendum}
        onDismissImpression={(text) =>
          setState((s) => ({
            ...s,
            dismissedImpressions: [...new Set([...(s.dismissedImpressions ?? []), text])],
          }))
        }
        onDismissAdvice={(text) =>
          setState((s) => ({
            ...s,
            dismissedAdvice: [...new Set([...(s.dismissedAdvice ?? []), text])],
          }))
        }
        onEditImpression={(pk, text) => {
          if (!pk) {
            setImpressionManual(true);
            setState((s) => ({ ...s, impressionOverride: text }));
            return;
          }
          setState((s) => ({
            ...s,
            impressionEdits: { ...(s.impressionEdits ?? {}), [pk]: text },
          }));
        }}
        onEditAdvice={(pk, text) => {
          if (!pk) return;
          setState((s) => ({
            ...s,
            adviceEdits: { ...(s.adviceEdits ?? {}), [pk]: text },
          }));
        }}
        onResetImpressionEdit={(pk) =>
          setState((s) => {
            const next = { ...(s.impressionEdits ?? {}) };
            delete next[pk];
            return { ...s, impressionEdits: next };
          })
        }
        onResetAdviceEdit={(pk) =>
          setState((s) => {
            const next = { ...(s.adviceEdits ?? {}) };
            delete next[pk];
            return { ...s, adviceEdits: next };
          })
        }
        onAddendum={(text) => setState((s) => ({ ...s, impressionAddendum: text }))}
        onSaveImpressionDefault={async (pk, text) => {
          const organ = state.organs.find((o) => selectedPathologies(o).includes(pk))?.organ;
          if (!organ) return;
          const res = await fetch("/api/usg/pathology-wording", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ studyKey, organKey: organ, pathologyKey: pk, kind: "impression", text }),
          });
          if (!res.ok) {
            toast.error("Could not save impression default");
            return;
          }
          const key = pathologyOverrideKey(studyKey, organ, pk);
          onPathologyWordingChange?.({
            impressions: { ...(pathologyWording?.impressions ?? {}), [key]: text },
            advice: { ...(pathologyWording?.advice ?? {}) },
          });
          toast.success("Impression wording saved as clinic default");
        }}
        onSaveAdviceDefault={async (pk, text) => {
          const organ = state.organs.find((o) => selectedPathologies(o).includes(pk))?.organ;
          if (!organ) return;
          const res = await fetch("/api/usg/pathology-wording", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ studyKey, organKey: organ, pathologyKey: pk, kind: "advice", text }),
          });
          if (!res.ok) {
            toast.error("Could not save advice default");
            return;
          }
          const key = pathologyOverrideKey(studyKey, organ, pk);
          onPathologyWordingChange?.({
            impressions: { ...(pathologyWording?.impressions ?? {}) },
            advice: { ...(pathologyWording?.advice ?? {}), [key]: text },
          });
          toast.success("Advice wording saved as clinic default");
        }}
        onResetImpressionDefault={async (pk) => {
          const organ = state.organs.find((o) => selectedPathologies(o).includes(pk))?.organ;
          if (!organ) return;
          await fetch(
            `/api/usg/pathology-wording?studyKey=${encodeURIComponent(studyKey)}&organKey=${encodeURIComponent(organ)}&pathologyKey=${encodeURIComponent(pk)}&kind=impression`,
            { method: "DELETE" },
          );
          const key = pathologyOverrideKey(studyKey, organ, pk);
          const nextImp = { ...(pathologyWording?.impressions ?? {}) };
          delete nextImp[key];
          onPathologyWordingChange?.({
            impressions: nextImp,
            advice: { ...(pathologyWording?.advice ?? {}) },
          });
          toast.success("Impression default cleared");
        }}
        onResetAdviceDefault={async (pk) => {
          const organ = state.organs.find((o) => selectedPathologies(o).includes(pk))?.organ;
          if (!organ) return;
          await fetch(
            `/api/usg/pathology-wording?studyKey=${encodeURIComponent(studyKey)}&organKey=${encodeURIComponent(organ)}&pathologyKey=${encodeURIComponent(pk)}&kind=advice`,
            { method: "DELETE" },
          );
          const key = pathologyOverrideKey(studyKey, organ, pk);
          const nextAdv = { ...(pathologyWording?.advice ?? {}) };
          delete nextAdv[key];
          onPathologyWordingChange?.({
            impressions: { ...(pathologyWording?.impressions ?? {}) },
            advice: nextAdv,
          });
          toast.success("Advice default cleared");
        }}
      />

      {impressionManual && state.impressionOverride != null && !isFinal ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase text-amber-700">Legacy impression override</span>
            <button
              className="text-[10px] font-bold text-rose-500 underline"
              onClick={() => {
                setImpressionManual(false);
                setState((s) => ({ ...s, impressionOverride: null }));
              }}
            >
              back to auto triad
            </button>
          </div>
          <Textarea
            value={state.impressionOverride ?? ""}
            onChange={(e) => setState((s) => ({ ...s, impressionOverride: e.target.value }))}
            rows={3}
            className="resize-y text-[12px] leading-relaxed"
          />
        </div>
      ) : null}

      {declarationLine?.trim() && !isFinal ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-2.5 text-[10px] text-rose-800">
          {declarationLine}
        </div>
      ) : null}

      <div className="flex min-h-[300px] flex-1 flex-col rounded-xl border border-border bg-card p-3.5 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] font-bold tracking-wide">Live preview — {paperLabel}</span>
          {!isFinal ? <span className="text-[9px] font-bold text-rose-500">PROVISIONAL</span> : null}
        </div>
      </div>
    </>
  );
}, impressionEqual);
