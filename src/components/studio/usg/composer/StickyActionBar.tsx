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
    <div className="sticky bottom-0 z-20 -mx-1 mt-auto border-t-2 border-slate-200 bg-white/95 px-3 py-2.5 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] backdrop-blur supports-[backdrop-filter]:bg-white/90">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onSave}
          disabled={busy !== "" || isFinal}
          className="h-10 border-2 border-slate-300 bg-white px-4 text-[13px] font-bold text-slate-900 shadow-sm hover:bg-slate-50"
        >
          {busy === "save" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          Save
        </Button>
        <Button
          size="sm"
          onClick={onFinalize}
          disabled={busy !== "" || isFinal}
          className="h-10 bg-emerald-600 px-4 text-[13px] font-bold text-white shadow-sm hover:bg-emerald-700"
        >
          {busy === "finalize" ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <FileCheck2 className="mr-1.5 h-4 w-4" />
          )}
          Finalize
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onPrint}
          disabled={busy !== ""}
          className="h-10 border-2 border-rose-400 bg-rose-100 px-4 text-[13px] font-bold text-rose-900 shadow-sm hover:bg-rose-200"
        >
          {busy === "print" ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Printer className="mr-1.5 h-4 w-4" />
          )}
          Print
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onNext}
          className="h-10 px-3 text-[13px] font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900"
          title="Back to worklist / next patient"
        >
          Next
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
