"use client";
/**
 * UsgGrowthChart — Hadlock growth chart overlay for obstetric USG.
 *
 * Feature 4: Plot EFW/BPD/HC/AC/FL on standard percentile curves.
 * Shows 3rd/10th/50th/90th/97th percentile bands with the patient's
 * measurements plotted as dots.
 *
 * Pure SVG — no charting library, no canvas, renders sharp at any zoom.
 */
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { buildGrowthChart, type GrowthChart } from "@/lib/usg/growthChart";

export type UsgGrowthChartProps = {
  points: Array<{ gaWeeks: number; efw?: number; bpd?: number; hc?: number; ac?: number; fl?: number }>;
};

const PARAMETERS: Array<GrowthChart["parameter"]> = ["EFW", "BPD", "HC", "AC", "FL"];

export function UsgGrowthChart({ points }: UsgGrowthChartProps) {
  const [activeParam, setActiveParam] = useState<GrowthChart["parameter"]>("EFW");

  const chart = useMemo(() => {
    const paramKey = activeParam.toLowerCase();
    const chartPoints = points
      .map((p) => ({
        gaWeeks: p.gaWeeks,
        value: (p as Record<string, number | undefined>)[paramKey] ?? 0,
      }))
      .filter((p) => p.value > 0);
    return buildGrowthChart(activeParam, chartPoints);
  }, [activeParam, points]);

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-bold uppercase tracking-wide text-violet-900">
          Growth Chart
        </h4>
        <div className="flex gap-0.5">
          {PARAMETERS.map((p) => (
            <button
              key={p}
              onClick={() => setActiveParam(p)}
              className={cn(
                "rounded px-2 py-0.5 text-[10px] font-bold transition-colors",
                activeParam === p
                  ? "bg-violet-600 text-white"
                  : "bg-violet-100 text-violet-600 hover:bg-violet-200",
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Risk badges */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {chart.below_10 && (
          <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium border-red-200 bg-red-50 text-red-700">
            <AlertTriangle className="h-3 w-3" /> Below 10th percentile
          </span>
        )}
        {chart.above_90 && (
          <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium border-amber-200 bg-amber-50 text-amber-700">
            <AlertTriangle className="h-3 w-3" /> Above 90th percentile
          </span>
        )}
      </div>

      {/* SVG chart */}
      <GrowthChartSvg chart={chart} />
    </div>
  );
}

function GrowthChartSvg({ chart }: { chart: GrowthChart }) {
  const W = 280;
  const H = 120;
  const margin = { top: 5, right: 10, bottom: 15, left: 28 };
  const plotW = W - margin.left - margin.right;
  const plotH = H - margin.top - margin.bottom;

  const minGa = 14;
  const maxGa = 42;
  const values = chart.curves.flatMap((c) => [c.p3, c.p97]);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);

  const xScale = (ga: number) => margin.left + ((ga - minGa) / (maxGa - minGa)) * plotW;
  const yScale = (val: number) => margin.top + plotH - ((val - minVal) / (maxVal - minVal)) * plotH;

  const curvePath = (key: keyof typeof chart.curves[0]) => {
    const points = chart.curves.map((c) => `${xScale(c.gaWeeks)},${yScale(c[key] as number)}`);
    return `M ${points.join(" L ")}`;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "auto" }}>
      {/* Y axis labels */}
      <text x="2" y={margin.top + 5} className="fill-muted-foreground text-[7px]">{maxVal}</text>
      <text x="2" y={H - margin.bottom - 2} className="fill-muted-foreground text-[7px]">{minVal}</text>

      {/* X axis labels */}
      <text x={margin.left} y={H - 3} className="fill-muted-foreground text-[7px]">{minGa}wk</text>
      <text x={W - margin.right - 10} y={H - 3} className="fill-muted-foreground text-[7px]">{maxGa}wk</text>

      {/* Grid */}
      <line x1={margin.left} y1={margin.top} x2={margin.left} y2={H - margin.bottom} stroke="hsl(var(--border))" strokeWidth="0.5" />
      <line x1={margin.left} y1={H - margin.bottom} x2={W - margin.right} y2={H - margin.bottom} stroke="hsl(var(--border))" strokeWidth="0.5" />

      {/* Percentile bands */}
      <path d={curvePath("p3")} fill="none" stroke="#fca5a5" strokeWidth="0.8" strokeDasharray="2,2" />
      <path d={curvePath("p10")} fill="none" stroke="#fcd34d" strokeWidth="0.8" strokeDasharray="2,2" />
      <path d={curvePath("p50")} fill="none" stroke="#a78bfa" strokeWidth="1.2" />
      <path d={curvePath("p90")} fill="none" stroke="#fcd34d" strokeWidth="0.8" strokeDasharray="2,2" />
      <path d={curvePath("p97")} fill="none" stroke="#fca5a5" strokeWidth="0.8" strokeDasharray="2,2" />

      {/* Patient data points */}
      {chart.plots.map((p, i) => (
        <g key={i}>
          <circle
            cx={xScale(p.gaWeeks)}
            cy={yScale(p.value)}
            r="3"
            fill={p.percentile !== null && p.percentile < 10 ? "#ef4444" : p.percentile !== null && p.percentile > 90 ? "#f59e0b" : "#7c3aed"}
            stroke="white"
            strokeWidth="1"
          />
          {p.percentile !== null && (
            <text
              x={xScale(p.gaWeeks) + 4}
              y={yScale(p.value) - 4}
              className="fill-foreground text-[7px] font-bold"
            >
              {p.percentile}%
            </text>
          )}
        </g>
      ))}

      {/* Legend */}
      <g transform={`translate(${W - 60}, ${margin.top + 2})`}>
        <line x1="0" y1="2" x2="8" y2="2" stroke="#a78bfa" strokeWidth="1.2" />
        <text x="10" y="4" className="fill-muted-foreground text-[6px]">50th</text>
        <line x1="0" y1="8" x2="8" y2="8" stroke="#fcd34d" strokeWidth="0.8" strokeDasharray="2,2" />
        <text x="10" y="10" className="fill-muted-foreground text-[6px]">10/90th</text>
        <line x1="0" y1="14" x2="8" y2="14" stroke="#fca5a5" strokeWidth="0.8" strokeDasharray="2,2" />
        <text x="10" y="16" className="fill-muted-foreground text-[6px]">3/97th</text>
      </g>
    </svg>
  );
}
