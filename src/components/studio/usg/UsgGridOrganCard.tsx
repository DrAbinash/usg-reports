"use client";
/**
 * Grid organ card — BPP score (and future follicular / fibroid tables).
 * Enter advances to the next score cell. Totals are DERIVED, never stored.
 */
import { useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import type { UsgOrganDef, UsgOrganState } from "@/lib/usg/types";
import {
  defaultBppRows,
  deriveGridScoreTotal,
  isLegacyGridState,
  setGridCell,
} from "@/lib/usg/gridOrgans";

export type GridOrganCardProps = {
  def: UsgOrganDef;
  state: UsgOrganState;
  readOnly?: boolean;
  onRows: (next: UsgOrganState) => void;
  /** Convert legacy prose → structured default rows (draft edit only). */
  onConvertLegacy?: () => void;
};

export function UsgGridOrganCard({
  def,
  state,
  readOnly = false,
  onRows,
  onConvertLegacy,
}: GridOrganCardProps) {
  const schema = def.grid;
  const scoreRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const legacy = isLegacyGridState(def, state);
  const rows = state.rows ?? [];
  const scoreKey = schema?.scoreTotal?.columnKey ?? "score";
  const total = useMemo(
    () => (schema?.scoreTotal ? deriveGridScoreTotal(rows, scoreKey) : null),
    [rows, schema, scoreKey],
  );

  if (!schema) return null;

  if (legacy) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="text-[11px] font-bold uppercase tracking-wide text-amber-800">
            {def.label}
          </div>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
            legacy finding
          </span>
        </div>
        <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-foreground/80">{state.text}</p>
        {!readOnly && onConvertLegacy ? (
          <button
            type="button"
            onClick={onConvertLegacy}
            className="mt-2 text-[11px] font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-700"
          >
            Convert to score grid
          </button>
        ) : null}
      </div>
    );
  }

  const setScore = (rowId: string, value: string, rowIndex: number) => {
    if (readOnly) return;
    const base = rows.length ? state : { ...state, rows: defaultBppRows() };
    const next = setGridCell(base, rowId, scoreKey, value);
    onRows(next);
    // Advance focus to next score control
    const nextIdx = rowIndex + 1;
    queueMicrotask(() => scoreRefs.current[nextIdx]?.focus());
  };

  const onScoreKeyDown = (e: React.KeyboardEvent, rowIndex: number) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const nextIdx = rowIndex + 1;
    if (nextIdx < rows.length) scoreRefs.current[nextIdx]?.focus();
  };

  return (
    <div className="flex overflow-hidden rounded-md border border-sky-200/80 bg-white">
      <div
        className="flex w-7 shrink-0 flex-col items-center justify-center self-stretch bg-slate-950 px-0.5 py-1"
        title={def.label}
      >
        <span
          className="max-h-full text-[10px] font-extrabold uppercase tracking-[0.14em] text-white"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          {def.label}
        </span>
      </div>
      <div className="min-w-0 flex-1 p-1.5">
      <div className="mb-1 flex items-baseline justify-end gap-2">
        {total != null && schema.scoreTotal ? (
          <div className="text-[13px] font-extrabold text-sky-800">
            {total}/{schema.scoreTotal.max}
          </div>
        ) : null}
      </div>

      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-sky-100 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
            <th className="py-1.5 pr-2 font-semibold">Variable</th>
            <th className="w-24 py-1.5 text-center font-semibold">Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const fixed = schema.fixedRows?.find((f) => f.id === row.id);
            const score = row.cells[scoreKey] ?? "";
            const tip = score === "0" ? fixed?.abnormalDesc : fixed?.normalDesc;
            return (
              <tr key={row.id} className="border-b border-sky-50 last:border-0">
                <td className="py-2 pr-2 align-top">
                  <div className="font-semibold text-foreground">{row.cells.variable || fixed?.label || row.id}</div>
                  {tip ? (
                    <div className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{tip}</div>
                  ) : null}
                </td>
                <td className="py-2 align-middle">
                  <div className="flex justify-center gap-1" onKeyDown={(e) => onScoreKeyDown(e, idx)}>
                    {(["2", "0"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        ref={(el) => {
                          if (v === "2") scoreRefs.current[idx] = el;
                        }}
                        disabled={readOnly}
                        onClick={() => setScore(row.id, v, idx)}
                        className={cn(
                          "h-8 w-10 rounded-md border text-[13px] font-bold transition-colors",
                          score === v
                            ? v === "2"
                              ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                              : "border-rose-500 bg-rose-50 text-rose-800"
                            : "border-border bg-panel text-muted-foreground hover:bg-sky-50",
                          readOnly && "cursor-default opacity-80",
                        )}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        {total != null && schema.scoreTotal ? (
          <tfoot>
            <tr className="border-t-2 border-sky-200">
              <td className="py-2 pr-2 text-[12px] font-extrabold uppercase tracking-wide">Total</td>
              <td className="py-2 text-center text-[14px] font-extrabold text-sky-900">
                {total}/{schema.scoreTotal.max}
              </td>
            </tr>
          </tfoot>
        ) : null}
      </table>
      </div>
    </div>
  );
}
