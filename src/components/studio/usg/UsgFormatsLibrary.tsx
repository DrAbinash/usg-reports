"use client";

/**
 * USG Formats Library — browses the SAME hydrated reportFormats collection
 * as the toolbar NP chips (`useReportFormats` → GET /api/usg/templates).
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import type { UsgComposerState } from "@/lib/usg/types";
import { useReportFormats, type HydratedReportFormat } from "@/hooks/useReportFormats";
import { filterFormatsByQuery, groupFormatsByCategory } from "@/lib/usg/formatSearch";

export function UsgFormatsLibrary({
  onApply,
}: {
  /** @deprecated organ-text apply path removed — templates apply full stateJson. */
  organs?: unknown;
  onApply: (state: UsgComposerState, studyKey: string, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { formats, isLoading, isPending, refetch } = useReportFormats();

  const filtered = useMemo(
    () => filterFormatsByQuery(formats, search),
    [formats, search],
  );

  const grouped = useMemo(() => groupFormatsByCategory(filtered), [filtered]);
  const emptyQuery = !search.trim();

  const apply = (f: HydratedReportFormat) => {
    try {
      const state = JSON.parse(f.stateJson) as UsgComposerState;
      onApply(state, f.studyKey, f.name);
      setOpen(false);
    } catch {
      toast.error("Could not apply format — corrupted state");
    }
  };

  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
          void refetch();
        }}
        variant="outline"
        size="sm"
        className="h-7 shrink-0 border-slate-400 bg-white px-2 text-[11.5px] font-bold text-slate-950 shadow-sm hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-950"
      >
        <BookOpen className="mr-1 h-3.5 w-3.5" />
        Formats
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-card shadow-2xl">
            <div className="border-b border-border p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-lg font-bold">USG Formats Library</h2>
                <Button onClick={() => setOpen(false)} variant="ghost" size="sm">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Input
                placeholder="Search formats (e.g. abdomen, cardiac, whole)…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 text-[13px]"
                autoFocus
              />
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {isPending || (isLoading && formats.length === 0) ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading formats…
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No formats match.</div>
              ) : emptyQuery ? (
                <div className="space-y-5">
                  {grouped.map((g) => (
                    <div key={g.category}>
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {g.category}
                      </div>
                      <div className="space-y-2">
                        {g.formats.map((f) => (
                          <FormatCard key={f.id} name={f.name} studyKey={f.studyKey} studyType={f.studyType} onClick={() => apply(f)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map((f) => (
                    <FormatCard key={f.id} name={f.name} studyKey={f.studyKey} studyType={f.studyType} onClick={() => apply(f)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FormatCard({
  name,
  studyKey,
  studyType,
  onClick,
}: {
  name: string;
  studyKey: string;
  studyType: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-md border border-border bg-panel p-3 text-left transition-colors hover:bg-accent"
    >
      <div className="mb-0.5 text-[13px] font-semibold">{name}</div>
      <div className="text-[11px] text-muted-foreground">
        {studyType} · {studyKey}
      </div>
    </button>
  );
}
