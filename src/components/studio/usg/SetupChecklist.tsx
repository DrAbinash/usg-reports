"use client";
/**
 * Setup Checklist — shows a friendly progress card when key settings are missing.
 * Dismissible forever via localStorage; reopenable from Settings → "Show setup tips".
 */
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, X, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CheckItem = {
  key: string;
  label: string;
  done: boolean;
  hint: string;
};

export function SetupChecklist({ settings, onDismiss }: { settings: any; onDismiss: () => void }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("care-usg-setup-dismissed") === "1") {
      setDismissed(true);
    }
  }, []);

  if (dismissed) return null;

  const items: CheckItem[] = [
    { key: "pin", label: "PIN changed from default", done: !!settings?.pinHash, hint: "Settings → Security" },
    { key: "doctor", label: "Sonologist name + registration", done: !!(settings?.usgDoctorName && settings?.usgDoctorRegNo), hint: "Settings → USG Studio" },
    { key: "logo", label: "Hospital logo uploaded", done: !!settings?.logoUrl, hint: "Settings → Hospital" },
    { key: "signature", label: "Scanned signature uploaded", done: !!settings?.usgSignatureUrl, hint: "Settings → USG Studio" },
    { key: "paper", label: "Paper size chosen (A4/A5)", done: !!settings?.usgPrintPaper, hint: "Settings → USG Studio" },
  ];

  const doneCount = items.filter(i => i.done).length;
  const progress = Math.round((doneCount / items.length) * 100);

  const dismiss = () => {
    localStorage.setItem("care-usg-setup-dismissed", "1");
    setDismissed(true);
    onDismiss?.();
  };

  if (progress === 100) {
    return (
      <div className="mx-auto mb-4 flex max-w-2xl items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <span className="text-sm font-semibold text-emerald-900">Setup complete! Your studio is ready.</span>
        </div>
        <button onClick={dismiss} className="text-emerald-600 hover:text-emerald-800">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto mb-4 max-w-2xl rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-amber-700" />
          <span className="text-sm font-bold text-amber-900">Setup Checklist ({progress}%)</span>
        </div>
        <button onClick={dismiss} className="text-amber-600 hover:text-amber-800">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-amber-200">
        <div className="h-full bg-amber-600 transition-all" style={{ width: `${progress}%` }} />
      </div>
      <ul className="space-y-1.5">
        {items.map(item => (
          <li key={item.key} className="flex items-start gap-2 text-xs">
            {item.done ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <Circle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            )}
            <div>
              <span className={cn("font-medium", item.done ? "text-emerald-900" : "text-amber-900")}>{item.label}</span>
              {!item.done && <span className="ml-2 text-amber-600">→ {item.hint}</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
