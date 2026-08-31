"use client";
/**
 * Study picker — Ctrl/Cmd+K. Filterable list of all study types, grouped;
 * Enter picks the first match, Esc closes. Keyboard-first scan-room flow.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import { STUDY_GROUPS, USG_STUDIES, getStudy } from "@/lib/usg/studies";

export function UsgStudyPicker({
  open,
  currentKey,
  onPick,
  onClose,
}: {
  open: boolean;
  currentKey: string;
  onPick: (studyKey: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      // Radix unmounts the dialog content while closed, so `query` resets on
      // every open — only the focus needs handling here.
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      q
        ? USG_STUDIES.filter(
            (s) => s.label.toLowerCase().includes(q) || s.title.toLowerCase().includes(q) || s.key.includes(q),
          )
        : USG_STUDIES,
    [q],
  );

  const pick = (key: string) => {
    if (!getStudy(key)) return;
    onPick(key);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[14px]">Switch study</DialogTitle>
          <DialogDescription className="text-[11px]">
            Type to filter — Enter picks the first match. Pathologies and typed measurements carry over.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filtered.length) {
                e.preventDefault();
                pick(filtered[0].key);
              }
            }}
            placeholder="Filter studies (e.g. thyroid, ob, kub)…"
            className="h-9 border-border bg-panel pl-8 text-[13px]"
          />
        </div>
        <div className="studio-scroll max-h-80 space-y-2 overflow-y-auto">
          {STUDY_GROUPS.map((g) => {
            const studies = filtered.filter((s) => s.group === g.key);
            if (!studies.length) return null;
            return (
              <div key={g.key}>
                <p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wider text-faint">{g.label}</p>
                <div className="grid gap-1">
                  {studies.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => pick(s.key)}
                      className={cn(
                        "flex items-center justify-between rounded-lg px-3 py-2 text-left text-[12.5px] font-semibold transition-colors",
                        s.key === currentKey
                          ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                          : "bg-panel text-foreground hover:bg-rose-50 hover:text-rose-700",
                      )}
                    >
                      {s.label}
                      {s.key === currentKey ? (
                        <span className="text-[9px] font-bold uppercase tracking-wide text-rose-500">current</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {!q && USG_STUDIES.some((s) => !s.group || !STUDY_GROUPS.some((g) => g.key === s.group)) ? (
            <div>
              <p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wider text-faint">Other</p>
              <div className="grid gap-1">
                {USG_STUDIES.filter((s) => !s.group || !STUDY_GROUPS.some((g) => g.key === s.group)).map((s) => (
                  <button
                    key={s.key}
                    onClick={() => pick(s.key)}
                    className="rounded-lg bg-panel px-3 py-2 text-left text-[12.5px] font-semibold hover:bg-rose-50 hover:text-rose-700"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
