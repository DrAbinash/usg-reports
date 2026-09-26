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
    <div className="mb-2.5 flex flex-wrap items-center gap-2">
      <button
        onClick={() => {
          onBeforeChip();
          onToggle(null);
        }}
        className={cn(
          "rounded-full border-2 px-4 py-1.5 text-[13px] font-bold transition-colors shadow-sm",
          !anySelected && !custom && !usingQuickNormal
            ? "border-emerald-600 bg-emerald-600 text-white ring-2 ring-emerald-200"
            : "border-emerald-400 bg-emerald-50 text-emerald-900 hover:border-emerald-500 hover:bg-emerald-100",
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
            "rounded-full border-2 px-3.5 py-1.5 text-[12px] font-bold transition-colors shadow-sm",
            usingQuickNormal
              ? "border-amber-500 bg-amber-100 text-amber-950 ring-2 ring-amber-200"
              : "border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-400 hover:bg-amber-100",
          )}
          title="Peak-time normal — qualitative wording, no size measurements (e.g. liver without MCL span)"
        >
          Normal (no size)
        </button>
      ) : null}
      {visible.map((p, i) => {
        const on = selectedKeys.includes(p.key);
        const hotkey = i < 9 ? i + 1 : null;
        return (
          <button
            key={p.key}
            onClick={() => {
              onBeforeChip();
              onToggle(p.key);
            }}
            className={cn(
              "relative rounded-full border-2 px-3 py-1.5 text-[12px] font-bold transition-colors shadow-sm",
              on
                ? "border-rose-500 bg-rose-100 text-rose-900 ring-2 ring-rose-200"
                : "border-slate-300 bg-white text-slate-800 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-800",
              !p.builtin ? "italic" : "",
            )}
            title={
              p.builtin
                ? on
                  ? "Selected — click to remove"
                  : hotkey
                    ? `Click to add (hotkey ${hotkey})`
                    : "Click to add (combine with others)"
                : `Custom entry${on ? " — click to remove" : ""}`
            }
          >
            {hotkey ? (
              <span className="mr-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded bg-black/10 px-0.5 font-mono text-[10px] font-bold tabular-nums opacity-80">
                {hotkey}
              </span>
            ) : null}
            {p.label}
          </button>
        );
      })}
      {pathologiesCount > 6 && !showAll ? (
        <button
          onClick={onShowAll}
          className="rounded-full border-2 border-dashed border-slate-300 px-3 py-1.5 text-[12px] font-bold text-slate-700 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900"
        >
          +{pathologiesCount - 6} more
        </button>
      ) : null}
      <button
        onClick={() => onAddCustom(def.key)}
        className="flex items-center gap-0.5 rounded-full border-2 border-dashed border-rose-300 px-2.5 py-1.5 text-[12px] font-bold text-rose-700 hover:bg-rose-50"
        title={`Add a custom ${def.label} finding${isKidneySlot ? " (applies to both kidneys)" : ""}`}
      >
        <Plus className="h-3.5 w-3.5" />
        <span>Custom</span>
      </button>
    </div>
  );
}, chipRowEqual);
