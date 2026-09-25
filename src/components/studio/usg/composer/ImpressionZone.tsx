"use client";
/**
 * Impression / advice triad zone + BI-RADS, copy-findings, legacy override,
 * declaration line. Callbacks stay behaviour-identical to the prior inline wiring.
 */
import { memo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import type { UsgComposerState, UsgResolved, UsgTriadLine } from "@/lib/usg/types";
import { selectedPathologies } from "@/lib/usg/composer";
import { pathologyOverrideKey, type PathologyWordingOverrides } from "@/lib/usg/triad";
import { copyForwardFindings } from "@/lib/usg/quickActions";
import { biradsImpressionLine, biradsFollowUpDays, type BiradsCategory } from "@/lib/usg/birads";
import { composeImpression } from "@/lib/usg/autoCompose";
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
  patientAge?: string;
  patientSex?: string;
  lmp?: string;
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
    a.savedId === b.savedId &&
    a.patientAge === b.patientAge &&
    a.patientSex === b.patientSex &&
    a.lmp === b.lmp
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
  patientAge,
  patientSex,
  lmp,
}: ImpressionZoneProps) {
  const queryClient = useQueryClient();
  const [confirmAutoFill, setConfirmAutoFill] = useState(false);

  const saveWordingMut = useMutation({
    mutationFn: async (body: {
      studyKey: string;
      organKey: string;
      pathologyKey: string;
      kind: "impression" | "advice";
      text: string;
    }) => {
      const res = await fetch("/api/usg/pathology-wording", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(body.kind);
      return body;
    },
    onSuccess: (body) => {
      const key = pathologyOverrideKey(body.studyKey, body.organKey, body.pathologyKey);
      if (body.kind === "impression") {
        onPathologyWordingChange?.({
          impressions: { ...(pathologyWording?.impressions ?? {}), [key]: body.text },
          advice: { ...(pathologyWording?.advice ?? {}) },
        });
        toast.success("Impression wording saved as clinic default");
      } else {
        onPathologyWordingChange?.({
          impressions: { ...(pathologyWording?.impressions ?? {}) },
          advice: { ...(pathologyWording?.advice ?? {}), [key]: body.text },
        });
        toast.success("Advice wording saved as clinic default");
      }
      void queryClient.invalidateQueries({ queryKey: ["usg", "pathology-wording"] });
    },
    onError: (_e, body) =>
      toast.error(body.kind === "impression" ? "Could not save impression default" : "Could not save advice default"),
  });

  const resetWordingMut = useMutation({
    mutationFn: async (body: {
      studyKey: string;
      organKey: string;
      pathologyKey: string;
      kind: "impression" | "advice";
    }) => {
      await fetch(
        `/api/usg/pathology-wording?studyKey=${encodeURIComponent(body.studyKey)}&organKey=${encodeURIComponent(body.organKey)}&pathologyKey=${encodeURIComponent(body.pathologyKey)}&kind=${body.kind}`,
        { method: "DELETE" },
      );
      return body;
    },
    onSuccess: (body) => {
      const key = pathologyOverrideKey(body.studyKey, body.organKey, body.pathologyKey);
      if (body.kind === "impression") {
        const nextImp = { ...(pathologyWording?.impressions ?? {}) };
        delete nextImp[key];
        onPathologyWordingChange?.({
          impressions: nextImp,
          advice: { ...(pathologyWording?.advice ?? {}) },
        });
        toast.success("Impression default cleared");
      } else {
        const nextAdv = { ...(pathologyWording?.advice ?? {}) };
        delete nextAdv[key];
        onPathologyWordingChange?.({
          impressions: { ...(pathologyWording?.impressions ?? {}) },
          advice: nextAdv,
        });
        toast.success("Advice default cleared");
      }
      void queryClient.invalidateQueries({ queryKey: ["usg", "pathology-wording"] });
    },
  });

  const followUpMut = useMutation({
    mutationFn: async (payload: { savedId: string; followUpDate: string; followUpNote: string; label: string }) => {
      const res = await fetch(`/api/usg/reports/${payload.savedId}/follow-up`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          followUpDate: payload.followUpDate,
          followUpNote: payload.followUpNote,
        }),
      });
      if (!res.ok) throw new Error("follow-up");
      return payload.label;
    },
    onSuccess: (label) => toast.success(`BI-RADS 3 follow-up set for ${label}`),
  });

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

  const impressionHasText =
    !!(state.impressionOverride?.trim()) ||
    impressionLines.some((l) => l.text.trim()) ||
    !!(state.impressionAddendum?.trim());

  const runAutoFill = () => {
    const selectedChips: { organKey: string; chipKey: string }[] = [];
    for (const o of state.organs) {
      for (const chipKey of selectedPathologies(o)) {
        selectedChips.push({ organKey: o.organ, chipKey });
      }
    }
    const bio = state.organs.find((o) => o.organ === "biometry");
    const num = (v: string | undefined) => {
      if (!v?.trim()) return undefined;
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    };
    const ageN = patientAge?.trim() ? Number(patientAge) : undefined;
    const result = composeImpression({
      selectedChips,
      patient: {
        age: Number.isFinite(ageN) ? ageN : undefined,
        sex: patientSex === "M" || patientSex === "F" ? patientSex : undefined,
        lmp: lmp?.trim() || undefined,
      },
      studyKey,
      biometry: bio
        ? {
            bpd: num(bio.vars.bpd),
            hc: num(bio.vars.hc),
            ac: num(bio.vars.ac),
            fl: num(bio.vars.fl),
          }
        : undefined,
    });
    const text = result.lines.join("\n");
    if (!text.trim()) {
      toast.message("Nothing to auto-fill — select chips or use a known study");
      return;
    }
    setImpressionManual(true);
    setState((s) => ({ ...s, impressionOverride: text }));
    if (result.criticalFirst.length) {
      toast.warning("Critical finding in impression — log the referring-doctor call before finalize", {
        duration: 8000,
      });
    } else {
      toast.success("Impression auto-filled — review and edit before finalize");
    }
  };

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
              void followUpMut.mutateAsync({
                savedId,
                followUpDate: d.toISOString().slice(0, 10),
                followUpNote: `BI-RADS 3 — short-interval follow-up (${Math.round(followDays / 30)} months)`,
                label: d.toLocaleDateString("en-IN"),
              }).catch(() => {});
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

      {!isFinal ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 border-sky-200 bg-sky-50/70 px-2.5 text-[10px] font-semibold text-sky-800 hover:bg-sky-100"
            title="Compose impression from selected chips + OB data (deterministic)"
            onClick={() => {
              if (impressionHasText) setConfirmAutoFill(true);
              else runAutoFill();
            }}
          >
            <Sparkles className="mr-1 h-3 w-3" />
            Auto-fill Impression
          </Button>
        </div>
      ) : null}

      <AlertDialog open={confirmAutoFill} onOpenChange={setConfirmAutoFill}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace existing impression?</AlertDialogTitle>
            <AlertDialogDescription>
              Auto-fill will overwrite the current impression text with a deterministic draft from
              selected chips. You can still edit before finalize.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmAutoFill(false);
                runAutoFill();
              }}
            >
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
          await saveWordingMut.mutateAsync({
            studyKey,
            organKey: organ,
            pathologyKey: pk,
            kind: "impression",
            text,
          });
        }}
        onSaveAdviceDefault={async (pk, text) => {
          const organ = state.organs.find((o) => selectedPathologies(o).includes(pk))?.organ;
          if (!organ) return;
          await saveWordingMut.mutateAsync({
            studyKey,
            organKey: organ,
            pathologyKey: pk,
            kind: "advice",
            text,
          });
        }}
        onResetImpressionDefault={async (pk) => {
          const organ = state.organs.find((o) => selectedPathologies(o).includes(pk))?.organ;
          if (!organ) return;
          await resetWordingMut.mutateAsync({
            studyKey,
            organKey: organ,
            pathologyKey: pk,
            kind: "impression",
          });
        }}
        onResetAdviceDefault={async (pk) => {
          const organ = state.organs.find((o) => selectedPathologies(o).includes(pk))?.organ;
          if (!organ) return;
          await resetWordingMut.mutateAsync({
            studyKey,
            organKey: organ,
            pathologyKey: pk,
            kind: "advice",
          });
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
