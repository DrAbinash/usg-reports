"use client";
/**
 * Bedside clinical calculators — one dialog, five tools:
 * ovarian/ellipsoid volume, bladder volume + post-void residual, prostate
 * volume, ACR TI-RADS 2017 thyroid scoring, and AFI. Results copy to the
 * clipboard so any value can land in any finding slot.
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Calculator, Copy, Droplets } from "lucide-react";
import {
  afiCategory, afiTotal, bladderVolume, ellipsoidVolume, postVoidResidual, prostateVolume,
  tiradsScore, type TiradsComposition, type TiradsEchogenicity, type TiradsFocus,
  type TiradsMargin, type TiradsShape,
} from "@/lib/usg/calc";

const num = (v: string): number | undefined => {
  const n = Number(v);
  return v.trim() && Number.isFinite(n) && n > 0 ? n : undefined;
};

const copy = (text: string, what: string) => {
  void navigator.clipboard?.writeText(text).then(
    () => toast.success(`${what} copied`),
    () => toast.error("Clipboard unavailable"),
  );
};

function Result({ text, tone, onCopy }: { text: string; tone?: "ok" | "warn" | "bad"; onCopy: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "rounded-lg px-2.5 py-1 text-[12.5px] font-bold ring-1",
          tone === "ok" && "bg-emerald-50 text-emerald-800 ring-emerald-200",
          tone === "warn" && "bg-amber-50 text-amber-800 ring-amber-200",
          tone === "bad" && "bg-rose-50 text-rose-800 ring-rose-200",
          !tone && "bg-sky-50 text-sky-800 ring-sky-200",
        )}
      >
        {text}
      </span>
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onCopy} title="Copy result">
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function TripleInput({
  labels, values, onChange,
}: {
  labels: [string, string, string];
  values: [string, string, string];
  onChange: (i: number, v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {labels.map((l, i) => (
        <label key={i} className="flex items-center gap-1">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground">{l}</span>
          <Input
            value={values[i]}
            onChange={(e) => onChange(i, e.target.value)}
            inputMode="decimal"
            placeholder="cm"
            className="h-8 w-[70px] border-border bg-panel text-[12px]"
          />
        </label>
      ))}
    </div>
  );
}

export function UsgCalculators() {
  // Ellipsoid (ovary / mass)
  const [ov, setOv] = useState<[string, string, string]>(["", "", ""]);
  const [ovLabel, setOvLabel] = useState("Right ovary");

  // Bladder + PVR
  const [pre, setPre] = useState<[string, string, string]>(["", "", ""]);
  const [post, setPost] = useState<[string, string, string]>(["", "", ""]);

  // Prostate
  const [pr, setPr] = useState<[string, string, string]>(["", "", ""]);

  // TI-RADS
  const [composition, setComposition] = useState<TiradsComposition>("solid");
  const [echogenicity, setEchogenicity] = useState<TiradsEchogenicity>("isoechoic");
  const [shape, setShape] = useState<TiradsShape>("wider");
  const [margin, setMargin] = useState<TiradsMargin>("smooth_or_illdefined");
  const [foci, setFoci] = useState<TiradsFocus[]>([]);
  const [sizeMm, setSizeMm] = useState("");

  // AFI
  const [quad, setQuad] = useState<[string, string, string, string]>(["", "", "", ""]);

  const ovVol = useMemo(() => {
    const [a, b, c] = ov.map(num);
    return a && b && c ? ellipsoidVolume(a, b, c) : null;
  }, [ov]);

  const preVol = useMemo(() => {
    const [a, b, c] = pre.map(num);
    return a && b && c ? bladderVolume(a, b, c) : null;
  }, [pre]);

  const pvr = useMemo(() => {
    const [a, b, c] = post.map(num);
    return a && b && c ? postVoidResidual(a, b, c) : null;
  }, [post]);

  const prVol = useMemo(() => {
    const [a, b, c] = pr.map(num);
    return a && b && c ? prostateVolume(a, b, c) : null;
  }, [pr]);

  const tirads = useMemo(
    () => tiradsScore({ composition, echogenicity, shape, margin, foci, sizeMm: num(sizeMm) }),
    [composition, echogenicity, shape, margin, foci, sizeMm],
  );

  const afi = useMemo(() => {
    const [a, b, c, d] = quad.map(num);
    return a != null && b != null && c != null && d != null ? afiTotal(a, b, c, d) : null;
  }, [quad]);

  const afiCat = afi != null ? afiCategory(afi) : null;

  const FOCI_OPTIONS: { key: TiradsFocus; label: string; points: number }[] = [
    { key: "comet_tail", label: "Comet-tail artefacts", points: 0 },
    { key: "macrocalcification", label: "Macrocalcifications", points: 1 },
    { key: "rim_calcification", label: "Peripheral (rim) calcification", points: 2 },
    { key: "punctate", label: "Punctate echogenic foci", points: 3 },
  ];

  const sel = (
    value: string, onValue: (v: string) => void, options: { value: string; label: string }[],
  ) => (
    <Select value={value} onValueChange={onValue}>
      <SelectTrigger className="h-8 border-border bg-panel text-[11.5px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-[11.5px]">{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1 rounded-full border border-border bg-panel px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground">
          <Calculator className="h-3 w-3" /> Calculators
        </button>
      </DialogTrigger>
      <DialogContent className="studio-scroll max-h-[85vh] gap-4 overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Clinical calculators</DialogTitle>
          <DialogDescription className="text-[11.5px]">
            Volumes, TI-RADS 2017 and AFI — results copy to the clipboard for any finding slot.
          </DialogDescription>
        </DialogHeader>

        {/* Volumes */}
        <section className="space-y-3 rounded-xl border border-border bg-card p-3.5">
          <h3 className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
            Ellipsoid volume (0.523 × D1 × D2 × D3)
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={ovLabel}
              onChange={(e) => setOvLabel(e.target.value)}
              className="h-8 w-[130px] border-border bg-panel text-[11.5px]"
              title="Label used when copying"
            />
            <TripleInput labels={["D1", "D2", "D3"]} values={ov} onChange={(i, v) => setOv((p) => p.map((x, j) => (j === i ? v : x)) as [string, string, string])} />
            {ovVol != null ? (
              <Result
                text={`${ovVol.toFixed(1)} cc`}
                onCopy={() => copy(`${ovLabel} volume: ${ovVol.toFixed(1)} cc`, "Volume")}
              />
            ) : null}
          </div>

          <h3 className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
            Bladder volume (0.52 × L × W × H) — post-void residual
          </h3>
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-[64px] text-[11px] font-semibold text-muted-foreground">Pre-void</span>
              <TripleInput labels={["L", "W", "H"]} values={pre} onChange={(i, v) => setPre((p) => p.map((x, j) => (j === i ? v : x)) as [string, string, string])} />
              {preVol != null ? <Result text={`Pre ${preVol.toFixed(1)} cc`} onCopy={() => copy(`Pre-void bladder volume: ${preVol.toFixed(1)} cc`, "Pre-void volume")} /> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-[64px] text-[11px] font-semibold text-muted-foreground">Post-void</span>
              <TripleInput labels={["L", "W", "H"]} values={post} onChange={(i, v) => setPost((p) => p.map((x, j) => (j === i ? v : x)) as [string, string, string])} />
              {pvr != null ? (
                <Result
                  text={`PVR ${pvr.toFixed(1)} cc`}
                  tone={pvr > 100 ? "warn" : "ok"}
                  onCopy={() => copy(`Post-void residual urine: ${pvr.toFixed(1)} cc`, "PVR")}
                />
              ) : null}
            </div>
            {pvr != null && pvr > 100 ? (
              <p className="text-[10.5px] font-medium text-amber-700">
                PVR &gt; 100 cc is significant — consider urinary retention / outflow obstruction.
              </p>
            ) : null}
          </div>

          <h3 className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
            Prostate volume (TRUS, 0.52 × L × W × H)
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <TripleInput labels={["L", "W", "H"]} values={pr} onChange={(i, v) => setPr((p) => p.map((x, j) => (j === i ? v : x)) as [string, string, string])} />
            {prVol != null ? (
              <Result
                text={`${prVol.toFixed(1)} cc${prVol > 30 ? " (enlarged)" : ""}`}
                tone={prVol > 30 ? "warn" : "ok"}
                onCopy={() => copy(`Prostate volume: ${prVol.toFixed(1)} cc`, "Prostate volume")}
              />
            ) : null}
          </div>
        </section>

        {/* TI-RADS */}
        <section className="space-y-2.5 rounded-xl border border-border bg-card p-3.5">
          <h3 className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
            ACR TI-RADS 2017 — thyroid nodule
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label className="text-[10px] uppercase text-muted-foreground">Composition</Label>
              {sel(
                composition,
                (v) => setComposition(v as TiradsComposition),
                [
                  { value: "cystic", label: "Cystic / spongiform (TR1)" },
                  { value: "mixed", label: "Mixed cystic-solid" },
                  { value: "solid", label: "Solid" },
                ],
              )}
            </div>
            <div className="grid gap-1">
              <Label className="text-[10px] uppercase text-muted-foreground">Echogenicity</Label>
              {sel(
                echogenicity,
                (v) => setEchogenicity(v as TiradsEchogenicity),
                [
                  { value: "anechoic", label: "Anechoic" },
                  { value: "hyperechoic_or_mixed", label: "Hyperechoic / mixed" },
                  { value: "isoechoic", label: "Isoechoic" },
                  { value: "hypoechoic", label: "Hypoechoic" },
                ],
              )}
            </div>
            <div className="grid gap-1">
              <Label className="text-[10px] uppercase text-muted-foreground">Shape</Label>
              {sel(shape, (v) => setShape(v as TiradsShape), [
                { value: "wider", label: "Wider than tall" },
                { value: "taller", label: "Taller than wide (+3)" },
              ])}
            </div>
            <div className="grid gap-1">
              <Label className="text-[10px] uppercase text-muted-foreground">Margin</Label>
              {sel(
                margin,
                (v) => setMargin(v as TiradsMargin),
                [
                  { value: "smooth_or_illdefined", label: "Smooth / ill-defined" },
                  { value: "lobulated_or_irregular", label: "Lobulated / irregular (+2)" },
                  { value: "extra_thyroidal", label: "Extra-thyroidal extension (+3)" },
                ],
              )}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground">Echogenic foci (all that apply)</Label>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {FOCI_OPTIONS.map((f) => (
                <label key={f.key} className="flex items-center gap-2 text-[11.5px]">
                  <Checkbox
                    checked={foci.includes(f.key)}
                    onCheckedChange={(v) =>
                      setFoci((prev) => (v ? [...prev, f.key] : prev.filter((k) => k !== f.key)))
                    }
                  />
                  {f.label}
                  <span className="text-[10px] font-semibold text-faint">+{f.points}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">Size</span>
              <Input
                value={sizeMm}
                onChange={(e) => setSizeMm(e.target.value)}
                inputMode="decimal"
                placeholder="mm"
                className="h-8 w-[70px] border-border bg-panel text-[12px]"
              />
            </label>
            <Result
              text={`${tirads.category} · ${tirads.label} (${tirads.points} pts)`}
              tone={tirads.category === "TR5" ? "bad" : tirads.category === "TR4" ? "warn" : "ok"}
              onCopy={() => copy(`ACR TI-RADS ${tirads.category} (${tirads.label})`, "TI-RADS")}
            />
          </div>
          <p className="rounded-lg bg-panel px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground">
            {tirads.guidance}
          </p>
        </section>

        {/* AFI */}
        <section className="space-y-2 rounded-xl border border-border bg-card p-3.5">
          <h3 className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
            <Droplets className="h-3.5 w-3.5" /> Amniotic fluid index
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {quad.map((q, i) => (
              <label key={i} className="flex items-center gap-1">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">Q{i + 1}</span>
                <Input
                  value={q}
                  onChange={(e) => setQuad((p) => p.map((x, j) => (j === i ? e.target.value : x)) as [string, string, string, string])}
                  inputMode="decimal"
                  placeholder="cm"
                  className="h-8 w-[60px] border-border bg-panel text-[12px]"
                />
              </label>
            ))}
            {afi != null ? (
              <Result
                text={`AFI ${afi} cm — ${afiCat?.label}`}
                tone={afiCat?.abnormal ? "bad" : "ok"}
                onCopy={() => copy(`Liquor AFI ${afi} cm.`, "AFI line")}
              />
            ) : null}
          </div>
          <p className="text-[10.5px] text-faint">
            Normal 8–18 cm · &lt; 5 oligohydramnios · &gt; 25 polyhydramnios.
          </p>
        </section>
      </DialogContent>
    </Dialog>
  );
}
