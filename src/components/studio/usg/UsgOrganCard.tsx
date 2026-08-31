"use client";
/**
 * One organ card: pathology chips (Normal + library), measurement inputs for
 * the {tokens} in the finding text, inline text editor, and the organ's
 * contribution to the impression. Selecting "Fatty Liver — Gr I" here
 * replaces ONLY this organ's finding — the rest of the report stays normal.
 */
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Check, Pencil, Plus, RotateCcw, Stethoscope } from "lucide-react";
import type { UsgOrganDef, UsgOrganState, UsgPathologyDef, UsgVarDef } from "@/lib/usg/types";
import { extractTokens, ORGAN_SIDE, substitute } from "@/lib/usg/composer";

export type OrganCardProps = {
  def: UsgOrganDef;
  state: UsgOrganState;
  pathologies: UsgPathologyDef[];
  onSelect: (pathologyKey: string | null) => void;
  onVar: (key: string, value: string) => void;
  onText: (text: string) => void;
  onAddCustom: (organKey: string, after?: string) => void;
};

function varLabel(defs: UsgVarDef[] | undefined, token: string): { label: string; unit?: string } {
  const v = defs?.find((d) => d.key === token);
  if (v) return { label: v.label, unit: v.unit };
  return { label: token.replace(/_/g, " ") };
}

export function UsgOrganCard({ def, state, pathologies, onSelect, onVar, onText, onAddCustom }: OrganCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(state.text);
  const [showAll, setShowAll] = useState(false);

  const selected = state.pathology ? pathologies.find((p) => p.key === state.pathology) : null;
  const tokens = useMemo(() => extractTokens(state.text), [state.text]);
  const varDefs = selected?.vars ?? def.vars;
  // {side}/{Side} on a paired organ card (kidney/thyroid lobe/breast/testis/
  // globe/carotid/pleura) auto-fills from the card itself — no input for it,
  // only the real measurements get inputs.
  const autoSide = ORGAN_SIDE[def.key];
  const inputTokens = tokens.filter((t) => !autoSide || !(t in autoSide));

  const isKidneySlot = def.key === "kidney_rt" || def.key === "kidney_lt";
  const visible = showAll ? pathologies : pathologies.slice(0, 6);

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-3.5 shadow-sm transition-colors",
        selected ? "border-rose-300 ring-1 ring-rose-200" : "border-border",
      )}
    >
      <div className="mb-2.5 flex items-center gap-2">
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold uppercase",
            selected ? "bg-rose-100 text-rose-700" : "bg-muted text-muted-foreground",
          )}
        >
          {selected ? "!" : "✓"}
        </span>
        <span className="text-[13px] font-bold tracking-wide">{def.label}</span>
        {state.custom && !editing ? (
          <Badge variant="outline" className="h-5 border-amber-300 bg-amber-50 px-1.5 text-[9px] font-semibold text-amber-700">
            edited
          </Badge>
        ) : null}
        <div className="ml-auto flex items-center gap-1">
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
                setDraft(selected ? selected.text : def.normal);
                onText(selected ? selected.text : def.normal);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      {/* Pathology chips */}
      <div className="mb-2.5 flex flex-wrap gap-1.5">
        <button
          onClick={() => {
            setEditing(false);
            onSelect(null);
          }}
          className={cn(
            "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
            state.pathology === null && !state.custom
              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
              : "border-border bg-muted/40 text-muted-foreground hover:border-emerald-200 hover:text-emerald-700",
          )}
        >
          Normal
        </button>
        {visible.map((p) => (
          <button
            key={p.key}
            onClick={() => {
              setEditing(false);
              onSelect(p.key);
            }}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
              state.pathology === p.key
                ? "border-rose-300 bg-rose-50 text-rose-700"
                : "border-border bg-muted/40 text-muted-foreground hover:border-rose-200 hover:text-rose-700",
              !p.builtin ? "italic" : "",
            )}
            title={p.builtin ? undefined : "Custom entry"}
          >
            {p.label}
          </button>
        ))}
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

      {/* Finding text */}
      {editing ? (
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
      ) : (
        <p
          className={cn(
            "cursor-text rounded-lg bg-panel px-2.5 py-2 text-[12px] leading-relaxed text-muted-foreground",
            state.pathology || state.custom ? "text-foreground" : "",
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

      {/* Impression preview line */}
      {selected?.impression?.length ? (
        <div className="mt-2 rounded-lg border-l-[3px] border-rose-300 bg-rose-50/60 px-2.5 py-1.5">
          {selected.impression.map((line, i) => (
            <p key={i} className="text-[11px] font-semibold leading-snug text-rose-800">
              ⇒ {substitute(line, state.vars, def.key)}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
