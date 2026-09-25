"use client";
/**
 * UsgSuggestionsPanel — organ-specific deterministic suggestions.
 *
 * When a pathology is selected, shows related clinical actions as coloured
 * chips. Items already present in triad advice are hidden (one authoritative
 * advice surface). Clicking Apply writes through adviceEdits (triad ownership).
 */
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Ruler, Stethoscope, ClipboardList, GitCompare, Lightbulb,
  type LucideIcon,
} from "lucide-react";
import {
  getSuggestionsForPathologies, suggestionColour,
  type SuggestionKind, type OrganSuggestion,
} from "@/lib/usg/organSuggestions";

export type UsgSuggestionsPanelProps = {
  /** All currently selected pathology keys across all organs. */
  selectedPathologyKeys: string[];
  /** Exact triad advice strings already shown — suggestions matching these are hidden. */
  triadAdviceTexts?: string[];
  /** Apply a suggestion into triad ownership (adviceEdits). */
  onApplySuggestion?: (pathologyKey: string, text: string) => void;
};

const ICON_MAP: Record<SuggestionKind, LucideIcon> = {
  measure: Ruler,
  check: Stethoscope,
  recommend: ClipboardList,
  compare: GitCompare,
};

export function UsgSuggestionsPanel({
  selectedPathologyKeys,
  triadAdviceTexts,
  onApplySuggestion,
}: UsgSuggestionsPanelProps) {
  const suggestions = useMemo(
    () => getSuggestionsForPathologies(selectedPathologyKeys, triadAdviceTexts),
    [selectedPathologyKeys, triadAdviceTexts],
  );

  if (suggestions.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      <span className="flex items-center gap-0.5 text-[9px] font-bold uppercase text-amber-600">
        <Lightbulb className="h-3 w-3" />
        Suggested
      </span>
      {suggestions.map((s, i) => (
        <SuggestionChip
          key={`${s.pathologyKey}-${i}`}
          suggestion={s}
          onApply={onApplySuggestion}
        />
      ))}
    </div>
  );
}

function SuggestionChip({
  suggestion: s,
  onApply,
}: {
  suggestion: OrganSuggestion;
  onApply?: (pathologyKey: string, text: string) => void;
}) {
  const Icon = ICON_MAP[s.kind] ?? ClipboardList;
  const colour = suggestionColour(s.kind);
  const clickable = !!onApply && (s.kind === "recommend" || s.kind === "check" || s.kind === "compare");

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => onApply?.(s.pathologyKey, s.text)}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded border px-1.5 py-0.5 text-left text-[9px] font-medium leading-tight",
        colour,
        clickable ? "cursor-pointer hover:opacity-90" : "cursor-default",
      )}
      title={clickable ? `Apply to advice: ${s.text}` : s.text}
    >
      <Icon className="h-2.5 w-2.5 shrink-0" />
      <span className="truncate max-w-[200px]">{s.text}</span>
    </button>
  );
}
