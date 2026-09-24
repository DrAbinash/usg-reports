"use client";
/**
 * Memoised single-organ wrapper — emits data-organ-idx for Space focus-scroll,
 * routes grid organs to UsgGridOrganCard and prose organs to UsgOrganCard.
 */
import { memo, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { UsgComposerState, UsgOrganDef, UsgOrganState, UsgPathologyDef } from "@/lib/usg/types";
import { pathologiesForOrgan, selectedPathologies, setOrganRows, setOrganText, setOrganVar } from "@/lib/usg/composer";
import { defaultBppRows, isGridOrgan } from "@/lib/usg/gridOrgans";
import { applyOrganQuickNormal } from "@/lib/usg/quickActions";
import { matchSnippetExact } from "@/lib/usg/textExpansion";
import { toast } from "sonner";
import { UsgOrganCard } from "../UsgOrganCard";
import { UsgGridOrganCard } from "../UsgGridOrganCard";
import { getStudy } from "@/lib/usg/studies";

/** Persist doctor normal-wording override (v5) — shared by orchestrator. */
export async function saveNormalOverride(
  studyKey: string,
  organKey: string,
  text: string,
  setState: React.Dispatch<React.SetStateAction<UsgComposerState>>,
) {
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
}

export async function resetNormalOverride(
  studyKey: string,
  organKey: string,
  setState: React.Dispatch<React.SetStateAction<UsgComposerState>>,
) {
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
}

export type ComposerOrganCardProps = {
  organIdx: number;
  focused: boolean;
  def: UsgOrganDef;
  organState: UsgOrganState;
  pathologies: UsgPathologyDef[];
  preferNoSizeChips: boolean;
  normalOverride: string | null;
  isFinal: boolean;
  onFocus: (organIdx: number) => void;
  onSaveNormal: (organKey: string, text: string) => void;
  onResetNormal: (organKey: string) => void;
  onTogglePathology: (organKey: string, key: string | null) => void;
  setState: React.Dispatch<React.SetStateAction<UsgComposerState>>;
  onAddCustom: (organKey: string) => void;
  lookupPathology: (key: string) => UsgPathologyDef | undefined;
};

function organCardEqual(a: ComposerOrganCardProps, b: ComposerOrganCardProps): boolean {
  return (
    a.organIdx === b.organIdx &&
    a.focused === b.focused &&
    a.def === b.def &&
    a.organState === b.organState &&
    a.pathologies === b.pathologies &&
    a.preferNoSizeChips === b.preferNoSizeChips &&
    a.normalOverride === b.normalOverride &&
    a.isFinal === b.isFinal &&
    a.onFocus === b.onFocus &&
    a.onSaveNormal === b.onSaveNormal &&
    a.onResetNormal === b.onResetNormal &&
    a.onTogglePathology === b.onTogglePathology &&
    a.setState === b.setState &&
    a.onAddCustom === b.onAddCustom &&
    a.lookupPathology === b.lookupPathology
  );
}

export const OrganCard = memo(function OrganCard({
  organIdx,
  focused,
  def,
  organState,
  pathologies,
  preferNoSizeChips,
  normalOverride,
  isFinal,
  onFocus,
  onSaveNormal,
  onResetNormal,
  onTogglePathology,
  setState,
  onAddCustom,
  lookupPathology,
}: ComposerOrganCardProps) {
  const onToggle = useCallback(
    (k: string | null) => onTogglePathology(def.key, k),
    [onTogglePathology, def.key],
  );
  const onQuickNormal = useCallback(() => {
    setState((s) => applyOrganQuickNormal(s, def.key, def));
  }, [setState, def]);
  const onVar = useCallback(
    (k: string, v: string) => setState((s) => setOrganVar(s, def.key, k, v)),
    [setState, def.key],
  );
  const onText = useCallback(
    (t: string) => {
      const snip = matchSnippetExact(t);
      if (snip) {
        const p = lookupPathology(snip.pathologyKey);
        if (p && (p.organ === def.key || (p.organ === "kidney" && def.key.startsWith("kidney")))) {
          onTogglePathology(def.key, snip.pathologyKey);
          toast.success(snip.confirm);
          return;
        }
      }
      setState((s) => setOrganText(s, def.key, t));
    },
    [lookupPathology, onTogglePathology, setState, def.key],
  );
  const onRows = useCallback(
    (next: UsgOrganState) => setState((s) => setOrganRows(s, def.key, next.rows)),
    [setState, def.key],
  );
  const onConvertLegacy = useCallback(() => {
    setState((s) => setOrganRows(s, def.key, defaultBppRows()));
  }, [setState, def.key]);

  return (
    <div
      data-organ-idx={organIdx}
      onClick={() => onFocus(organIdx)}
      className={cn(focused && "rounded-lg ring-2 ring-amber-200/80")}
    >
      {isGridOrgan(def) ? (
        <UsgGridOrganCard
          def={def}
          state={organState}
          readOnly={isFinal}
          onRows={onRows}
          onConvertLegacy={isFinal ? undefined : onConvertLegacy}
        />
      ) : (
        <UsgOrganCard
          def={def}
          state={organState}
          pathologies={pathologiesForOrgan(pathologies, def.key)}
          preferNoSizeChips={preferNoSizeChips}
          normalOverride={normalOverride}
          onSaveNormal={(text) => onSaveNormal(def.key, text)}
          onResetNormal={() => onResetNormal(def.key)}
          onToggle={onToggle}
          onQuickNormal={onQuickNormal}
          onVar={onVar}
          onText={onText}
          onAddCustom={onAddCustom}
        />
      )}
    </div>
  );
}, organCardEqual);
