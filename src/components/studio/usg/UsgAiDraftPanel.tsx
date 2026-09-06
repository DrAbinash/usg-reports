"use client";
/**
 * UsgAiDraftPanel (v6.10) — AI findings-draft assistant via Ollama.
 *
 * A floating button (bottom-right of the composer) that calls the local
 * Ollama server with the current report context and shows the AI's draft.
 * The radiologist can insert the draft into the impression field, or
 * dismiss it. The AI never writes directly — every insertion is a
 * doctor-confirmed action.
 *
 * Mounted in UsgComposer when the enableAiDraft toggle is on.
 */
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Sparkles, Loader2, Check, X, Edit3 } from "lucide-react";

export type UsgAiDraftPanelProps = {
  reportId: string | null;
  /** Callback when the doctor clicks "Insert impression" — receives the
   *  impression section of the draft. */
  onInsertImpression: (text: string) => void;
  /** Callback when the doctor clicks "Insert findings" — receives the
   *  findings section. */
  onInsertFindings?: (text: string) => void;
};

type DraftResult = {
  ok: boolean;
  draft?: string;
  model?: string;
  error?: string;
  ms?: number;
};

function splitDraft(draft: string): { findings: string; impression: string } {
  // The prompt asks the model to output "FINDINGS:" then "IMPRESSION:".
  // Be tolerant of variations.
  const lower = draft.toLowerCase();
  const fIdx = lower.indexOf("findings:");
  const iIdx = lower.indexOf("impression:");
  if (fIdx === -1 || iIdx === -1 || iIdx <= fIdx) {
    // Couldn't parse — put everything in findings.
    return { findings: draft.trim(), impression: "" };
  }
  const findings = draft.slice(fIdx + "findings:".length, iIdx).trim();
  const impression = draft.slice(iIdx + "impression:".length).trim();
  return { findings, impression };
}

export function UsgAiDraftPanel({ reportId, onInsertImpression, onInsertFindings }: UsgAiDraftPanelProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DraftResult | null>(null);
  const [edited, setEdited] = useState("");

  const generate = async () => {
    if (!reportId) {
      toast.error("Save the draft first — AI needs a report id");
      return;
    }
    setLoading(true);
    setResult(null);
    setEdited("");
    try {
      const res = await fetch("/api/usg/ai-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId }),
      });
      const d = (await res.json()) as DraftResult;
      if (d.ok) {
        setResult(d);
        setEdited(d.draft ?? "");
        toast.success(`Draft generated (${d.ms}ms)`);
      } else {
        toast.error(d.error ?? "AI draft failed");
        setResult(d);
      }
    } catch (err) {
      toast.error(`AI draft failed — ${(err as Error)?.message ?? "network error"}`);
    } finally {
      setLoading(false);
    }
  };

  const insertImpression = () => {
    const { impression } = splitDraft(edited);
    if (!impression) {
      toast.error("No IMPRESSION section found in the draft — edit and try again");
      return;
    }
    onInsertImpression(impression);
    toast.success("Impression inserted — review and edit");
    setOpen(false);
  };

  const insertFindings = () => {
    if (!onInsertFindings) return;
    const { findings } = splitDraft(edited);
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
      {/* Floating button */}
      <button
        onClick={() => {
          setOpen(true);
          if (!result) void generate();
        }}
        className="fixed bottom-4 right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-lg transition-transform hover:scale-105"
        title="AI Draft (Ollama) — draft findings + impression"
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
              Local Ollama generates a findings + impression draft from the current report context.
              Review, edit, then insert. The AI never writes directly — every insertion is your action.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mb-2 h-8 w-8 animate-spin text-violet-600" />
              Drafting… (Ollama, ~10–20s)
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
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Edit3 className="h-3 w-3" />
                Editable — changes here don't affect the report until you insert.
                {result.model ? <span className="ml-auto font-mono">{result.model} · {result.ms}ms</span> : null}
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
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
