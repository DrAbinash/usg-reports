"use client";
/**
 * Add / edit a custom pathology entry (persisted to UsgPathology).
 * The finding text may contain {tokens} — each becomes a measurement input.
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { UsgPathologyDef } from "@/lib/usg/types";

export type PathologyDialogProps = {
  open: boolean;
  organKey: string;
  organLabel: string;
  editing: UsgPathologyDef | null; // custom entry being edited (has id after "custom:")
  onClose: () => void;
  onSaved: () => void;
};

export function UsgPathologyDialog({ open, organKey, organLabel, editing, onClose, onSaved }: PathologyDialogProps) {
  const [label, setLabel] = useState("");
  const [text, setText] = useState("");
  const [impression, setImpression] = useState("");
  const [titleFragment, setTitleFragment] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setLabel(editing?.label ?? "");
      setText(editing?.text ?? "");
      setImpression((editing?.impression ?? []).join("\n"));
      setTitleFragment(editing?.titleFragment ?? "");
    }
  }, [open, editing]);

  const save = async () => {
    if (!label.trim() || !text.trim()) {
      toast.error("Label and finding text are required");
      return;
    }
    setSaving(true);
    try {
      const impressionLines = impression.split(/\n+/).map((l) => l.trim()).filter(Boolean);
      if (editing && editing.key.startsWith("custom:")) {
        const res = await fetch(`/api/usg/pathologies/${editing.key.slice("custom:".length)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label, findingText: text, impressionLines, titleFragment }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Save failed");
      } else {
        const res = await fetch("/api/usg/pathologies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organKey, label, findingText: text, impressionLines, titleFragment }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Save failed");
      }
      toast.success(`Saved "${label.trim()}" to ${organLabel}`);
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const tokens = Array.from(new Set(Array.from(text.matchAll(/\{([a-zA-Z0-9_]+)\}/g), (m) => m[1])));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-rose-700">
            {editing ? "Edit custom finding" : `Add custom finding — ${organLabel}`}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-1.5">
            <Label htmlFor="p-label" className="text-[12px]">Chip label</Label>
            <Input id="p-label" value={label} onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Fatty Liver — Gr III" className="h-8 text-[13px]" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-text" className="text-[12px]">
              Finding text <span className="font-normal text-muted-foreground">(use {"{token}"} for measurements)</span>
            </Label>
            <Textarea id="p-text" value={text} onChange={(e) => setText(e.target.value)} rows={5}
              className="text-[12px] leading-relaxed" placeholder="e.g. Liver measures {span} cm and shows…" />
            {tokens.length ? (
              <p className="text-[10px] text-muted-foreground">
                Measurement slots: {tokens.map((t) => `{${t}}`).join(", ")}
              </p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-imp" className="text-[12px]">
              Impression line(s) <span className="font-normal text-muted-foreground">(one per line)</span>
            </Label>
            <Textarea id="p-imp" value={impression} onChange={(e) => setImpression(e.target.value)} rows={2}
              className="text-[12px]" placeholder="e.g. Fatty infiltration of liver (Grade III)." />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-title" className="text-[12px]">
              Title fragment <span className="font-normal text-muted-foreground">(optional — joins the report heading)</span>
            </Label>
            <Input id="p-title" value={titleFragment} onChange={(e) => setTitleFragment(e.target.value)}
              placeholder="e.g. grade iii fatty changes" className="h-8 text-[13px]" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" disabled={saving} onClick={save} className="bg-rose-600 hover:bg-rose-700">
              {saving ? "Saving…" : editing ? "Update" : "Add to library"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
