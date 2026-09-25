"use client";
/**
 * Triad zones — IMPRESSION + ADVICE badge rows with pencil/X ownership.
 * Replaces the legacy free-text impression textarea (legacy override still
 * renders as one editable "legacy" badge).
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Pencil, RotateCcw, X, Plus } from "lucide-react";
import type { UsgTriadLine } from "@/lib/usg/types";

type ZoneProps = {
  title: string;
  lines: UsgTriadLine[];
  disabled?: boolean;
  onDismiss: (text: string) => void;
  onEdit: (pathologyKey: string, text: string) => void;
  onResetEdit: (pathologyKey: string) => void;
  /** Clinic-wide "save as my default" — only when pathologyKey is set. */
  onSaveDefault?: (pathologyKey: string, text: string) => void;
  onResetDefault?: (pathologyKey: string) => void;
  /** Impression-only: addendum append. */
  addendum?: string;
  onAddendum?: (text: string) => void;
  emptyHint?: string;
};

function TriadBadge({
  line,
  disabled,
  onDismiss,
  onEdit,
  onResetEdit,
  onSaveDefault,
  onResetDefault,
}: {
  line: UsgTriadLine;
  disabled?: boolean;
  onDismiss: (text: string) => void;
  onEdit: (pathologyKey: string, text: string) => void;
  onResetEdit: (pathologyKey: string) => void;
  onSaveDefault?: (pathologyKey: string, text: string) => void;
  onResetDefault?: (pathologyKey: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(line.text);

  const commit = () => {
    const next = draft.trim();
    if (!next || next === line.text) {
      setEditing(false);
      setDraft(line.text);
      return;
    }
    if (line.pathologyKey) onEdit(line.pathologyKey, next);
    else if (line.legacy) onEdit("", next);
    setEditing(false);
  };

  return (
    <span
      className={cn(
        "group inline-flex max-w-full items-center gap-1 rounded-lg border px-2 py-1 text-[11px] leading-snug",
        line.legacy
          ? "border-amber-300 bg-amber-50 text-amber-900"
          : line.addendum
            ? "border-sky-200 bg-sky-50 text-sky-900"
            : line.edited
              ? "border-violet-300 bg-violet-50 text-violet-900"
              : "border-rose-200 bg-rose-50/80 text-rose-900",
      )}
    >
      {line.legacy ? (
        <span className="shrink-0 rounded bg-amber-200/80 px-1 text-[8px] font-bold uppercase tracking-wide text-amber-800">
          legacy
        </span>
      ) : null}
      {line.legacy && !disabled && !editing ? (
        <button
          type="button"
          className="shrink-0 rounded bg-amber-600 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white hover:bg-amber-700"
          title="Convert legacy override via the edit path"
          onClick={() => {
            setDraft(line.text);
            setEditing(true);
          }}
        >
          Convert
        </button>
      ) : null}
      {editing && !disabled ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              setEditing(false);
              setDraft(line.text);
            }
          }}
          onBlur={commit}
          className="min-w-[12rem] flex-1 rounded border border-violet-300 bg-white px-1.5 py-0.5 text-[11px] outline-none"
        />
      ) : (
        <span className="min-w-0 flex-1">{line.text}</span>
      )}
      {!disabled ? (
        <span className="ml-0.5 flex shrink-0 items-center gap-0.5 opacity-70 group-hover:opacity-100">
          {line.pathologyKey || line.legacy ? (
            <button
              type="button"
              className="rounded p-0.5 hover:bg-white/80"
              title="Edit wording"
              onClick={() => {
                setDraft(line.text);
                setEditing(true);
              }}
            >
              <Pencil className="h-3 w-3" />
            </button>
          ) : null}
          {line.edited && line.pathologyKey ? (
            <button
              type="button"
              className="rounded p-0.5 hover:bg-white/80"
              title="Reset to catalog wording"
              onClick={() => onResetEdit(line.pathologyKey)}
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          ) : null}
          {line.pathologyKey && onSaveDefault ? (
            <button
              type="button"
              className="rounded px-1 text-[8px] font-bold uppercase tracking-wide text-violet-700 hover:bg-white/80"
              title="Save as my clinic default"
              onClick={() => onSaveDefault(line.pathologyKey, line.text)}
            >
              save
            </button>
          ) : null}
          {line.pathologyKey && line.edited && onResetDefault ? (
            <button
              type="button"
              className="rounded px-1 text-[8px] font-bold uppercase tracking-wide text-muted-foreground hover:bg-white/80"
              title="Clear clinic default"
              onClick={() => onResetDefault(line.pathologyKey)}
            >
              clr
            </button>
          ) : null}
          <button
            type="button"
            className="rounded p-0.5 hover:bg-white/80"
            title="Dismiss this line"
            onClick={() => onDismiss(line.text)}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ) : null}
    </span>
  );
}

