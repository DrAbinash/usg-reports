"use client";
/**
 * Print Reminder — small banner reminding to tick "Background graphics".
 * Shown in print preview, dismissible per session.
 */
import { useState } from "react";
import { AlertCircle, X } from "lucide-react";

export function PrintReminder() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="no-print mx-auto mb-3 flex max-w-2xl items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm">
      <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
      <span className="flex-1 text-amber-900">
        <b>Print tip:</b> Tick <i>Background graphics</i> in your print dialog so the letterhead prints correctly.
      </span>
      <button onClick={() => setDismissed(true)} className="text-amber-600 hover:text-amber-800">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
