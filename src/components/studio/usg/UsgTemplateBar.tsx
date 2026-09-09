"use client";
/**
 * UsgTemplateBar (v6.15) — Quick report templates bar.
 *
 * Shows saved report templates as chips at the top of the composer.
 * One click on a template chip:
 *   1. Switches the study to the template's studyKey
 *   2. Applies the saved composer state (organs, pathologies, vars)
 *   3. The doctor just types patient name → Save → Print
 *
 * The "Save as template" button captures the current composer state
 * (study + all organ texts + variables) into a named template.
 *
 * For emergency/crowd: the doctor saves "Normal Whole Abdomen Male" and
 * "Normal Whole Abdomen Female" once, then one-clicks them during rush.
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bookmark, Trash2, Pin, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Template = {
  id: string;
  name: string;
  studyKey: string;
  stateJson: string;
  pinned: boolean;
};

export type UsgTemplateBarProps = {
  /** Called when the doctor clicks a template chip. */
  onApply: (template: Template) => void;
  /** The current composer state JSON (to save as a template). */
  currentStateJson: string;
  /** The current study key. */
  currentStudyKey: string;
};

export function UsgTemplateBar({ onApply, currentStateJson, currentStudyKey }: UsgTemplateBarProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [name, setName] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/usg/templates");
      if (res.ok) {
        const d = (await res.json()) as { templates: Template[] };
        setTemplates(d.templates);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    if (!name.trim()) {
      toast.error("Enter a template name");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/usg/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          studyKey: currentStudyKey,
          stateJson: currentStateJson,
        }),
      });
      if (res.ok) {
        toast.success(`Template "${name.trim()}" saved`);
        setName("");
        setShowSave(false);
        await load();
      } else {
        const e = await res.json().catch(() => ({}));
        toast.error(e.error ?? `Save failed (${res.status})`);
      }
    } catch (err) {
      toast.error(`Save failed — ${(err as Error)?.message ?? "network error"}`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/usg/templates/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Template deleted");
        await load();
      }
    } catch {
      toast.error("Delete failed");
    }
  };

  const togglePin = async (id: string) => {
    try {
      await fetch(`/api/usg/templates/${id}`, { method: "PATCH" });
      await load();
    } catch {
      // silent
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1 text-[10px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading templates…
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-panel/50 px-3 py-1.5">
      <Zap className="h-3.5 w-3.5 shrink-0 text-amber-500" />
      {templates.length === 0 ? (
        <span className="text-[10px] text-faint">
          No quick templates yet — save one for emergency use
        </span>
      ) : (
        templates.map((t) => (
          <div key={t.id} className="group flex items-center gap-0.5">
            <button
              onClick={() => onApply(t)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[10px] font-bold transition-colors",
                t.pinned
                  ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                  : "border-border bg-card text-foreground hover:border-primary/40",
              )}
              title={`Apply template: ${t.name}`}
            >
              {t.name}
            </button>
            <button
              onClick={() => void togglePin(t.id)}
              className="opacity-0 transition-opacity group-hover:opacity-100"
              title={t.pinned ? "Unpin" : "Pin to top"}
            >
              <Pin className={cn("h-3 w-3", t.pinned ? "text-amber-500" : "text-faint")} />
            </button>
            <button
              onClick={() => void remove(t.id)}
              className="opacity-0 transition-opacity group-hover:opacity-100"
              title="Delete template"
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </button>
          </div>
        ))
      )}

      {showSave ? (
        <div className="flex items-center gap-1">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template name (e.g. Normal Whole Abdomen Male)"
            className="h-7 w-[220px] text-[11px]"
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
              if (e.key === "Escape") { setShowSave(false); setName(""); }
            }}
            autoFocus
          />
          <Button size="sm" className="h-7 px-2 text-[10px]" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-1 text-[10px]" onClick={() => { setShowSave(false); setName(""); }}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-[10px] text-muted-foreground hover:text-foreground"
          onClick={() => setShowSave(true)}
          title="Save the current report state as a reusable template"
        >
          <Bookmark className="mr-1 h-3 w-3" />
          Save as template
        </Button>
      )}
    </div>
  );
}
