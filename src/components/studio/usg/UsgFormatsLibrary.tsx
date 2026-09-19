import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, X } from "lucide-react";
import { toast } from "sonner";
import type { UsgOrganState } from "@/lib/usg/types";

type Format = { file: string; modality: string; title: string; text: string };

export function UsgFormatsLibrary({ organs, onApply }: {
  organs: UsgOrganState[];
  onApply: (next: UsgOrganState[], impression: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Format[]>([]);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch("/formats-index.json");
      const { templates } = await r.json();
      setData(templates.filter((t: Format) => t.modality === "USG"));
    } catch { toast.error("Failed to load formats library"); }
    finally { setLoading(false); }
  };

  const apply = (f: Format) => {
    const text = f.text ?? "";
    const headers = ["LIVER", "G. B", "PANCREAS", "SPLEEN", "RT KIDNEY", "LT KIDNEY", "UTERUS", "ADNEXA", "P.O.D", "OTHERS", "IMPRESSION"];
    const keyMap: Record<string, string> = {
      "LIVER": "liver", "G. B": "gb", "PANCREAS": "pancreas", "SPLEEN": "spleen",
      "RT KIDNEY": "rt_kidney", "LT KIDNEY": "lt_kidney", "UTERUS": "uterus",
      "ADNEXA": "adnexa", "P.O.D": "pod", "OTHERS": "others",
    };
    const findings: Record<string, string> = {};
    let impression: string | null = null;
    const lines = text.split(/\n/);
    let cur = "", curTxt = "";
    const save = () => {
      if (cur) {
        const clean = curTxt.replace(/\s+/g, " ").trim();
        if (cur === "IMPRESSION") impression = clean;
        else if (keyMap[cur]) findings[keyMap[cur]] = clean;
      }
    };
    for (const line of lines) {
      const t = line.trim().toUpperCase();
      if (headers.includes(t)) { save(); cur = t; curTxt = ""; }
      else curTxt += line + "\n";
    }
    save();

    const next = organs.map((o) => {
      if (findings[o.organ]) return { ...o, text: findings[o.organ] };
      return o;
    });
    onApply(next, impression);
    setOpen(false);
    toast.success(`Applied: ${f.title}`);
  };

  const filtered = data.filter((f) => {
    const q = search.toLowerCase();
    return !q || f.title.toLowerCase().includes(q) || f.text.toLowerCase().includes(q);
  });

  return (
    <>
      <Button onClick={() => { setOpen(true); if (!data.length) load(); }} variant="outline" size="sm" className="border-border text-[11px]">
        <BookOpen className="mr-1 h-3 w-3" />
        Formats Library ({data.length || "..."})
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-lg bg-card shadow-2xl flex flex-col">
            <div className="border-b border-border p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-lg font-bold">USG Formats Library</h2>
                <Button onClick={() => setOpen(false)} variant="ghost" size="sm"><X className="h-4 w-4" /></Button>
              </div>
              <Input placeholder="Search formats (e.g. fatty liver, PCOD, fibroid)…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 text-[13px]" />
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div> : (
                <div className="space-y-2">
                  {filtered.slice(0, 100).map((f, i) => (
                    <button key={i} onClick={() => apply(f)} className="w-full rounded-md border border-border bg-panel p-3 text-left transition-colors hover:bg-accent">
                      <div className="mb-1 text-[13px] font-semibold">{f.title}</div>
                      <div className="line-clamp-2 text-[11px] text-muted-foreground">{f.text.slice(0, 300)}</div>
                    </button>
                  ))}
                  {filtered.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">No formats match.</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
