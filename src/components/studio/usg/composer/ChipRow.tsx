"use client";
/**
 * Pathology chip row — Normal / Normal·no-size / library chips / +custom.
 * Extracted verbatim from UsgOrganCard for memoised organ rendering.
 */
import { memo } from "react";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import type { UsgOrganDef, UsgPathologyDef } from "@/lib/usg/types";

export type ChipRowProps = {
  def: UsgOrganDef;
  selectedKeys: string[];
  anySelected: boolean;
  custom: boolean;
  usingQuickNormal: boolean;
  showQuickNormal: boolean;
  visible: UsgPathologyDef[];
  pathologiesCount: number;
  showAll: boolean;
  isKidneySlot: boolean;
  onToggle: (pathologyKey: string | null) => void;
  onQuickNormal?: () => void;
  onAddCustom: (organKey: string, after?: string) => void;
  onShowAll: () => void;
  onBeforeChip: () => void;
};

function chipRowEqual(a: ChipRowProps, b: ChipRowProps): boolean {
  return (
    a.def === b.def &&
    a.anySelected === b.anySelected &&
    a.custom === b.custom &&
    a.usingQuickNormal === b.usingQuickNormal &&
    a.showQuickNormal === b.showQuickNormal &&
    a.showAll === b.showAll &&
    a.isKidneySlot === b.isKidneySlot &&
    a.pathologiesCount === b.pathologiesCount &&
    a.onToggle === b.onToggle &&
    a.onQuickNormal === b.onQuickNormal &&
    a.onAddCustom === b.onAddCustom &&
    a.onShowAll === b.onShowAll &&
    a.onBeforeChip === b.onBeforeChip &&
    a.visible === b.visible &&
    a.selectedKeys === b.selectedKeys
  );
}

export const ChipRow = memo(function ChipRow({
  def,
  selectedKeys,
  anySelected,
  custom,
  usingQuickNormal,
  showQuickNormal,
  visible,
  pathologiesCount,
  showAll,
  isKidneySlot,
  onToggle,
  onQuickNormal,
  onAddCustom,
  onShowAll,
  onBeforeChip,
}: ChipRowProps) {
  return (
    <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
      <button
        onClick={() => {
          onBeforeChip();
          onToggle(null);
        }}
        className={cn(
          "rounded-full border px-3.5 py-1.5 text-[12px] font-bold transition-colors shadow-sm",
          !anySelected && !custom && !usingQuickNormal
            ? "border-emerald-500 bg-emerald-500 text-white ring-2 ring-emerald-200"
            : "border-emerald-300 bg-emerald-50 text-emerald-800 hover:border-emerald-400 hover:bg-emerald-100",
        )}
        title={def.vars?.length ? "Normal with measurement slots" : "Normal"}
      >
        Normal
      </button>
      {showQuickNormal ? (
        <button
          onClick={() => {
            onBeforeChip();
            onQuickNormal?.();
          }}
          className={cn(
            "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
            usingQuickNormal
              ? "border-amber-300 bg-amber-50 text-amber-800"
              : "border-dashed border-amber-200 bg-amber-50/40 text-amber-700 hover:border-amber-300 hover:bg-amber-50",
          )}
          title="Peak-time normal — qualitative wording, no size measurements (e.g. liver without MCL span)"
        >
          Normal · no size
        </button>
      ) : null}
      {visible.map((p) => {
        const on = selectedKeys.includes(p.key);
        return (
          <button
            key={p.key}
            onClick={() => {
              onBeforeChip();
              onToggle(p.key);
            }}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
              on
                ? "border-rose-300 bg-rose-50 text-rose-700"
                : "border-border bg-muted/40 text-muted-foreground hover:border-rose-200 hover:text-rose-700",
              !p.builtin ? "italic" : "",
            )}
            title={p.builtin ? (on ? "Selected — click to remove" : "Click to add (combine with others)") : `Custom entry${on ? " — click to remove" : ""}`}
          >
            {p.label}
          </button>
        );
      })}
      {pathologiesCount > 6 && !showAll ? (
        <button
          onClick={onShowAll}
          className="rounded-full border border-dashed border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
        >
          +{pathologiesCount - 6} more
        </button>
      ) : null}
      <button
        onClick={() => onAddCustom(def.key)}
        className="flex items-center gap-0.5 rounded-full border border-dashed border-rose-200 px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50"
        title={`Add a custom ${def.label} finding${isKidneySlot ? " (applies to both kidneys)" : ""}`}
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}, chipRowEqual);
