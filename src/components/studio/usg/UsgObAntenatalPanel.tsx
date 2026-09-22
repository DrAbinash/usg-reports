import { useState, useMemo } from "react";
import { computeObSummary, PRESENTATIONS, PLACENTA_POSITIONS, PLACENTA_GRADES, LOWER_SEG_EXT, INTERNAL_OS, type ObState } from "@/lib/usg/obReport";

type Props = {
  ob: ObState;
  onChange: (patch: Partial<ObState>) => void;
};

export function UsgObAntenatalPanel({ ob, onChange }: Props) {
  const summary = useMemo(() => computeObSummary(ob), [ob]);
  const [afiMode, setAfiMode] = useState<"adequate" | "custom">(
    ob.liquorAfi && ob.liquorAfi !== "Adequate" ? "custom" : "adequate"
  );
  const gaWeeks = summary.meanGa?.weeks;
  const biometryRows = [
    { key: "bpdMm" as const, label: "B.P.D", ga: summary.perParamGa.bpd },
    { key: "hcMm" as const, label: "H.C", ga: summary.perParamGa.hc },
    { key: "acMm" as const, label: "A.C", ga: summary.perParamGa.ac },
    { key: "flMm" as const, label: "F.L", ga: summary.perParamGa.fl },
  ];
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-bold text-indigo-700">ANTENATAL BIOMETRY</span>
        {summary.meanGa && (
          <span className="ml-auto rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
            Mean GA {summary.meanGa.weeks}w {summary.meanGa.days}d
          </span>
        )}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs font-semibold text-faint">
            <th className="pb-1 pr-2">Parameter</th>
            <th className="pb-1 pr-2 w-24">Value (mm)</th>
            <th className="pb-1 w-40">GA (Hadlock)</th>
          </tr>
        </thead>
        <tbody>
          {biometryRows.map((r) => (
            <tr key={r.key} className="border-b border-border/50">
              <td className="py-1.5 pr-2 font-medium">{r.label}</td>
              <td className="py-1.5 pr-2">
                <input
                  type="number"
                  value={ob[r.key] ?? ""}
                  onChange={(e) => onChange({ [r.key]: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="mm"
                  className="w-20 rounded border border-border px-2 py-1 text-sm"
                />
              </td>
              <td className="py-1.5 text-xs text-faint">
                {r.ga ? `${r.ga.weeks}w ${String(r.ga.days).padStart(2, "0")}d` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-faint">Presentation</label>
          <select
            value={ob.presentation ?? "cephalic"}
            onChange={(e) => onChange({ presentation: e.target.value })}
            className="w-full rounded border border-border px-2 py-1.5 text-sm"
          >
            {PRESENTATIONS.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-faint">FHR (b/min)</label>
          <div className="flex gap-1">
            <input
              type="number"
              value={ob.fhr ?? ""}
              onChange={(e) => onChange({ fhr: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="140"
              className="w-20 rounded border border-border px-2 py-1.5 text-sm"
            />
            <select
              value={ob.fhrRhythm ?? "Regular"}
              onChange={(e) => onChange({ fhrRhythm: e.target.value as any })}
              className="flex-1 rounded border border-border px-2 py-1.5 text-sm"
            >
              <option value="Regular">Regular</option>
              <option value="Irregular">Irregular</option>
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-faint">Placenta Position</label>
          <select
            value={ob.placentaPosition ?? ""}
            onChange={(e) => onChange({ placentaPosition: e.target.value })}
            className="w-full rounded border border-border px-2 py-1.5 text-sm"
          >
            <option value="">—</option>
            {PLACENTA_POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-faint">Placenta Grade</label>
          <select
            value={ob.placentaGrade ?? ""}
            onChange={(e) => onChange({ placentaGrade: e.target.value })}
            className="w-full rounded border border-border px-2 py-1.5 text-sm"
          >
            <option value="">—</option>
            {PLACENTA_GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-faint">Lower Segment</label>
          <select
            value={ob.placentaLowerSegment ?? ""}
            onChange={(e) => onChange({ placentaLowerSegment: e.target.value })}
            className="w-full rounded border border-border px-2 py-1.5 text-sm"
          >
            <option value="">—</option>
            {LOWER_SEG_EXT.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-faint">Internal Os</label>
          <select
            value={ob.internalOs ?? "Closed"}
            onChange={(e) => onChange({ internalOs: e.target.value })}
            className="w-full rounded border border-border px-2 py-1.5 text-sm"
          >
            {INTERNAL_OS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        {/* AFI — Dr. Sugandha's rule: Adequate default; number in second blank wins */}
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-semibold text-faint">
            Liquor AFI {gaWeeks !== undefined && gaWeeks < 20 ? "(Adequate standard < 20w)" : ""}
          </label>
          <div className="flex gap-2 items-center">
            <div className="flex rounded border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => { setAfiMode("adequate"); onChange({ liquorAfi: "Adequate" }); }}
                className={`px-3 py-1.5 text-sm ${afiMode === "adequate" ? "bg-indigo-600 text-white" : "bg-white text-faint"}`}
              >
                Adequate
              </button>
              <button
                type="button"
                onClick={() => setAfiMode("custom")}
                className={`px-3 py-1.5 text-sm ${afiMode === "custom" ? "bg-indigo-600 text-white" : "bg-white text-faint"}`}
              >
                Custom (cm)
              </button>
            </div>
            {afiMode === "custom" && (
              <input
                type="number"
                step="0.1"
                value={ob.liquorAfi === "Adequate" ? "" : (ob.liquorAfi ?? "")}
                onChange={(e) => onChange({ liquorAfi: e.target.value })}
                placeholder="12.8"
                className="w-24 rounded border border-border px-2 py-1.5 text-sm"
              />
            )}
            <span className="text-xs text-faint">→ prints: <b>{summary.afiLabel}</b></span>
          </div>
        </div>

        <div className="col-span-2 flex items-start gap-2">
          <input
            type="checkbox"
            checked={ob.anomaliesDetected ?? false}
            onChange={(e) => onChange({ anomaliesDetected: e.target.checked })}
            className="mt-1"
          />
          <div className="flex-1">
            <label className="text-xs font-semibold text-faint">Gross fetal anomalies detected</label>
            {ob.anomaliesDetected && (
              <input
                type="text"
                value={ob.anomaliesNote ?? ""}
                onChange={(e) => onChange({ anomaliesNote: e.target.value })}
                placeholder="Describe briefly"
                className="mt-1 w-full rounded border border-border px-2 py-1 text-sm"
              />
            )}
          </div>
        </div>
      </div>

      {summary.efw && (
        <div className="mt-3 rounded bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
          Hadlock EFW: <b>{summary.efw.grams} g (± {summary.efw.tolerance} g)</b>
          {summary.edd && ` · EDD ${summary.edd.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`}
        </div>
      )}
    </div>
  );
}
