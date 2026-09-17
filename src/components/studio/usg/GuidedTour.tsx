"use client";
/** 60-second guided tour — 5 centred steps, no DOM anchors, dismissible forever. */
import { useState } from "react";
import { X, ChevronLeft, ChevronRight, Waves, MousePointerClick, Calculator, Printer, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const STEPS = [
  { icon: Waves, title: "The Composer", body: "Pick the study, then tap organs and tap the findings the probe found. One report per patient — drafts save themselves every second." },
  { icon: MousePointerClick, title: "Pathology Chips", body: "Chips toggle on/off, so one organ can carry several findings. Findings merge into paragraphs and the impression writes itself." },
  { icon: Calculator, title: "Bedside Calculators", body: "Hadlock biometry, LMP → GA/EDD, AFI, volumes, TI-RADS — one click each, and every result copies to the clipboard." },
  { icon: Printer, title: "Premium Print", body: "Your letterhead with logo and signature. In the print dialog tick “Background graphics” so the gradient masthead reaches paper." },
  { icon: FileCheck2, title: "Finalize", body: "Ctrl+Enter stamps the next register number (USG-0001…), freezes the report forever, and reports back to the bill desk. Reprint any time." },
];

export function GuidedTour({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const dismiss = () => { try { localStorage.setItem("care-usg-tour-dismissed", "1"); } catch {} onClose(); };
  const S = STEPS[step];
  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-violet-200 bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-violet-500 text-white"><S.icon className="h-4.5 w-4.5" /></span>
            <div className="text-xs font-bold text-violet-700">Step {step + 1} of {STEPS.length}</div>
          </div>
          <button onClick={dismiss} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
        </div>
        <h3 className="mb-2 text-lg font-bold text-slate-900">{S.title}</h3>
        <p className="mb-5 text-sm leading-relaxed text-slate-600">{S.body}</p>
        <div className="mb-4 flex justify-center gap-1.5">{STEPS.map((_, i) => (<span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-violet-600" : "w-1.5 bg-slate-300"}`} />))}</div>
        <div className="flex items-center justify-between">
          <Button onClick={() => setStep(step - 1)} variant="outline" size="sm" disabled={step === 0}><ChevronLeft className="h-4 w-4" /> Back</Button>
          <Button onClick={dismiss} variant="ghost" size="sm" className="text-slate-500">Skip tour</Button>
          <Button onClick={() => (step < STEPS.length - 1 ? setStep(step + 1) : dismiss())} size="sm" className="bg-violet-600 hover:bg-violet-700">
            {step < STEPS.length - 1 ? <>Next <ChevronRight className="h-4 w-4" /></> : "Finish"}
          </Button>
        </div>
      </div>
    </div>
  );
}
