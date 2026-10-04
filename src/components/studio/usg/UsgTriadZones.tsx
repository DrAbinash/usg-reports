"use client";
/**
 * Triad zones — IMPRESSION + ADVICE badge rows with pencil/X ownership.
 * Free-text add lines for both; clinic snippet chips (+ Custom) for reuse.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Pencil, RotateCcw, X, Plus } from "lucide-react";
import type { UsgPathologyDef, UsgTriadLine } from "@/lib/usg/types";

type ZoneProps = {
  title: string;
  lines: UsgTriadLine[];
  disabled?: boolean;
  onDismiss: (text: string) => void;
  onEdit: (pathologyKey: string, text: string) => void;
  onResetEdit: (pathologyKey: string) => void;
  onSaveDefault?: (pathologyKey: string, text: string) => void;
  onResetDefault?: (pathologyKey: string) => void;
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
    if (line.addendum) onEdit(`__addendum__:${line.text}`, next);
    else if (line.pathologyKey) onEdit(line.pathologyKey, next);
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
        <span className="shrink-0 rounded bg-amber-200/80 px-1 text-[9px] font-bold uppercase tracking-wide text-amber-800">
          legacy
        </span>
      ) : null}
      {line.addendum ? (
        <span className="shrink-0 rounded bg-sky-200/80 px-1 text-[9px] font-bold uppercase tracking-wide text-sky-800">
          manual
        </span>
      ) : null}
      {line.legacy && !disabled && !editing ? (
        <button
          type="button"
          className="shrink-0 rounded bg-amber-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white hover:bg-amber-700"
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
          {line.pathologyKey || line.legacy || line.addendum ? (
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
              className="rounded px-1 text-[9px] font-bold uppercase tracking-wide text-violet-700 hover:bg-white/80"
              title="Save as my clinic default"
              onClick={() => onSaveDefault(line.pathologyKey, line.text)}
            >
              save
            </button>
          ) : null}
          {line.pathologyKey && line.edited && onResetDefault ? (
            <button
              type="button"
              className="rounded px-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground hover:bg-white/80"
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

function AddLineRow({
  value,
  onChange,
  onAdd,
  onSaveCustom,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  onSaveCustom?: () => void;
  placeholder: string;
  disabled?: boolean;
}) {
  if (disabled) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-0.5">
      <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) {
            e.preventDefault();
            onAdd();
          }
        }}
        placeholder={placeholder}
        className="h-7 min-w-[12rem] flex-1 text-[11px]"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 px-2 text-[10px] font-semibold"
        disabled={!value.trim()}
        onClick={onAdd}
      >
        Add
      </Button>
      {onSaveCustom ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-[10px] font-bold text-rose-700 hover:bg-rose-50"
          disabled={!value.trim()}
          title="Save this line to the clinic library for reuse"
          onClick={onSaveCustom}
        >
          + Custom
        </Button>
      ) : null}
    </div>
  );
}

function SnippetChips({
  snippets,
  disabled,
  onApply,
}: {
  snippets: UsgPathologyDef[];
  disabled?: boolean;
  onApply: (p: UsgPathologyDef) => void;
}) {
  if (!snippets.length || disabled) return null;
  return (
    <div className="flex flex-wrap gap-1 px-0.5">
      {snippets.map((p) => (
        <button
          key={p.key}
          type="button"
          className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-800"
          title="Apply saved line"
          onClick={() => onApply(p)}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function UsgTriadZones({
  impressionLines,
  adviceLines,
  disabled,
  impressionAddendum,
  adviceAddendum,
  impressionSnippets,
  adviceSnippets,
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
  onAdviceAddendum,
  onSaveImpressionCustom,
  onSaveAdviceCustom,
  onApplyImpressionSnippet,
  onApplyAdviceSnippet,
}: {
  impressionLines: UsgTriadLine[];
  adviceLines: UsgTriadLine[];
  disabled?: boolean;
  impressionAddendum?: string;
  adviceAddendum?: string;
  impressionSnippets?: UsgPathologyDef[];
  adviceSnippets?: UsgPathologyDef[];
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
  onAdviceAddendum: (text: string) => void;
  onSaveImpressionCustom?: (text: string) => void;
  onSaveAdviceCustom?: (text: string) => void;
  onApplyImpressionSnippet?: (p: UsgPathologyDef) => void;
  onApplyAdviceSnippet?: (p: UsgPathologyDef) => void;
}) {
  const [addDraft, setAddDraft] = useState("");
  const [adviceDraft, setAdviceDraft] = useState("");

  const commitImpression = () => {
    const t = addDraft.trim();
    if (!t) return;
    const prev = impressionAddendum?.trim() ?? "";
    onAddendum(prev ? `${prev}\n${t}` : t);
    setAddDraft("");
  };
  const commitAdvice = () => {
    const t = adviceDraft.trim();
    if (!t) return;
    const prev = adviceAddendum?.trim() ?? "";
    onAdviceAddendum(prev ? `${prev}\n${t}` : t);
    setAdviceDraft("");
  };

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
        emptyHint="Select a finding chip, or type a manual line below"
      />
      <SnippetChips
        snippets={impressionSnippets ?? []}
        disabled={disabled}
        onApply={(p) => onApplyImpressionSnippet?.(p)}
      />
      <AddLineRow
        value={addDraft}
        onChange={setAddDraft}
        onAdd={commitImpression}
        onSaveCustom={
          onSaveImpressionCustom
            ? () => {
                const t = addDraft.trim();
                if (t) onSaveImpressionCustom(t);
              }
            : undefined
        }
        placeholder="Add manual impression line…"
        disabled={disabled}
      />

      <Zone
        title="ADVICE / SUGGESTED NEXT STEPS"
        lines={adviceLines}
        disabled={disabled}
        onDismiss={onDismissAdvice}
        onEdit={onEditAdvice}
        onResetEdit={onResetAdviceEdit}
        onSaveDefault={onSaveAdviceDefault}
        onResetDefault={onResetAdviceDefault}
        emptyHint="Advice appears from findings — or type a manual line below"
      />
      <SnippetChips
        snippets={adviceSnippets ?? []}
        disabled={disabled}
        onApply={(p) => onApplyAdviceSnippet?.(p)}
      />
      <AddLineRow
        value={adviceDraft}
        onChange={setAdviceDraft}
        onAdd={commitAdvice}
        onSaveCustom={
          onSaveAdviceCustom
            ? () => {
                const t = adviceDraft.trim();
                if (t) onSaveAdviceCustom(t);
              }
            : undefined
        }
        placeholder="Add manual advice line…"
        disabled={disabled}
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
          <span className="text-[9px] font-semibold text-faint">
            {lines.length} line{lines.length === 1 ? "" : "s"}
          </span>
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
