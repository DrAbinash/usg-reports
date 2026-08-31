"use client";
/** Print overlay: A4 preview in an iframe + print with the Background-graphics hint. */
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer, X, AlertTriangle } from "lucide-react";

export function PrintOverlay({ html, onClose }: { html: string; onClose: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const print = () => {
    iframeRef.current?.contentWindow?.focus();
    iframeRef.current?.contentWindow?.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#22303c]/70 backdrop-blur-sm">
      <div className="flex h-14 shrink-0 items-center gap-3 px-4">
        <div className="flex items-center gap-2 rounded-full bg-warn-bg px-3 py-1.5 text-[11.5px] font-semibold text-warn ring-1 ring-warn-line">
          <AlertTriangle className="h-3.5 w-3.5" />
          Tick “Background graphics” in the print dialog for the header band
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" className="h-9 border-border bg-card text-[12.5px]" onClick={onClose}>
            <X className="mr-1.5 h-3.5 w-3.5" /> Close
          </Button>
          <Button className="h-9 text-[12.5px]" onClick={print}>
            <Printer className="mr-1.5 h-3.5 w-3.5" /> Print A4
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 p-4 pt-0">
        <div className="mx-auto h-full w-full max-w-[820px] overflow-hidden rounded-lg bg-white shadow-2xl">
          <iframe
            ref={iframeRef}
            srcDoc={html}
            title="Report preview"
            className="h-full w-full border-0"
          />
        </div>
      </div>
    </div>
  );
}
