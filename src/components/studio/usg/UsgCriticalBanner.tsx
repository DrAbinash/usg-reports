"use client";
/**
 * UsgCriticalBanner — critical findings alert banner.
 *
 * Shows when a critical pathology is selected in the composer. Displays
 * severity-coded alert cards with clinical message + recommendation.
 * Dismissible per session (the pathology stays selected, the banner
 * collapses to a small chip).
 */
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { AlertOctagon, AlertTriangle, Info, ChevronDown, ChevronUp, X } from "lucide-react";
import {
  scanForCriticalFindings, severityColour, severityIcon,
  type CriticalFindingAlert, type CriticalSeverity,
} from "@/lib/usg/criticalFindings";
import type { UsgPathologyDef } from "@/lib/usg/types";

export type UsgCriticalBannerProps = {
  /** Currently selected pathology keys with their definitions. */
  selectedPathologies: Array<{ key: string; label: string; organ: string }>;
};

const ICON_MAP: Record<string, typeof AlertOctagon> = {
  AlertOctagon, AlertTriangle, Info,
};

export function UsgCriticalBanner({ selectedPathologies }: UsgCriticalBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const alerts = useMemo(
    () => scanForCriticalFindings(selectedPathologies),
    [selectedPathologies],
  );

  // Reset dismissal when the set of critical findings changes
  const alertKey = alerts.map((a) => a.pathologyKey).join(",");
  useMemo(() => { setDismissed(false); }, [alertKey]);

  if (alerts.length === 0) return null;

  if (dismissed) {
    return (
      <button
        type="button"
        onClick={() => setDismissed(false)}
        className="flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-red-700 transition-colors"
      >
        <AlertOctagon className="h-3.5 w-3.5" />
        {alerts.length} critical finding{alerts.length > 1 ? "s" : ""}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-red-300 bg-red-50/80 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 text-sm font-semibold text-red-900"
        >
          <AlertOctagon className="h-4 w-4 text-red-600" />
          {alerts.length} Critical Finding{alerts.length > 1 ? "s" : ""} Detected
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-red-600 hover:text-red-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Alert cards */}
      {expanded && (
        <div className="space-y-1.5 px-3 pb-3">
          {alerts.map((alert, i) => (
            <AlertCard key={`${alert.pathologyKey}-${i}`} alert={alert} />
          ))}
        </div>
      )}
    </div>
  );
}

function AlertCard({ alert }: { alert: CriticalFindingAlert }) {
  const iconName = severityIcon(alert.severity);
  const Icon = ICON_MAP[iconName] ?? AlertTriangle;
  const colourClass = severityColour(alert.severity);

  return (
    <div className={cn("rounded-md border p-2.5", colourClass)}>
      <div className="flex items-start gap-2">
        <Icon className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide">
              {alert.severity}
            </span>
            <span className="text-xs opacity-80">
              {alert.pathologyLabel} · {alert.organ}
            </span>
          </div>
          <p className="mt-0.5 text-sm font-medium">{alert.message}</p>
          <p className="mt-0.5 text-xs opacity-90">
            <span className="font-semibold">Recommendation:</span> {alert.recommendation}
          </p>
        </div>
      </div>
    </div>
  );
}
