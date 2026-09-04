"use client";
/**
 * One organ card: pathology chips (Normal + library), measurement inputs for
 * the {tokens} in the finding text, inline text editor, and the organ's
 * contribution to the impression.
 *
 * Combined findings: chips TOGGLE — an organ can carry several pathologies at
 * once (fatty liver + haemangioma + hepatomegaly…). The finding text prints
 * each selected wording as its own paragraph and the impression unions every
 * line. "Normal" clears the whole selection.
 */
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Check, Pencil, Plus, RotateCcw, Stethoscope, Type, ChevronDown } from "lucide-react";
import type { UsgOrganDef, UsgOrganState, UsgPathologyDef, UsgVarDef } from "@/lib/usg/types";
import { extractTokens, ORGAN_SIDE, selectedPathologies, substitute } from "@/lib/usg/composer";
import { isSelectToken, getTokenOptions } from "@/lib/usg/tokenTypes";
import { appendTranscript } from "@/lib/usg/dictation";
import { DictationButton } from "./DictationButton";
import { UsgSuggestionsPanel } from "./UsgSuggestionsPanel";

export type OrganCardProps = {
  def: UsgOrganDef;
  state: UsgOrganState;
  pathologies: UsgPathologyDef[];
  /** The doctor's saved override for this organ's normal wording (v5). */
  normalOverride?: string | null;
  /** Save a new normal wording (persisted — every future report uses it). */
  onSaveNormal: (text: string) => void;
  /** Drop the override — back to the builtin wording. */
  onResetNormal: () => void;
  /** null = clear to normal; a key = toggle that pathology on/off. */
  onToggle: (pathologyKey: string | null) => void;
  onVar: (key: string, value: string) => void;
  onText: (text: string) => void;
  onAddCustom: (organKey: string, after?: string) => void;
};

function varLabel(defs: UsgVarDef[] | undefined, token: string): { label: string; unit?: string } {
  const v = defs?.find((d) => d.key === token);
  if (v) return { label: v.label, unit: v.unit };
  return { label: token.replace(/_/g, " ") };
}

