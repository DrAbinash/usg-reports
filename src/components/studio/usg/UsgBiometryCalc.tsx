"use client";
/**
 * OB biometry calculator (Hadlock) — the strip under the LMP calculator on
 * antenatal scans. Enter BPD/HC/AC/FL in mm (as the format prints them);
 * the Hadlock engine computes per-parameter GA, mean GA, EFW ± 15% and the
 * scan-implied EDD, then fills every biometry slot in the report format.
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Ruler } from "lucide-react";
import { efwTolerance, eddFromGa, hadlockEfw, meanGa, perParameterGa } from "@/lib/usg/biometry";
import { formatEdd } from "@/lib/usg/lmp";

const FIELDS = [
  { key: "bpd", label: "BPD" },
  { key: "hc", label: "HC" },
  { key: "ac", label: "AC" },
  { key: "fl", label: "FL" },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];

export type UsgBiometryCalcProps = {
  /** Scan date (yyyy-mm-dd input value) — anchors the scan-implied EDD. */
  scanDate: string;
  /** Fill the biometry organ's {tokens} — wired by the composer. */
  onFill: (vars: Record<string, string>) => void;
};

const mm = (v: string): number | undefined => {
  const n = Number(v);
  return v.trim() && Number.isFinite(n) && n > 0 ? n / 10 : undefined;
};

export function UsgBiometryCalc({ scanDate, onFill }: UsgBiometryCalcProps) {
  const [vals, setVals] = useState<Record<FieldKey, string>>({ bpd: "", hc: "", ac: "", fl: "" });

  const cm = useMemo(
    () => ({ bpd: mm(vals.bpd), hc: mm(vals.hc), ac: mm(vals.ac), fl: mm(vals.fl) }),
    [vals],
  );

  const per = useMemo(() => perParameterGa(cm), [cm]);
  const ga = useMemo(() => meanGa(cm), [cm]);
  const efw = useMemo(() => hadlockEfw(cm).best, [cm]);

  const edd = useMemo(() => {
    if (!ga) return null;
    const d = scanDate ? new Date(`${scanDate}T12:00:00`) : new Date();
    if (Number.isNaN(d.getTime())) return null;
    return formatEdd(eddFromGa(ga.weeks, ga.days, d));
  }, [ga, scanDate]);

  const set = (k: FieldKey, v: string) => setVals((prev) => ({ ...prev, [k]: v }));

  const fill = () => {
    const out: Record<string, string> = {};
    for (const f of FIELDS) {
      const raw = vals[f.key].trim();
      if (!raw) continue;
      out[f.key] = raw;
      const p = per[f.key];
      if (p) {
        out[`${f.key}w`] = String(p.weeks);
        out[`${f.key}d`] = String(p.days);
      }
    }
    if (ga) {
      out.gaw = String(ga.weeks);
      out.gad = String(ga.days);
      if (edd) out.edd = edd;
    }
    if (efw) {
      out.ewt = String(Math.round(efw.efw));
      out.ewtd = String(efwTolerance(efw.efw));
    }
    if (!Object.keys(out).length) {
      toast.error("Enter at least one biometry measurement first");
      return;
    }
    onFill(out);
    toast.success(
      `Biometry filled${ga ? ` — mean GA ${ga.weeks} wk ${ga.days} d` : ""}${efw ? ` · EFW ≈ ${Math.round(efw.efw)} g` : ""}`,
    );
  };

  const summary = [
    ga ? `GA ${ga.weeks}w ${ga.days}d` : null,
    efw ? `EFW ≈ ${Math.round(efw.efw)} g ± ${efwTolerance(efw.efw)}` : null,
    edd ? `EDD ${edd}` : null,
  ].filter(Boolean);

  return (
    <div className="shrink-0 border-b border-border bg-gradient-to-r from-sky-50/80 to-cyan-50/60 px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <Label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-sky-700">
          <Ruler className="h-3 w-3" /> Hadlock biometry (mm)
        </Label>
        {FIELDS.map((f) => (
          <label key={f.key} className="flex items-center gap-1">
            <span className="text-[10px] font-semibold uppercase text-sky-600">{f.label}</span>
            <Input
              value={vals[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
              inputMode="decimal"
              placeholder="—"
              className="h-8 w-[64px] border-sky-200 bg-white text-[12px]"
              title={`${f.label} in millimetres`}
            />
          </label>
        ))}
        <Button
          size="sm"
          variant="outline"
          onClick={fill}
          className="h-8 border-sky-300 bg-white text-[11px] font-semibold text-sky-700 hover:bg-sky-50"
          title="Fill the biometry slots in the report format"
        >
          Fill biometry
        </Button>
        {summary.length ? (
          <span className="rounded-full bg-white px-3 py-1 text-[11.5px] font-bold text-sky-800 ring-1 ring-sky-200">
            {summary.join(" · ")}
          </span>
        ) : (
          <span className="text-[11px] text-sky-500">
            enter measurements — GA, EFW &amp; EDD (Hadlock) auto-fill into the format
          </span>
        )}
      </div>
      {per.bpd || per.hc || per.ac || per.fl ? (
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[10.5px] font-medium text-sky-600">
          {FIELDS.map((f) =>
            per[f.key] ? (
              <span key={f.key}>
                {f.label}: {per[f.key]!.weeks}w {per[f.key]!.days}d
              </span>
            ) : null,
          )}
          {ga ? <span className={cn("font-bold")}>mean: {ga.formula}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
