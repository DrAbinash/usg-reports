"use client";
/** Celebrates USG-0001 once ever — self-fetching, no props needed. */
import { useEffect, useState } from "react";

export function FirstReportConfetti() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (localStorage.getItem("care-usg-first-report-celebrated") === "1") return;
        const d = await fetch("/api/usg/reports").then(r => r.json());
        const rows = d?.reports ?? d ?? [];
        const first = Array.isArray(rows) && rows.some((r: any) => r.status === "FINALIZED" && Number(r.serialNo) === 1);
        if (!alive || !first) return;
        localStorage.setItem("care-usg-first-report-celebrated", "1");
        setShow(true);
        setTimeout(() => setShow(false), 5000);
      } catch {}
    })();
    return () => { alive = false; };
  }, []);
  if (!show) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[80] overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="animate-bounce rounded-2xl bg-gradient-to-br from-rose-500 to-fuchsia-500 px-8 py-5 text-center shadow-2xl">
          <div className="text-2xl font-bold text-white">🎉 Her first signed report!</div>
          <div className="mt-1 text-sm text-white/90">USG-0001 — the register begins</div>
        </div>
      </div>
      {Array.from({ length: 36 }).map((_, i) => (
        <span key={i} className="absolute h-2 w-2 rounded-full" style={{ left: `${(i * 97) % 100}%`, top: "-16px", backgroundColor: ["#ec4899", "#8b5cf6", "#06b6d4", "#f59e0b"][i % 4], animation: `usgfall 4.5s linear forwards`, animationDelay: `${(i % 10) * 0.12}s` }} />
      ))}
      <style>{`@keyframes usgfall { to { transform: translateY(105vh) rotate(360deg); opacity: 0; } }`}</style>
    </div>
  );
}
