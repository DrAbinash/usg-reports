"use client";
/**
 * UsgAiDraftPanel — AI full-report skeleton assistant via Ollama.
 *
 * Floating button → dialog that drafts a per-organ normal/pathology skeleton
 * from technique + indication. Doctor accepts chips individually or Apply all;
 * each accept calls togglePathology (same path as All Normal / finding chips).
 * Optional impression / advice lines insert into the triad via existing
 * callbacks. The AI never writes directly.
 *
 * Mounted when the enableAiDraft toggle is on.
 */
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Sparkles, Loader2, Check, X, Edit3 } from "lucide-react";
import type { AiDraftOrganSuggestion, AiDraftSkeleton } from "@/lib/usg/aiDraft";

export type UsgAiDraftPanelProps = {
  reportId: string | null;
  /** Optional clinical indication sent with the draft request. */
  clinicalIndication?: string;
  /** Technique paragraph (defaults to report technique on the server). */
  technique?: string;
  /** Same path as All Normal / organ chips — null clears to normal. */
  togglePathology: (organKey: string, key: string | null) => void;
  /** Skip Apply-all for organs that already have abnormals (All Normal rule). */
  organHasPathology?: (organKey: string) => boolean;
  /** Callback when the doctor inserts AI impression text into the triad. */
  onInsertImpression: (text: string) => void;
  /** Optional advice lines → triad (parent may map to addendum / edits). */
  onInsertAdvice?: (lines: string[]) => void;
  /** Legacy free-text findings insert (kept for older callers). */
  onInsertFindings?: (text: string) => void;
};

type DraftResult = {
  ok: boolean;
  draft?: string;
  skeleton?: AiDraftSkeleton;
  model?: string;
  error?: string;
  ms?: number;
};

function findingLabel(s: AiDraftOrganSuggestion): string {
  if (s.findingKey == null) return "Normal";
  return s.findingKey;
}

