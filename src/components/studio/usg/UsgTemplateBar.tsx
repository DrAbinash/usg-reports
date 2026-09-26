"use client";
/**
 * UsgTemplateBar (v6.15) — Quick report templates bar.
 * Compact single-row horizontal scroller so templates never steal vertical space.
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
  onApply: (template: Template) => void;
  currentStateJson: string;
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
      <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Templates…
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-bold text-amber-800">
        <Zap className="h-3 w-3 text-amber-500" />
        Templates
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap pb-0.5 [scrollbar-width:thin]">
        {templates.length === 0 ? (
          <span className="text-[11px] font-medium text-amber-900/65">None saved yet</span>
        ) : (
          templates.map((t) => (
            <div key={t.id} className="group flex shrink-0 items-center gap-0.5">
              <button
                onClick={() => onApply(t)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11px] font-bold transition-colors",
                  t.pinned
                    ? "border-amber-400 bg-amber-100 text-amber-950 hover:bg-amber-200"
                    : "border-slate-300 bg-white text-slate-900 hover:border-emerald-400 hover:bg-emerald-50",
                )}
                title={`Apply template: ${t.name}`}
              >
                {t.name}
              </button>
              <button
                onClick={() => void togglePin(t.id)}
                className="rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                title={t.pinned ? "Unpin" : "Pin to top"}
              >
                <Pin className={cn("h-3 w-3", t.pinned ? "text-amber-600" : "text-slate-400")} />
              </button>
              <button
                onClick={() => void remove(t.id)}
                className="rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                title="Delete template"
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </button>
            </div>
          ))
        )}
      </div>

      {showSave ? (
        <div className="flex shrink-0 items-center gap-1">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template name"
            className="h-7 w-[180px] text-[11px] font-medium"
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
              if (e.key === "Escape") {
                setShowSave(false);
                setName("");
              }
            }}
            autoFocus
          />
          <Button size="sm" className="h-7 px-2 text-[11px] font-bold" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-1.5 text-[11px] font-semibold"
            onClick={() => {
              setShowSave(false);
              setName("");
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 shrink-0 px-2 text-[11px] font-bold text-amber-900 hover:bg-amber-100"
          onClick={() => setShowSave(true)}
          title="Save the current report state as a reusable template"
        >
          <Bookmark className="mr-1 h-3 w-3" />
          Save
        </Button>
      )}
    </div>
  );
}
