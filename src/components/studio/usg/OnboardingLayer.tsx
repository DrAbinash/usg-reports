"use client";
/**
 * First-run delight layer — one centred card on first login combining the
 * setup checklist + welcome actions + tour launch; plus the self-fetching
 * first-report confetti. Print tip lives on StickyActionBar with Save/Print.
 * Fixed overlay = zero layout risk; everything dismissible forever.
 */
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, X, Waves, ClipboardList, HelpCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/lib/store";
import { GuidedTour } from "./GuidedTour";
import { FirstReportConfetti } from "./FirstReportConfetti";

export function OnboardingLayer() {
  const { setView } = useStudio();
  const [settings, setSettings] = useState<any>(null);
  const [modal, setModal] = useState(false);
  const [tour, setTour] = useState(false);

  useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem("care-usg-onboarded") === "1"; } catch {}
    fetch("/api/settings").then(r => r.json()).then(d => {
      setSettings(d?.settings ?? {});
      if (!seen) setModal(true);
    }).catch(() => {});
  }, []);

  const close = () => { try { localStorage.setItem("care-usg-onboarded", "1"); } catch {} setModal(false); };

  const items = settings ? [
    { label: "Sonologist name + registration", done: !!(settings.usgDoctorName && settings.usgDoctorRegNo), hint: "Settings → USG Studio" },
    { label: "Hospital logo uploaded", done: !!settings.logoUrl, hint: "Settings → Hospital" },
    { label: "Scanned signature uploaded", done: !!settings.usgSignatureUrl, hint: "Settings → USG Studio" },
    { label: "Letterhead address + phone", done: !!(settings.addressLine && settings.phone), hint: "Settings → Hospital" },
  ] : [];
  const done = items.filter(i => i.done).length;

  return (
    <>
      {modal && (
        <div className="fixed inset-0 z-[64] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-fuchsia-200 bg-card shadow-2xl">
            <div className="h-1.5 bg-gradient-to-r from-rose-500 via-fuchsia-500 to-violet-500" />
            <div className="p-6">
              <div className="mb-1 flex items-center gap-2 text-[11px] font-bold text-fuchsia-700"><Sparkles className="h-3.5 w-3.5" /> WELCOME TO YOUR STUDIO</div>
              <h2 className="text-lg font-bold text-slate-900">Everything is ready when these four are ✓</h2>
              <div className="mt-3 mb-4 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-gradient-to-r from-rose-500 to-violet-500 transition-all" style={{ width: `${(done / 4) * 100}%` }} /></div>
              <ul className="mb-5 space-y-1.5">
                {items.map(i => (
                  <li key={i.label} className="flex items-center gap-2 text-xs">
                    {i.done ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-amber-400" />}
                    <span className={i.done ? "text-slate-500 line-through" : "font-medium text-slate-800"}>{i.label}</span>
                    {!i.done && <span className="text-amber-600">→ {i.hint}</span>}
                  </li>
                ))}
              </ul>
              <div className="grid grid-cols-3 gap-2">
                <Button onClick={() => { close(); setView("usg"); }} className="flex h-16 flex-col gap-1 bg-gradient-to-br from-rose-500 to-fuchsia-500 text-white"><Waves className="h-5 w-5" /><span className="text-[11px] font-bold">First report</span></Button>
                <Button onClick={() => { close(); setView("worklist"); }} variant="outline" className="flex h-16 flex-col gap-1"><ClipboardList className="h-5 w-5 text-sky-700" /><span className="text-[11px] font-bold">Worklist</span></Button>
                <Button onClick={() => { close(); setTour(true); }} variant="outline" className="flex h-16 flex-col gap-1"><HelpCircle className="h-5 w-5 text-violet-700" /><span className="text-[11px] font-bold">60-sec tour</span></Button>
              </div>
              <button onClick={close} className="mt-3 w-full text-center text-[11px] text-slate-400 hover:text-slate-600">I know my way around — dismiss forever</button>
            </div>
            <button onClick={close} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}
      {tour && <GuidedTour onClose={() => setTour(false)} />}
      <FirstReportConfetti />
    </>
  );
}