export function UsgTriadZones({
  impressionLines,
  adviceLines,
  disabled,
  impressionAddendum,
  onDismissImpression,
  onDismissAdvice,
  onEditImpression,
  onEditAdvice,
  onResetImpressionEdit,
  onResetAdviceEdit,
  onSaveImpressionDefault,
  onSaveAdviceDefault,
  onResetImpressionDefault,
  onResetAdviceDefault,
  onAddendum,
}: {
  impressionLines: UsgTriadLine[];
  adviceLines: UsgTriadLine[];
  disabled?: boolean;
  impressionAddendum?: string;
  onDismissImpression: (text: string) => void;
  onDismissAdvice: (text: string) => void;
  onEditImpression: (pathologyKey: string, text: string) => void;
  onEditAdvice: (pathologyKey: string, text: string) => void;
  onResetImpressionEdit: (pathologyKey: string) => void;
  onResetAdviceEdit: (pathologyKey: string) => void;
  onSaveImpressionDefault?: (pathologyKey: string, text: string) => void;
  onSaveAdviceDefault?: (pathologyKey: string, text: string) => void;
  onResetImpressionDefault?: (pathologyKey: string) => void;
  onResetAdviceDefault?: (pathologyKey: string) => void;
  onAddendum: (text: string) => void;
}) {
  const [addDraft, setAddDraft] = useState("");

  return (
    <div className="space-y-3">
      <Zone
        title="IMPRESSION"
        lines={impressionLines}
        disabled={disabled}
        onDismiss={onDismissImpression}
        onEdit={onEditImpression}
        onResetEdit={onResetImpressionEdit}
        onSaveDefault={onSaveImpressionDefault}
        onResetDefault={onResetImpressionDefault}
        addendum={impressionAddendum}
        onAddendum={
          disabled
            ? undefined
            : (text) => {
                onAddendum(text);
                setAddDraft("");
              }
        }
        emptyHint="Select a finding chip — impression lines appear here"
      />
      {!disabled ? (
        <div className="flex items-center gap-1.5 px-0.5">
          <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <Input
            value={addDraft}
            onChange={(e) => setAddDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && addDraft.trim()) {
                e.preventDefault();
                const prev = impressionAddendum?.trim() ?? "";
                onAddendum(prev ? `${prev}\n${addDraft.trim()}` : addDraft.trim());
                setAddDraft("");
              }
            }}
            placeholder="Add conclusion line…"
            className="h-7 text-[11px]"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[10px]"
            disabled={!addDraft.trim()}
            onClick={() => {
              const prev = impressionAddendum?.trim() ?? "";
              onAddendum(prev ? `${prev}\n${addDraft.trim()}` : addDraft.trim());
              setAddDraft("");
            }}
          >
            Add
          </Button>
        </div>
      ) : null}

      <Zone
        title="ADVICE / SUGGESTED NEXT STEPS"
        lines={adviceLines}
        disabled={disabled}
        onDismiss={onDismissAdvice}
        onEdit={onEditAdvice}
        onResetEdit={onResetAdviceEdit}
        onSaveDefault={onSaveAdviceDefault}
        onResetDefault={onResetAdviceDefault}
        emptyHint="Advice appears when a finding carries a follow-up line"
      />
    </div>
  );
}

function Zone({
  title,
  lines,
  disabled,
  onDismiss,
  onEdit,
  onResetEdit,
  onSaveDefault,
  onResetDefault,
  emptyHint,
}: ZoneProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] font-bold tracking-wide">{title}</span>
        {lines.length ? (
          <span className="text-[9px] font-semibold text-faint">{lines.length} line{lines.length === 1 ? "" : "s"}</span>
        ) : null}
      </div>
      {lines.length ? (
        <div className="flex flex-wrap gap-1.5">
          {lines.map((line, i) => (
            <TriadBadge
              key={`${line.pathologyKey}-${i}-${line.text.slice(0, 24)}`}
              line={line}
              disabled={disabled}
              onDismiss={onDismiss}
              onEdit={onEdit}
              onResetEdit={onResetEdit}
              onSaveDefault={onSaveDefault}
              onResetDefault={onResetDefault}
            />
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">{emptyHint}</p>
      )}
    </div>
  );
}
