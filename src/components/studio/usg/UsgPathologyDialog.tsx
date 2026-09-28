"use client";
/**
 * Add / edit a custom pathology entry (persisted to UsgPathology).
 * The finding text may contain {tokens} — each becomes a measurement input.
 * Also supports clinic-wide impression / advice snippets (sentinel organs).
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { UsgPathologyDef } from "@/lib/usg/types";
import {
  isSnippetOrgan,
  SNIPPET_ORGAN_ADVICE,
  SNIPPET_ORGAN_IMPRESSION,
} from "@/lib/usg/addendum";

export type PathologyDialogProps = {
  open: boolean;
  organKey: string;
  organLabel: string;
  editing: UsgPathologyDef | null; // custom entry being edited (has id after "custom:")
  onClose: () => void;
  onSaved: (created?: UsgPathologyDef) => void;
  /** Prefill finding/impression/advice when opening from triad "save custom". */
  seed?: { label?: string; findingText?: string; impression?: string; advice?: string };
};

export function UsgPathologyDialog({
  open,
  organKey,
  organLabel,
  editing,
  onClose,
  onSaved,
  seed,
}: PathologyDialogProps) {
  const [label, setLabel] = useState("");
  const [text, setText] = useState("");
  const [impression, setImpression] = useState("");
  const [advice, setAdvice] = useState("");
  const [titleFragment, setTitleFragment] = useState("");
  const [saving, setSaving] = useState(false);
  const snippet = isSnippetOrgan(organKey);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setLabel(editing.label ?? "");
      setText(editing.text ?? "");
      setImpression((editing.impression ?? []).join("\n"));
      setAdvice((editing.advice ?? editing.suggestions ?? []).join("\n"));
      setTitleFragment(editing.titleFragment ?? "");
      return;
    }
    setLabel(seed?.label ?? "");
    setText(seed?.findingText ?? "");
    setImpression(seed?.impression ?? "");
    setAdvice(seed?.advice ?? "");
    setTitleFragment("");
  }, [open, editing, seed]);

  const save = async () => {
    if (!label.trim()) {
      toast.error("Chip label is required");
      return;
    }
    if (!snippet && !text.trim()) {
      toast.error("Label and finding text are required");
      return;
    }
    if (organKey === SNIPPET_ORGAN_IMPRESSION && !impression.trim() && !text.trim()) {
      toast.error("Impression text is required");
      return;
    }
    if (organKey === SNIPPET_ORGAN_ADVICE && !advice.trim() && !text.trim()) {
      toast.error("Advice text is required");
      return;
    }
    setSaving(true);
    try {
      const impressionLines = impression.split(/\n+/).map((l) => l.trim()).filter(Boolean);
      const adviceLines = advice.split(/\n+/).map((l) => l.trim()).filter(Boolean);
      const findingText =
        text.trim() ||
        (organKey === SNIPPET_ORGAN_IMPRESSION
          ? impressionLines[0] ?? label.trim()
          : organKey === SNIPPET_ORGAN_ADVICE
            ? adviceLines[0] ?? label.trim()
            : "");
      if (editing && editing.key.startsWith("custom:")) {
        const res = await fetch(`/api/usg/pathologies/${editing.key.slice("custom:".length)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label,
            findingText,
            impressionLines,
            adviceLines,
            titleFragment,
          }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Save failed");
        toast.success(`Updated "${label.trim()}"`);
        onSaved();
        onClose();
      } else {
        const res = await fetch("/api/usg/pathologies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organKey,
            label,
            findingText,
            impressionLines,
            adviceLines,
            titleFragment,
          }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Save failed");
        const body = (await res.json()) as { pathology?: UsgPathologyDef };
        toast.success(`Saved "${label.trim()}" to ${organLabel}`);
        onSaved(body.pathology);
        onClose();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const tokens = Array.from(new Set(Array.from(text.matchAll(/\{([a-zA-Z0-9_]+)\}/g), (m) => m[1])));
  const title = snippet
    ? editing
      ? `Edit saved ${organKey === SNIPPET_ORGAN_ADVICE ? "advice" : "impression"}`
      : `Save custom ${organKey === SNIPPET_ORGAN_ADVICE ? "advice" : "impression"}`
    : editing
      ? "Edit custom finding"
      : `Add custom finding — ${organLabel}`;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-rose-700">{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-1.5">
            <Label htmlFor="p-label" className="text-[12px]">Chip label</Label>
            <Input
              id="p-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={
                snippet
                  ? organKey === SNIPPET_ORGAN_ADVICE
                    ? "e.g. Follow-up MRI"
                    : "e.g. Left adnexal mass — ?ectopic"
                  : "e.g. Fatty Liver — Gr III"
              }
              className="h-8 text-[13px]"
            />
          </div>
          {!snippet ? (
            <div className="grid gap-1.5">
              <Label htmlFor="p-text" className="text-[12px]">
                Finding text <span className="font-normal text-muted-foreground">(use {"{token}"} for measurements)</span>
              </Label>
              <Textarea
                id="p-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                className="text-[12px] leading-relaxed"
                placeholder="e.g. Liver measures {span} cm and shows…"
              />
              {tokens.length ? (
                <p className="text-[10px] text-muted-foreground">
                  Measurement slots: {tokens.map((t) => `{${t}}`).join(", ")}
                </p>
              ) : null}
            </div>
          ) : null}
          {organKey !== SNIPPET_ORGAN_ADVICE ? (
            <div className="grid gap-1.5">
              <Label htmlFor="p-imp" className="text-[12px]">
                Impression line(s) <span className="font-normal text-muted-foreground">(one per line)</span>
              </Label>
              <Textarea
                id="p-imp"
                value={impression}
                onChange={(e) => setImpression(e.target.value)}
                rows={snippet ? 3 : 2}
                className="text-[12px]"
                placeholder="e.g. Fatty infiltration of liver (Grade III)."
              />
            </div>
          ) : null}
          {organKey !== SNIPPET_ORGAN_IMPRESSION ? (
            <div className="grid gap-1.5">
              <Label htmlFor="p-adv" className="text-[12px]">
                Advice line(s) <span className="font-normal text-muted-foreground">(one per line)</span>
              </Label>
              <Textarea
                id="p-adv"
                value={advice}
                onChange={(e) => setAdvice(e.target.value)}
                rows={snippet ? 3 : 2}
                className="text-[12px]"
                placeholder="e.g. Suggest correlation with UPT / β-hCG."
              />
            </div>
          ) : null}
          {!snippet ? (
            <div className="grid gap-1.5">
              <Label htmlFor="p-title" className="text-[12px]">
                Title fragment <span className="font-normal text-muted-foreground">(optional — joins the report heading)</span>
              </Label>
              <Input
                id="p-title"
                value={titleFragment}
                onChange={(e) => setTitleFragment(e.target.value)}
                placeholder="e.g. grade iii fatty changes"
                className="h-8 text-[13px]"
              />
            </div>
          ) : null}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" disabled={saving} onClick={() => void save()} className="bg-rose-600 hover:bg-rose-700">
              {saving ? "Saving…" : editing ? "Update" : "Add to library"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
