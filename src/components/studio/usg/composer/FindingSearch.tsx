"use client";
/**
 * "Find a finding" — the composer's search box for pathology chips.
 *
 * Sits above the organ cards. Type a few letters, press Enter, and the chip is
 * toggled on the organ it belongs to; the box stays open so the next finding can
 * be typed straight away. Results are scoped to the organs this study has, so
 * pressing one always does something.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import type { UsgPathologyDef } from "@/lib/usg/types";
import { searchChips, type ChipSearchOrgan } from "@/lib/usg/chipSearch";

export type FindingSearchProps = {
  pathologies: UsgPathologyDef[];
  organs: ChipSearchOrgan[];
  /** Catalog chip order for this study — the tie-break between equal matches. */
  order?: string[];
  /** Keys selected anywhere in the report, so a result can say it is already on. */
  selectedKeys: string[];
  /** The card the doctor is writing on — a chip shared by two kidneys lands here. */
  preferredOrganKey?: string;
  onApply: (organKey: string, pathologyKey: string) => void;
};

export function FindingSearch({ pathologies, organs, order, selectedKeys, preferredOrganKey, onApply }: FindingSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const hits = useMemo(
    () => searchChips(query, pathologies, organs, { order, preferredOrganKey }),
    [query, pathologies, organs, order, preferredOrganKey],
  );

  useEffect(() => setActive(0), [query]);

  // "/" focuses the box the same way it does in the register — but never while
  // the doctor is typing somewhere, including in this box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      inputRef.current?.focus();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const apply = (i: number) => {
    const hit = hits[i];
    if (!hit) return;
    onApply(hit.organKey, hit.pathology.key);
    // Empty the box but keep the focus: a report takes several findings in a row.
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  };

  const shown = open ? hits.slice(0, 8) : [];

  return (
    <div ref={boxRef} className="relative" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, Math.max(shown.length - 1, 0)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            apply(active);
          } else if (e.key === "Escape") {
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
        placeholder="Find a finding — fatty gr ii, gall stone, calclus…  ( / )"
        aria-label="Search the findings of this study"
        className="h-8 w-full rounded-lg border border-border bg-panel pl-8 pr-2 text-[12px] font-medium outline-none placeholder:text-faint focus:border-rose-300"
      />
      {shown.length > 0 ? (
        <ul
          role="listbox"
          aria-label="Findings matching this search"
          className="absolute left-0 right-0 top-9 z-30 max-h-72 overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-lg"
        >
          {shown.map((h, i) => (
            <li key={`${h.organKey}-${h.pathology.key}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => apply(i)}
                className={cn(
                  "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11.5px]",
                  i === active ? "bg-rose-50" : "hover:bg-muted/50",
                )}
              >
                <span className="w-24 shrink-0 truncate text-[10px] font-bold uppercase tracking-wide text-faint">
                  {h.organLabel}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold text-foreground">{h.pathology.label}</span>
                {selectedKeys.includes(h.pathology.key) ? (
                  <span className="shrink-0 rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold text-rose-800">ON</span>
                ) : null}
                <span className="shrink-0 text-[9px] text-faint">{h.score === 3 ? "words" : h.score === 2 ? "inside" : "letters"}</span>
              </button>
            </li>
          ))}
          <li className="px-2.5 pt-1 text-[9.5px] text-faint">
            Enter adds it to {hits[active]?.organLabel ?? "the organ"} · ↑↓ to choose · Esc closes
          </li>
        </ul>
      ) : null}
    </div>
  );
}
