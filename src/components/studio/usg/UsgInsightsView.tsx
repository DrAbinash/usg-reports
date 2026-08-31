"use client";
/**
 * Insights — the practice at a glance (v5 phase 8): monthly scan volume,
 * study mix, most frequent pathologies and top referral sources. Counts
 * only — no patient names anywhere on this screen.
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BarChart3, Loader2, RefreshCw, Stethoscope, TrendingUp, UserRound, Activity } from "lucide-react";
import type { UsgAnalytics } from "@/lib/usg/analytics";

export function UsgInsightsView() {
  const [analytics, setAnalytics] = useState<UsgAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/usg/analytics?months=12");
      if (!res.ok) throw new Error("Could not load insights");
      const d = (await res.json()) as { analytics: UsgAnalytics };
      setAnalytics(d.analytics);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load insights");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []); // initial mount only — load is a plain closure over setters

  if (loading && !analytics) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading insights…
      </div>
    );
  }
  if (!analytics) return null;

  const maxMonth = Math.max(1, ...analytics.perMonth.map((m) => m.count));
  const maxStudy = Math.max(1, ...analytics.byStudy.map((s) => s.count));
  const maxPath = Math.max(1, ...analytics.topPathologies.map((p) => p.count));
  const thisMonth = analytics.perMonth[analytics.perMonth.length - 1]?.count ?? 0;
  const lastMonth = analytics.perMonth[analytics.perMonth.length - 2]?.count ?? 0;
  const delta = thisMonth - lastMonth;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      {/* KPI strip */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-rose-500 p-5 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div className="leading-tight">
            <h1 className="text-lg font-extrabold tracking-tight">Insights</h1>
            <p className="text-[12px] font-medium text-white/85">Caseload, study mix and findings — counts only, no names</p>
          </div>
          <Button
            onClick={load}
            disabled={loading}
            className="ml-auto h-9 bg-white text-violet-700 shadow hover:bg-white/90"
          >
            <RefreshCw className={cn("mr-1.5 h-4 w-4", loading && "animate-spin")} /> Refresh
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Finalized reports" value={analytics.totalFinalized} icon={<Stethoscope className="h-3.5 w-3.5" />} />
          <Kpi label="Patients" value={analytics.patients} icon={<UserRound className="h-3.5 w-3.5" />} />
          <Kpi label="This month" value={thisMonth} icon={<Activity className="h-3.5 w-3.5" />} />
          <Kpi
            label="vs last month"
            value={delta === 0 ? "—" : `${delta > 0 ? "+" : ""}${delta}`}
            icon={<TrendingUp className="h-3.5 w-3.5" />}
          />
        </div>
      </div>

      {/* Monthly volume */}
      <Card title="Monthly scan volume" hint="finalized reports per month (last 12)">
        <div className="flex h-40 items-end gap-1.5">
          {analytics.perMonth.map((m) => (
            <div key={m.ym} className="group relative flex h-full flex-1 flex-col justify-end" title={`${m.label}: ${m.count}`}>
              <div
                className="w-full rounded-t-md bg-gradient-to-t from-violet-500 to-fuchsia-400 transition-opacity group-hover:opacity-80"
                style={{ height: `${Math.max(m.count ? 6 : 1, (m.count / maxMonth) * 100)}%` }}
              />
              <span className="mt-1 truncate text-center text-[8.5px] font-semibold text-faint">{m.label}</span>
              {m.count ? (
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[9px] font-bold text-violet-600 opacity-0 group-hover:opacity-100">
                  {m.count}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Study mix */}
        <Card title="Study mix" hint="which scans the clinic actually does">
          {analytics.byStudy.length === 0 ? (
            <Empty text="No finalized reports yet." />
          ) : (
            <div className="space-y-1.5">
              {analytics.byStudy.slice(0, 10).map((s) => (
                <Bar key={s.key} label={s.label} count={s.count} pct={(s.count / maxStudy) * 100} tone="rose" />
              ))}
            </div>
          )}
        </Card>

        {/* Pathology frequency */}
        <Card title="Most frequent findings" hint="quick-select pathology chips on finalized reports">
          {analytics.topPathologies.length === 0 ? (
            <Empty text="All finalized reports were normal scans." />
          ) : (
            <div className="space-y-1.5">
              {analytics.topPathologies.slice(0, 10).map((p) => (
                <Bar key={p.key} label={p.label} count={p.count} pct={(p.count / maxPath) * 100} tone="violet" />
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Referrers */}
      <Card title="Top referral sources" hint="doctors whose patients keep coming back">
        {analytics.topReferrers.length === 0 ? (
          <Empty text="No referring doctors recorded yet." />
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {analytics.topReferrers.map((r, i) => (
              <div key={r.key} className="flex items-center gap-2.5 rounded-lg border border-border bg-panel px-3 py-2">
                <span className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold",
                  i === 0 ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground",
                )}>
                  {i + 1}
                </span>
                <span className="truncate text-[12.5px] font-semibold">{r.label}</span>
                <span className="ml-auto text-[11px] font-bold text-muted-foreground">{r.count}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Kpi({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2 backdrop-blur">
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-white/75">
        {icon} {label}
      </p>
      <p className="mt-0.5 text-xl font-extrabold">{value}</p>
    </div>
  );
}

function Card({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-[12.5px] font-bold">{title}</p>
      <p className="mb-3 mt-0.5 text-[10.5px] text-faint">{hint}</p>
      {children}
    </div>
  );
}

function Bar({ label, count, pct, tone }: { label: string; count: number; pct: number; tone: "rose" | "violet" }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[46%] truncate text-right text-[11px] font-semibold text-foreground" title={label}>{label}</span>
      <div className="h-4 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", tone === "rose" ? "bg-gradient-to-r from-rose-500 to-fuchsia-400" : "bg-gradient-to-r from-violet-500 to-fuchsia-400")}
          style={{ width: `${Math.max(pct, count ? 3 : 0)}%` }}
        />
      </div>
      <span className="w-6 text-[11px] font-bold text-muted-foreground">{count}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-border bg-panel px-3 py-4 text-center text-[11.5px] text-faint">{text}</p>;
}
