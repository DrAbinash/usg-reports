"use client";
/**
 * Sticky action bar — sole Save · Finalize · Print · PDF · Next cluster.
 * Top-toolbar duplicates were removed so actions live in one place.
 */
import { Button } from "@/components/ui/button";
import { FileCheck2, FileDown, Loader2, Printer, Save, ArrowRight } from "lucide-react";

export type StickyActionBarProps = {
  hidden?: boolean;
  busy: "" | "save" | "finalize" | "print";
  isFinal: boolean;
  onSave: () => void;
  onFinalize: () => void;
  onPrint: () => void;
  onNext: () => void;
  /** Shown after finalize — PDF download (moved here from the top toolbar). */
  onDownloadPdf?: () => void;
};

export function StickyActionBar({
  hidden,
  busy,
  isFinal,
  onSave,
  onFinalize,
  onPrint,
  onNext,
  onDownloadPdf,
}: StickyActionBarProps) {
  if (hidden) return null;
  return (
    <div className="sticky bottom-0 z-20 -mx-1 mt-auto border-t border-slate-200 bg-white/95 px-2 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-white/90">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <Button
          size="sm"
          variant="outline"
          onClick={onSave}
          disabled={busy !== "" || isFinal}
          className="h-8 border border-slate-300 bg-white px-3 text-[12px] font-bold text-slate-900 hover:bg-slate-50"
        >
          {busy === "save" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
          Save
        </Button>
        <Button
          size="sm"
          onClick={onFinalize}
          disabled={busy !== "" || isFinal}
          className="h-8 bg-emerald-600 px-3 text-[12px] font-bold text-white hover:bg-emerald-700"
        >
          {busy === "finalize" ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileCheck2 className="mr-1 h-3.5 w-3.5" />
          )}
          Finalize
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onPrint}
          disabled={busy !== ""}
          className="h-8 border border-rose-400 bg-rose-100 px-3 text-[12px] font-bold text-rose-900 hover:bg-rose-200"
        >
          {busy === "print" ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Printer className="mr-1 h-3.5 w-3.5" />
          )}
          Print
        </Button>
        {isFinal && onDownloadPdf ? (
          <Button
            size="sm"
            variant="outline"
            onClick={onDownloadPdf}
            className="h-8 border border-sky-400 bg-sky-50 px-3 text-[12px] font-bold text-sky-800 hover:bg-sky-100"
            title="Download PDF"
          >
            <FileDown className="mr-1 h-3.5 w-3.5" />
            PDF
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          onClick={onNext}
          className="h-8 px-2.5 text-[12px] font-bold text-slate-700 hover:bg-slate-100"
          title="Back to worklist / next patient"
        >
          Next
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
