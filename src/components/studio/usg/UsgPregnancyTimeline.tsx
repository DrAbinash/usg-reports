"use client";
/**
 * UsgPregnancyTimeline — GA / EFW growth timeline across visits.
 *
 * Shows a simple visual timeline of the patient's obstetric scans:
 *   - GA (weeks) on the X axis
 *   - EFW (grams) as bars
 *   - Key measurements (BPD/HC/AC/FL) in a table below
 *   - IUGR / macrosomia risk badges
 *
 * Pure client-side — takes a pre-built timeline object.
 */
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";
import { formatGa, type PregnancyTimeline } from "@/lib/usg/pregnancyTimeline";

export type UsgPregnancyTimelineProps = {
  timeline: PregnancyTimeline;
};

export function UsgPregnancyTimeline({ timeline }: UsgPregnancyTimelineProps) {
  if (timeline.totalVisits === 0) return null;

  const maxEfw = Math.max(...timeline.points.map((p) => p.efw ?? 0), 1);

  return (
    <div className="rounded-lg border border-lilac-200 bg-lilac-50/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-bold uppercase tracking-wide text-violet-900 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5" />
          Pregnancy Timeline
        </h4>
        {timeline.gaRangeDisplay && (
          <span className="text-[10px] text-muted-foreground">{timeline.gaRangeDisplay}</span>
        )}
      </div>

      {/* Risk badges */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {timeline.hasIugrRisk && (
          <RiskBadge label="IUGR Risk" icon={AlertTriangle} colour="text-red-700 bg-red-50 border-red-200" />
        )}
        {timeline.hasMacrosomiaRisk && (
          <RiskBadge label="Macrosomia Risk" icon={AlertTriangle} colour="text-amber-700 bg-amber-50 border-amber-200" />
        )}
        {timeline.efwTrend !== "insufficient" && (
          <RiskBadge
            label={`EFW: ${timeline.efwTrend}`}
            icon={timeline.efwTrend === "increasing" ? TrendingUp : timeline.efwTrend === "decreasing" ? TrendingDown : Minus}
            colour={
              timeline.efwTrend === "plateau" || timeline.efwTrend === "decreasing"
                ? "text-amber-700 bg-amber-50 border-amber-200"
                : "text-emerald-700 bg-emerald-50 border-emerald-200"
            }
          />
        )}
      </div>

      {/* Timeline bars */}
      <div className="space-y-1">
        {timeline.points.map((p, i) => (
          <TimelineRow key={p.reportId} point={p} maxEfw={maxEfw} index={i} />
        ))}
      </div>

      {/* Measurement table */}
      {timeline.points.length > 1 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-1 text-left font-medium">Date</th>
                <th className="py-1 text-right font-medium">GA</th>
                <th className="py-1 text-right font-medium">BPD</th>
                <th className="py-1 text-right font-medium">HC</th>
                <th className="py-1 text-right font-medium">AC</th>
                <th className="py-1 text-right font-medium">FL</th>
                <th className="py-1 text-right font-medium">EFW</th>
              </tr>
            </thead>
            <tbody>
              {timeline.points.map((p) => (
                <tr key={`row-${p.reportId}`} className="border-b border-muted/30">
                  <td className="py-1 text-left">{p.scanDate.slice(5)}</td>
                  <td className="py-1 text-right">{formatGa(p.gaWeeks, p.gaDays)}</td>
                  <td className="py-1 text-right font-mono">{p.bpd ?? "—"}</td>
                  <td className="py-1 text-right font-mono">{p.hc ?? "—"}</td>
                  <td className="py-1 text-right font-mono">{p.ac ?? "—"}</td>
                  <td className="py-1 text-right font-mono">{p.fl ?? "—"}</td>
                  <td className="py-1 text-right font-mono font-semibold">{p.efwDisplay ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TimelineRow({
  point: p, maxEfw, index,
}: { point: PregnancyTimeline["points"][number]; maxEfw: number; index: number }) {
  const efwPercent = p.efw ? Math.max(5, (p.efw / maxEfw) * 100) : 0;
  const isIugr = p.efw !== null && p.gaWeeks !== null && p.efw < 1000 && p.gaWeeks > 28;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 text-muted-foreground shrink-0">{p.scanDate.slice(5)}</span>
      <span className="w-16 font-medium shrink-0">{formatGa(p.gaWeeks, p.gaDays)}</span>
      <div className="flex-1 h-5 bg-muted/40 rounded overflow-hidden relative">
        <div
          className={cn(
            "h-full rounded transition-all",
            isIugr ? "bg-red-400" : "bg-violet-400",
          )}
          style={{ width: `${efwPercent}%` }}
        />
        <span className="absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-medium text-foreground">
          {p.efwDisplay ?? "—"}
        </span>
      </div>
    </div>
  );
}

function RiskBadge({
  label, icon: Icon, colour,
}: { label: string; icon: typeof AlertTriangle; colour: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", colour)}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
