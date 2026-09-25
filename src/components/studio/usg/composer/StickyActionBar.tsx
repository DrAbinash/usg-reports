"use client";
/**
 * Sticky action bar — Save · Finalize · Print · Next pinned to the composer
 * viewport bottom. Calls existing orchestrator callbacks only.
 */
import { Button } from "@/components/ui/button";
import { FileCheck2, Loader2, Printer, Save, ArrowRight } from "lucide-react";

export type StickyActionBarProps = {
  hidden?: boolean;
  busy: "" | "save" | "finalize" | "print";
  isFinal: boolean;
  onSave: () => void;
  onFinalize: () => void;
  onPrint: () => void;
  onNext: () => void;
};

export function StickyActionBar({
  hidden,
  busy,
  isFinal,
  onSave,
  onFinalize,
  onPrint,
  onNext,
}: StickyActionBarProps) {
  if (hidden) return null;
  return (
    <div className="sticky bottom-0 z-20 -mx-1 mt-auto border-t border-border bg-card/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onSave}
          disabled={busy !== "" || isFinal}
          className="h-8 border-border bg-panel px-3 text-[11px] font-semibold"
        >
          {busy === "save" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
          Save
        </Button>
        <Button
          size="sm"
          onClick={onFinalize}
          disabled={busy !== "" || isFinal}
          className="h-8 bg-emerald-600 px-3 text-[11px] font-semibold hover:bg-emerald-700"
        >
          {busy === "finalize" ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileCheck2 className="mr-1.5 h-3.5 w-3.5" />
          )}
          Finalize
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onPrint}
          disabled={busy !== ""}
          className="h-8 border-rose-200 bg-rose-50 px-3 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"
        >
          {busy === "print" ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Printer className="mr-1.5 h-3.5 w-3.5" />
          )}
          Print
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onNext}
          className="h-8 px-3 text-[11px] font-semibold text-muted-foreground"
          title="Back to worklist / next patient"
        >
          Next
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
