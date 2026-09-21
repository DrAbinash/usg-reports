"use client";
/**
 * Slim tips ribbon — always-visible shortcut reminder in the composer.
 * Collapsed: one rotating tip + a few key chips. Click (or press ?) to expand
 * the full shortcut + text-expansion list.
 */
import { useEffect, useId, useState } from "react";
import { ChevronDown, Keyboard, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { COMPOSER_SHORTCUTS, TIP_ROTATE_MS, rotatingTips } from "@/lib/usg/shortcuts";
import { formatSnippetsForDisplay } from "@/lib/usg/textExpansion";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const TIPS = rotatingTips();
const CHIP_KEYS = ["Ctrl+S", "Ctrl+↵", "N", "?"] as const;

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable
  );
}

export function UsgTipsRibbon({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const panelId = useId();
  const snippets = formatSnippetsForDisplay();

  // Rotate tip while collapsed so the ribbon keeps teaching without noise.
  useEffect(() => {
    if (open || TIPS.length < 2) return;
    const id = window.setInterval(() => {
      setTipIndex((i) => (i + 1) % TIPS.length);
    }, TIP_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [open]);

  // "?" toggles the ribbon (same as the old dialog overlay).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "?" || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      setOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const tip = TIPS[tipIndex] ?? "Keyboard shortcuts — click to expand";

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn("border-t border-border/70 bg-panel/80", className)}>
      <CollapsibleTrigger
        type="button"
        aria-controls={panelId}
        className={cn(
          "group flex w-full items-center gap-2 px-3 py-1 text-left transition-colors",
          "hover:bg-card/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        )}
      >
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-md",
            open ? "bg-amber-100 text-amber-800" : "bg-sky-50 text-sky-700",
          )}
        >
          {open ? <Keyboard className="h-3 w-3" /> : <Lightbulb className="h-3 w-3" />}
        </span>

        <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
          {open ? (
            <span className="font-semibold text-foreground">Keyboard shortcuts</span>
          ) : (
            <>
              <span className="mr-1.5 font-semibold text-sky-800/80">Tip</span>
              <span key={tipIndex} className="animate-in fade-in duration-300">
                {tip}
              </span>
            </>
          )}
        </span>

        {!open ? (
          <span className="hidden shrink-0 items-center gap-1 md:flex" aria-hidden>
            {CHIP_KEYS.map((k) => (
              <kbd
                key={k}
                className="rounded border border-border bg-card px-1 py-px font-mono text-[9px] font-bold text-faint"
              >
                {k}
              </kbd>
            ))}
          </span>
        ) : null}

        <span className="flex shrink-0 items-center gap-1 text-[10px] font-medium text-faint">
          <span className="hidden sm:inline">{open ? "Hide" : "Shortcuts"}</span>
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")}
          />
        </span>
      </CollapsibleTrigger>

      <CollapsibleContent id={panelId}>
        <div className="grid gap-3 border-t border-border/60 px-3 pb-2.5 pt-2 sm:grid-cols-2">
          <div>
            <h4 className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-faint">
              Composer
            </h4>
            <ul className="space-y-1">
              {COMPOSER_SHORTCUTS.map((s) => (
                <li key={s.key} className="flex items-center justify-between gap-3 text-[11px]">
                  <span className="text-muted-foreground">{s.action}</span>
                  <kbd className="shrink-0 rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] font-bold text-foreground">
                    {s.key}
                  </kbd>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-faint">
              Text expansion — type in a finding box
            </h4>
            <ul className="studio-scroll max-h-[180px] space-y-1 overflow-y-auto pr-1">
              {snippets.map((s) => (
                <li key={s.trigger} className="flex items-center justify-between gap-3 text-[11px]">
                  <span className="truncate text-muted-foreground">{s.label}</span>
                  <kbd className="shrink-0 rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-violet-800">
                    {s.trigger}
                  </kbd>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] text-faint">
              Press <kbd className="rounded border bg-card px-1 font-mono text-[9px]">?</kbd> to
              toggle this panel · tips rotate while collapsed
            </p>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
