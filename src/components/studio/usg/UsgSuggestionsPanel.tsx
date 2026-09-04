"use client";
/**
 * UsgSuggestionsPanel — organ-specific deterministic suggestions.
 *
 * When a pathology is selected, shows related clinical actions
 * (measure, check, recommend, compare) as coloured chips below the
 * pathology selector. No AI — purely deterministic from a lookup table.
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
};

const ICON_MAP: Record<SuggestionKind, LucideIcon> = {
  measure: Ruler,
  check: Stethoscope,
  recommend: ClipboardList,
  compare: GitCompare,
};

export function UsgSuggestionsPanel({ selectedPathologyKeys }: UsgSuggestionsPanelProps) {
  const suggestions = useMemo(
    () => getSuggestionsForPathologies(selectedPathologyKeys),
    [selectedPathologyKeys],
  );

  if (suggestions.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      <span className="flex items-center gap-0.5 text-[9px] font-bold uppercase text-amber-600">
        <Lightbulb className="h-3 w-3" />
        Suggested
      </span>
      {suggestions.map((s, i) => (
        <SuggestionChip key={`${s.pathologyKey}-${i}`} suggestion={s} />
      ))}
    </div>
  );
}

function SuggestionChip({ suggestion: s }: { suggestion: OrganSuggestion }) {
  const Icon = ICON_MAP[s.kind] ?? ClipboardList;
  const colour = suggestionColour(s.kind);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-medium leading-tight",
        colour,
      )}
      title={s.text}
    >
      <Icon className="h-2.5 w-2.5 shrink-0" />
      <span className="truncate max-w-[200px]">{s.text}</span>
    </span>
  );
}