export function UsgAiDraftPanel({
  reportId,
  clinicalIndication: indicationProp,
  technique,
  togglePathology,
  organHasPathology,
  onInsertImpression,
  onInsertAdvice,
  onInsertFindings,
}: UsgAiDraftPanelProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DraftResult | null>(null);
  const [edited, setEdited] = useState("");
  const [indication, setIndication] = useState(indicationProp ?? "");
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});

  const skeleton = result?.ok ? result.skeleton : undefined;

  const generate = async () => {
    if (!reportId) {
      toast.error("Save the draft first — AI needs a report id");
      return;
    }
    setLoading(true);
    setResult(null);
    setEdited("");
    setAccepted({});
    try {
      const res = await fetch("/api/usg/ai-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId,
          clinicalIndication: indication.trim() || undefined,
          technique: technique?.trim() || undefined,
        }),
      });
      const d = (await res.json()) as DraftResult & { error?: string };
      if (!res.ok && !d.ok) {
        toast.error(d.error ?? "AI draft failed");
        setResult({ ok: false, error: d.error ?? `HTTP ${res.status}` });
        return;
      }
      if (d.ok) {
        setResult(d);
        setEdited(d.draft ?? "");
        const n = d.skeleton?.organs.length ?? 0;
        toast.success(n ? `Skeleton drafted — ${n} organ(s) (${d.ms}ms)` : `Draft generated (${d.ms}ms)`);
      } else {
        toast.error(d.error ?? "AI draft failed");
        setResult(d);
      }
    } catch (err) {
      toast.error(`AI draft failed — ${(err as Error)?.message ?? "network error"}`);
      setResult({ ok: false, error: (err as Error)?.message ?? "network error" });
    } finally {
      setLoading(false);
    }
  };

  const acceptOrgan = (row: AiDraftOrganSuggestion) => {
    togglePathology(row.organKey, row.findingKey);
    setAccepted((prev) => ({ ...prev, [row.organKey]: true }));
    toast.success(
      `${row.label ?? row.organKey}: ${row.findingKey == null ? "Normal" : row.findingKey}`,
    );
  };

  const applyAll = () => {
    if (!skeleton?.organs.length) {
      toast.error("No organ skeleton to apply");
      return;
    }
    let applied = 0;
    for (const row of skeleton.organs) {
      // Same rule as All Normal: never overwrite organs that already have abnormals
      // when the draft wants normal; pathology suggestions still toggle on.
      if (row.findingKey == null && organHasPathology?.(row.organKey)) continue;
      togglePathology(row.organKey, row.findingKey);
      applied += 1;
    }
    setAccepted(Object.fromEntries(skeleton.organs.map((o) => [o.organKey, true])));
    // Impression / advice fill via the triad from selected findings (All Normal path).
    // Optional AI wording stays available on the Insert buttons.
    if (applied > 0) toast.success(`Applied skeleton — ${applied} organ(s); triad updated`);
    else toast.message("Abnormals preserved — nothing left to apply");
    setOpen(false);
  };

  const insertImpression = () => {
    if (skeleton?.impression.length) {
      onInsertImpression(skeleton.impression.join("\n"));
      toast.success("Impression inserted — review and edit");
      return;
    }
    // Legacy prose fallback
    const lower = edited.toLowerCase();
    const iIdx = lower.indexOf("impression:");
    if (iIdx === -1) {
      toast.error("No impression in the draft — edit and try again");
      return;
    }
    onInsertImpression(edited.slice(iIdx + "impression:".length).trim());
    toast.success("Impression inserted — review and edit");
  };

  const insertAdvice = () => {
    if (!onInsertAdvice) return;
    if (!skeleton?.advice.length) {
      toast.error("No advice lines in the draft");
      return;
    }
    onInsertAdvice(skeleton.advice);
    toast.success("Advice inserted — review and edit");
  };

  const insertFindings = () => {
    if (!onInsertFindings) return;
    const lower = edited.toLowerCase();
    const fIdx = lower.indexOf("findings:");
    const iIdx = lower.indexOf("impression:");
    if (fIdx === -1) {
      toast.error("No FINDINGS section found in the draft");
      return;
    }
    const findings =
      iIdx > fIdx
        ? edited.slice(fIdx + "findings:".length, iIdx).trim()
        : edited.slice(fIdx + "findings:".length).trim();
    if (!findings) {
      toast.error("No FINDINGS section found in the draft");
      return;
    }
    onInsertFindings(findings);
    toast.success("Findings inserted — review and edit");
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          if (!result) void generate();
        }}
        className="fixed bottom-4 right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-lg transition-transform hover:scale-105"
        title="AI Draft (Ollama) — full-report skeleton"
        aria-label="AI Draft"
      >
        <Sparkles className="h-5 w-5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-600" />
              AI Draft Assistant
            </DialogTitle>
            <DialogDescription>
              Local Ollama drafts a per-organ normal skeleton from technique + indication.
              Accept chips or Apply all — same path as All Normal / finding chips. The AI never writes directly.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Clinical indication
            </label>
            <Input
              value={indication}
              onChange={(e) => setIndication(e.target.value)}
              placeholder="e.g. pain abdomen"
              className="h-8 text-xs"
              disabled={loading}
            />
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => void generate()} disabled={loading || !reportId}>
                {loading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
                {result ? "Re-draft" : "Draft skeleton"}
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mb-2 h-8 w-8 animate-spin text-violet-600" />
              Drafting skeleton… (Ollama, ~10–20s)
            </div>
          ) : result && !result.ok ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <p className="font-bold">AI Draft unavailable</p>
              <p className="mt-1">{result.error}</p>
              <p className="mt-2 text-[10px]">
                Set <code className="rounded bg-amber-100 px-1">OLLAMA_URL</code> env var and ensure
                <code className="rounded bg-amber-100 px-1">ollama serve</code> is running. Pull a
                model with <code className="rounded bg-amber-100 px-1">ollama pull llama3.2</code>.
              </p>
            </div>
          ) : result ? (
            <div className="space-y-3">
              {skeleton && skeleton.organs.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>Per-organ chips — accept individually or Apply all</span>
                    {result.model ? (
                      <span className="ml-auto font-mono">
                        {result.model} · {result.ms}ms
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {skeleton.organs.map((row) => {
                      const done = !!accepted[row.organKey];
                      const isNormal = row.findingKey == null;
                      return (
                        <button
                          key={row.organKey}
                          type="button"
                          onClick={() => acceptOrgan(row)}
                          className={[
                            "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors",
                            done
                              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                              : isNormal
                                ? "border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100"
                                : "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100",
                          ].join(" ")}
                          title={`Apply ${findingLabel(row)} to ${row.label ?? row.organKey}`}
                        >
                          {done ? <Check className="h-3 w-3" /> : null}
                          <span className="font-semibold">{row.label ?? row.organKey}</span>
                          <span className="opacity-70">· {findingLabel(row)}</span>
                        </button>
                      );
                    })}
                  </div>

                  {(skeleton.impression.length > 0 || skeleton.advice.length > 0) && (
                    <div className="rounded-md border border-border/60 bg-muted/30 p-2 text-[11px] leading-relaxed">
                      {skeleton.impression.length > 0 ? (
                        <div className="mb-1">
                          <span className="font-bold uppercase tracking-wide text-muted-foreground">Impression </span>
                          {skeleton.impression.join(" · ")}
                        </div>
                      ) : null}
                      {skeleton.advice.length > 0 ? (
                        <div>
                          <span className="font-bold uppercase tracking-wide text-muted-foreground">Advice </span>
                          {skeleton.advice.join(" · ")}
                        </div>
                      ) : null}
                    </div>
                  )}

                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                      <X className="mr-1 h-3.5 w-3.5" /> Dismiss
                    </Button>
                    {skeleton.advice.length && onInsertAdvice ? (
                      <Button variant="outline" size="sm" onClick={insertAdvice}>
                        <Check className="mr-1 h-3.5 w-3.5" /> Insert advice
                      </Button>
                    ) : null}
                    {skeleton.impression.length ? (
                      <Button variant="outline" size="sm" onClick={insertImpression}>
                        <Check className="mr-1 h-3.5 w-3.5" /> Insert impression
                      </Button>
                    ) : null}
                    <Button size="sm" onClick={applyAll} className="bg-violet-600 hover:bg-violet-700">
                      <Check className="mr-1 h-3.5 w-3.5" /> Apply all
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <Edit3 className="h-3 w-3" />
                    Editable — changes here don&apos;t affect the report until you insert.
                    {result.model ? (
                      <span className="ml-auto font-mono">
                        {result.model} · {result.ms}ms
                      </span>
                    ) : null}
                  </div>
                  <Textarea
                    value={edited}
                    onChange={(e) => setEdited(e.target.value)}
                    rows={14}
                    className="font-mono text-[11px] leading-relaxed"
                  />
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                      <X className="mr-1 h-3.5 w-3.5" /> Dismiss
                    </Button>
                    {onInsertFindings ? (
                      <Button variant="outline" size="sm" onClick={insertFindings}>
                        <Check className="mr-1 h-3.5 w-3.5" /> Insert findings
                      </Button>
                    ) : null}
                    <Button size="sm" onClick={insertImpression} className="bg-violet-600 hover:bg-violet-700">
                      <Check className="mr-1 h-3.5 w-3.5" /> Insert impression
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