export function UsgOrganCard({ def, state, pathologies, normalOverride, onSaveNormal, onResetNormal, onToggle, onVar, onText, onAddCustom }: OrganCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(state.text);
  const [showAll, setShowAll] = useState(false);
  const [editingNormal, setEditingNormal] = useState(false);
  const [normalDraft, setNormalDraft] = useState("");

  const selectedKeys = selectedPathologies(state);
  const selected = selectedKeys
    .map((k) => pathologies.find((p) => p.key === k))
    .filter((p): p is UsgPathologyDef => !!p);
  const anySelected = selected.length > 0;
  const tokens = useMemo(() => extractTokens(state.text), [state.text]);
  // Measurement labels: first definition that mentions the token wins.
  const varDefs = selected.length ? selected.find((p) => p.vars?.length)?.vars ?? selected[0].vars : def.vars;
  // {side}/{Side} on a paired organ card (kidney/thyroid lobe/breast/testis/
  // globe/carotid/pleura) auto-fills from the card itself — no input for it,
  // only the real measurements get inputs.
  const autoSide = ORGAN_SIDE[def.key];
  const inputTokens = tokens.filter((t) => !autoSide || !(t in autoSide));

  const isKidneySlot = def.key === "kidney_rt" || def.key === "kidney_lt";
  const visible = showAll ? pathologies : pathologies.slice(0, 6);

  // Reset target: the merged wording of the current selection (or normal).
  const selectedText = selected.length ? selected.map((p) => p.text).join("\n\n") : def.normal;

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-3.5 shadow-sm transition-colors",
        anySelected ? "border-rose-300 ring-1 ring-rose-200" : "border-border",
      )}
    >
      <div className="mb-2.5 flex items-center gap-2">
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold uppercase",
            anySelected ? "bg-rose-100 text-rose-700" : "bg-muted text-muted-foreground",
          )}
        >
          {anySelected ? (selected.length > 1 ? selected.length : "!") : "✓"}
        </span>
        <span className="text-[13px] font-bold tracking-wide">{def.label}</span>
        {selected.length > 1 ? (
          <Badge variant="outline" className="h-5 border-rose-300 bg-rose-50 px-1.5 text-[9px] font-semibold text-rose-700">
            combined ×{selected.length}
          </Badge>
        ) : null}
        {state.custom && !editing ? (
          <Badge variant="outline" className="h-5 border-amber-300 bg-amber-50 px-1.5 text-[9px] font-semibold text-amber-700">
            edited
          </Badge>
        ) : null}
        {normalOverride && !anySelected ? (
          <Badge variant="outline" className="h-5 border-violet-300 bg-violet-50 px-1.5 text-[9px] font-semibold text-violet-700" title="The normal wording is the doctor's own (customised in settings-free one click)">
            my wording
          </Badge>
        ) : null}
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-7 w-7 p-0", normalOverride ? "text-violet-500" : "text-muted-foreground")}
            title={normalOverride ? "Customise the normal wording (currently your own)" : "Customise this organ's normal wording — saved for every future report"}
            onClick={() => {
              setNormalDraft(normalOverride ?? def.normal);
              setEditingNormal((v) => !v);
            }}
          >
            <Type className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground"
            title="Edit finding text"
            onClick={() => {
              if (editing) {
                setEditing(false);
                if (draft !== state.text) onText(draft);
              } else {
                setDraft(state.text);
                setEditing(true);
              }
            }}
          >
            {editing ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Pencil className="h-3.5 w-3.5" />}
          </Button>
          {state.custom || editing ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground"
              title="Reset to selected wording"
              onClick={() => {
                setEditing(false);
                setDraft(selectedText);
                onText(selectedText);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      {/* Normal-wording editor (v5) — retunes the builtin normal itself */}
      {editingNormal ? (
        <div className="mb-2.5 rounded-lg border border-violet-200 bg-violet-50/60 p-2.5">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-violet-700">
            Normal wording — saved for every future {def.label} report
          </p>
          <Textarea
            value={normalDraft}
            onChange={(e) => setNormalDraft(e.target.value)}
            rows={4}
            className="resize-y border-violet-200 bg-white text-[12px] leading-relaxed"
          />
          <div className="mt-1.5 flex items-center gap-1.5">
            <Button
              size="sm"
              className="h-7 bg-violet-600 px-2.5 text-[11px] hover:bg-violet-700"
              disabled={!normalDraft.trim()}
              onClick={() => {
                onSaveNormal(normalDraft);
                setEditingNormal(false);
              }}
            >
              Save wording
            </Button>
            {normalOverride ? (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-[11px]"
                onClick={() => {
                  onResetNormal();
                  setEditingNormal(false);
                }}
              >
                Reset to builtin
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2.5 text-[11px]"
              onClick={() => setEditingNormal(false)}
            >
              Cancel
            </Button>
            {def.vars?.length ? (
              <span className="ml-auto text-[10px] text-violet-500">{`{tokens} stay fill-in slots`}</span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Pathology chips — multi-select toggles */}
      <div className="mb-2.5 flex flex-wrap gap-1.5">
        <button
          onClick={() => {
            setEditing(false);
            onToggle(null);
          }}
          className={cn(
            "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
            !anySelected && !state.custom
              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
              : "border-border bg-muted/40 text-muted-foreground hover:border-emerald-200 hover:text-emerald-700",
          )}
        >
          Normal
        </button>
        {visible.map((p) => {
          const on = selectedKeys.includes(p.key);
          return (
            <button
              key={p.key}
              onClick={() => {
                setEditing(false);
                onToggle(p.key);
              }}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                on
                  ? "border-rose-300 bg-rose-50 text-rose-700"
                  : "border-border bg-muted/40 text-muted-foreground hover:border-rose-200 hover:text-rose-700",
                !p.builtin ? "italic" : "",
              )}
              title={p.builtin ? (on ? "Selected — click to remove" : "Click to add (combine with others)") : `Custom entry${on ? " — click to remove" : ""}`}
            >
              {p.label}
            </button>
          );
        })}
        {pathologies.length > 6 && !showAll ? (
          <button
            onClick={() => setShowAll(true)}
            className="rounded-full border border-dashed border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            +{pathologies.length - 6} more
          </button>
        ) : null}
        <button
          onClick={() => onAddCustom(def.key)}
          className="flex items-center gap-0.5 rounded-full border border-dashed border-rose-200 px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50"
          title={`Add a custom ${def.label} finding${isKidneySlot ? " (applies to both kidneys)" : ""}`}
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      {/* Measurement inputs for {tokens} (side tokens auto-fill) */}
      {inputTokens.length > 0 ? (
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {inputTokens.map((t) => {
            const { label, unit } = varLabel(varDefs, t);
            const isSelect = isSelectToken(t);
            const options = getTokenOptions(t);

            if (isSelect && options) {
              // Render a dropdown for select tokens (e.g. calyx location)
              return (
                <label key={t} className="flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50/40 px-2 py-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
                  <Select value={state.vars[t] ?? ""} onValueChange={(v) => onVar(t, v)}>
                    <SelectTrigger className="h-6 w-32 border-0 bg-transparent px-1 text-[12px] font-bold text-foreground focus:ring-1 focus:ring-sky-300">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-[12px]">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {unit ? <span className="text-[10px] text-faint">{unit}</span> : null}
                </label>
              );
            }

            // Default: free-text input (existing behaviour)
            return (
              <label key={t} className="flex items-center gap-1 rounded-lg border border-border bg-panel px-2 py-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
                <Input
                  value={state.vars[t] ?? ""}
                  onChange={(e) => onVar(t, e.target.value)}
                  className="h-6 w-16 border-0 bg-transparent px-1 text-[12px] font-bold text-foreground focus-visible:ring-1 focus-visible:ring-rose-300"
                  placeholder="___"
                  inputMode="decimal"
                />
                {unit ? <span className="text-[10px] text-faint">{unit}</span> : null}
              </label>
            );
          })}
        </div>
      ) : null}

      {/* Organ-specific suggestions (deterministic, no AI) */}
      {anySelected && (
        <UsgSuggestionsPanel selectedPathologyKeys={selectedKeys} />
      )}

      {/* Finding text */}
      {editing ? (
        <div>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              setEditing(false);
              if (draft !== state.text) onText(draft);
            }}
            rows={5}
            className="resize-y text-[12px] leading-relaxed"
            placeholder="Finding text…"
          />
          <div className="mt-1 flex items-center gap-1">
            <DictationButton
              onText={(t) => setDraft((prev) => appendTranscript(prev, t))}
              title="Dictate this finding — recognised speech appends to the text"
            />
            <span className="text-[10px] text-faint">dictate into this finding</span>
          </div>
        </div>
      ) : (
        <p
          className={cn(
            "cursor-text rounded-lg bg-panel px-2.5 py-2 text-[12px] leading-relaxed text-muted-foreground",
            anySelected || state.custom ? "text-foreground" : "",
          )}
          onClick={() => {
            setDraft(state.text);
            setEditing(true);
          }}
          title="Click to edit"
        >
          {state.text}
          {state.text.includes("{") ? (
            <span className="ml-1 inline-flex items-center gap-1 text-[10px] font-semibold text-rose-500">
              <Stethoscope className="h-3 w-3" /> fill measurements above
            </span>
          ) : null}
        </p>
      )}

      {/* Impression preview — every selected pathology's lines */}
      {selected.some((p) => p.impression?.length) ? (
        <div className="mt-2 rounded-lg border-l-[3px] border-rose-300 bg-rose-50/60 px-2.5 py-1.5">
          {selected.flatMap((p) => p.impression).map((line, i) => (
            <p key={i} className="text-[11px] font-semibold leading-snug text-rose-800">
              ⇒ {substitute(line, state.vars, def.key)}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
