import { useState, useMemo, useEffect, useRef } from "react";

type Patient = {
  id: string;
  name: string;
  age?: string;
  sex?: string;
  studyDate?: string;
  study?: string;
  referrer?: string;
  status?: string;
};

type Props = {
  patients: Patient[];
  onSelect: (patientId: string) => void;
  currentPatientId?: string | null;
};

type RangeKey = "today" | "yesterday" | "week" | "month" | "all";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "all", label: "All" },
];

function inRange(dateStr: string | undefined, range: RangeKey): boolean {
  if (!dateStr || range === "all") return true;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return true;
  const now = new Date();
  const startOfDay = (dt: Date) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const today = startOfDay(now);
  const patientDay = startOfDay(d);
  const diffDays = Math.floor((today.getTime() - patientDay.getTime()) / 86400000);
  if (range === "today") return diffDays === 0;
  if (range === "yesterday") return diffDays === 1;
  if (range === "week") return diffDays >= 0 && diffDays <= 6;
  if (range === "month") return diffDays >= 0 && diffDays <= 30;
  return true;
}

export function UsgQuickSelect({ patients, onSelect, currentPatientId }: Props) {
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<RangeKey>("today");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return patients.filter((p) => {
      if (!inRange(p.studyDate, range)) return false;
      if (!q) return true;
      return (
        (p.name || "").toLowerCase().includes(q) ||
        (p.study || "").toLowerCase().includes(q) ||
        (p.referrer || "").toLowerCase().includes(q) ||
        (p.id || "").toLowerCase().includes(q)
      );
    }).slice(0, 30);
  }, [patients, query, range]);

  const rangeCounts = useMemo(() => {
    const counts: Record<RangeKey, number> = { today: 0, yesterday: 0, week: 0, month: 0, all: patients.length };
    for (const p of patients) {
      if (inRange(p.studyDate, "today")) counts.today++;
      if (inRange(p.studyDate, "yesterday")) counts.yesterday++;
      if (inRange(p.studyDate, "week")) counts.week++;
      if (inRange(p.studyDate, "month")) counts.month++;
    }
    return counts;
  }, [patients]);

  return (
    <div ref={ref} className="relative rounded-xl border-2 border-indigo-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="rounded-md bg-indigo-600 px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide text-white shadow-sm">
          Find patient
        </span>
        <div className="flex flex-1 items-center gap-2 rounded-lg border-2 border-slate-300 bg-slate-50 px-3 py-2">
          <svg className="h-4 w-4 text-slate-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Search by name, study, referrer, or ID…"
            className="flex-1 bg-transparent text-[14px] font-medium outline-none placeholder:text-slate-400"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="text-[16px] font-bold text-slate-500 hover:text-black">×</button>
          )}
        </div>
        <div className="flex items-center gap-1.5" role="tablist" aria-label="Patient date range">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              role="tab"
              aria-selected={range === r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-full border-2 px-3 py-1.5 text-[13px] font-bold transition shadow-sm ${
                range === r.key
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-slate-300 bg-white text-slate-800 hover:border-indigo-300 hover:bg-indigo-50"
              }`}
            >
              {r.label}
              <span className="ml-1 opacity-80">({rangeCounts[r.key]})</span>
            </button>
          ))}
        </div>
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-y-auto rounded-lg border border-border bg-white shadow-xl">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-faint">
              No patients match. Try widening the date range or changing the search.
            </div>
          ) : (
            <ul>
              {filtered.map((p) => {
                const isCurrent = p.id === currentPatientId;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => { onSelect(p.id); setOpen(false); setQuery(""); }}
                      className={`w-full border-b border-border/50 px-4 py-2.5 text-left transition hover:bg-indigo-50 ${
                        isCurrent ? "bg-indigo-50" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-semibold text-[13px]">{p.name || "Unnamed"}</span>
                            {isCurrent && (
                              <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[9px] font-bold text-white">OPEN</span>
                            )}
                          </div>
                          <div className="mt-0.5 truncate text-[11px] text-faint">
                            {[p.age && `${p.age}${p.sex ? ` / ${p.sex}` : ""}`, p.study, p.referrer && `Ref: ${p.referrer}`]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] font-semibold">{p.studyDate || "—"}</div>
                          {p.status && (
                            <div className="mt-0.5 text-[9px] font-bold uppercase text-faint">{p.status}</div>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
