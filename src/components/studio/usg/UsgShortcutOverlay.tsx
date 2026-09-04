"use client";
/**
 * UsgShortcutOverlay — press ? to see all keyboard shortcuts.
 *
 * Feature 5: Keyboard shortcut overlay.
 */
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";
import { formatSnippetsForDisplay } from "@/lib/usg/textExpansion";

const SHORTCUTS = [
  { key: "Ctrl + S", action: "Save draft" },
  { key: "Ctrl + Enter", action: "Finalize" },
  { key: "Ctrl + K", action: "Switch study" },
  { key: "Ctrl + P", action: "Print" },
  { key: "1-9", action: "Toggle pathology chip (1st-9th)" },
  { key: "N", action: "Mark organ normal" },
  { key: "Space", action: "Open next organ" },
  { key: "F", action: "Finalize (quality check)" },
  { key: "P", action: "Print preview" },
  { key: "/", action: "Focus search" },
  { key: "?", action: "Show this overlay" },
  { key: "Esc", action: "Close dialogs" },
];

export function UsgShortcutOverlay() {
  const [open, setOpen] = useState(false);
  const snippets = formatSnippetsForDisplay();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <h4 className="mb-1.5 text-xs font-bold uppercase text-muted-foreground">Navigation</h4>
            <div className="space-y-1">
              {SHORTCUTS.map((s) => (
                <div key={s.key} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{s.action}</span>
                  <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-1.5 text-xs font-bold uppercase text-muted-foreground">
              Text Expansion — type in any finding box
            </h4>
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {snippets.map((s) => (
                <div key={s.trigger} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{s.label}</span>
                  <kbd className="rounded border bg-violet-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-violet-700">
                    {s.trigger}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
