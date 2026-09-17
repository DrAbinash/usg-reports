"use client";
/**
 * Welcome Banner — shown once after first login, before the worklist.
 * Three big buttons: first report / worklist / tour. Dismissible forever.
 */
import { useEffect, useState } from "react";
import { Waves, ClipboardList, HelpCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function WelcomeBanner({ onStartReport, onOpenWorklist, onTour, onDismiss }: {
  onStartReport: () => void;
  onOpenWorklist: () => void;
  onTour: () => void;
  onDismiss: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("care-usg-welcome-dismissed") === "1") {
      setDismissed(true);
    }
  }, []);

  if (dismissed) return null;

  const dismiss = () => {
    localStorage.setItem("care-usg-welcome-dismissed", "1");
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div className="mx-auto mb-6 max-w-3xl rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-violet-50 p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Welcome to your USG Studio 👋</h2>
          <p className="mt-1 text-sm text-slate-600">Your sonography reporting home is ready. Start your first report, open the worklist, or take a quick tour.</p>
        </div>
        <button onClick={dismiss} className="text-slate-400 hover:text-slate-600">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Button onClick={onStartReport} className="flex h-20 flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-rose-500 to-fuchsia-500 text-white hover:from-rose-600 hover:to-fuchsia-600">
          <Waves className="h-6 w-6" />
          <span className="text-sm font-bold">Start First Report</span>
        </Button>
        <Button onClick={onOpenWorklist} variant="outline" className="flex h-20 flex-col items-center justify-center gap-1.5 border-sky-300 bg-white hover:bg-sky-50">
          <ClipboardList className="h-6 w-6 text-sky-700" />
          <span className="text-sm font-bold text-sky-900">Open Worklist</span>
        </Button>
        <Button onClick={onTour} variant="outline" className="flex h-20 flex-col items-center justify-center gap-1.5 border-violet-300 bg-white hover:bg-violet-50">
          <HelpCircle className="h-6 w-6 text-violet-700" />
          <span className="text-sm font-bold text-violet-900">60-Second Tour</span>
        </Button>
      </div>
    </div>
  );
}
