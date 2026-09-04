"use client";
/**
 * UsgDailySummary — end-of-day dashboard.
 *
 * Feature 10: Shows the day's stats — finalized count, study mix,
 * top findings, revenue, turnaround time.
 */
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  CalendarDays, FileCheck2, AlertTriangle, Clock, IndianRupee, TrendingUp,
} from "lucide-react";
import { buildDailySummary, type DailySummary } from "@/lib/usg/dailySummary";

export function UsgDailySummary() {
  const [summary, setSummary] = useState<DailySummary | null>(null);

  useEffect(() => {
    fetch("/api/usg/reports?limit=100")
      .then((r) => r.json())
      .then((d) => {
        const reports = (d.reports ?? d ?? []) as Array<{
          id: number; scanDate: string | null; finalizedAt: string | null;
          status: string; studyKey: string; studyTitle: string;
          impression: string; patientName: string; serialNo: number | null;
        }>;
        setSummary(buildDailySummary(reports));
      })
      .catch(() => {});
  }, []);

  if (!summary) return null;

  return (
    <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays className="h-4 w-4 text-emerald-600" />
        <h3 className="text-sm font-bold text-emerald-900">
          Day Summary — {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
        </h3>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <KpiCard
          icon={FileCheck2}
          label="Finalized"
          value={summary.finalizedCount}
          colour="text-emerald-600 bg-emerald-50"
        />
        <KpiCard
          icon={Clock}
          label="Drafts"
          value={summary.draftCount}
          colour="text-amber-600 bg-amber-50"
        />
        {summary.criticalFindingsCount > 0 && (
          <KpiCard
            icon={AlertTriangle}
            label="Critical"
            value={summary.criticalFindingsCount}
            colour="text-red-600 bg-red-50"
          />
        )}
        {summary.revenueEstimate !== null && (
          <KpiCard
            icon={IndianRupee}
            label="Revenue"
            value={`₹${summary.revenueEstimate.toLocaleString("en-IN")}`}
            colour="text-violet-600 bg-violet-50"
          />
        )}
      </div>

      {/* Study breakdown */}
      {summary.studyBreakdown.length > 0 && (
        <div className="mt-3">
          <h4 className="mb-1 text-xs font-bold uppercase text-muted-foreground">Study Mix</h4>
          <div className="flex flex-wrap gap-1">
            {summary.studyBreakdown.slice(0, 6).map((s) => (
              <span
                key={s.studyKey}
                className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-100"
              >
                {s.studyTitle} · {s.count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Top findings */}
      {summary.topFindings.length > 0 && (
        <div className="mt-3">
          <h4 className="mb-1 text-xs font-bold uppercase text-muted-foreground">Top Findings</h4>
          <div className="space-y-0.5">
            {summary.topFindings.map((f) => (
              <div key={f.label} className="flex items-center justify-between text-xs">
                <span className="truncate text-muted-foreground">{f.label}</span>
                <span className="font-mono font-bold text-emerald-600">{f.count}×</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Turnaround */}
      {summary.avgTurnaroundMin !== null && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <TrendingUp className="h-3 w-3" />
          Avg turnaround: <span className="font-bold text-foreground">{summary.avgTurnaroundMin} min</span>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  icon: Icon, label, value, colour,
}: {
  icon: typeof FileCheck2;
  label: string;
  value: number | string;
  colour: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-lg p-2", colour)}>
      <Icon className="h-4 w-4 mb-0.5 opacity-80" />
      <span className="text-lg font-bold leading-none">{value}</span>
      <span className="text-[10px] uppercase tracking-wide opacity-70 mt-0.5">{label}</span>
    </div>
  );
}
