"use client";
/**
 * UsgFollowUpWidget (v6.9) — "Follow-ups due" widget for the studio home.
 *
 * Surfaces finalized reports whose followUpDate is on/before today (due)
 * or in the next 14 days (upcoming). Lets the radiologist call patients
 * back without manually scanning the report list.
 *
 * Mounted at the top of UsgStudioView (reports list mode) so the doctor
 * sees follow-ups the moment she opens the studio.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Loader2, Phone, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatUsgSerial } from "@/lib/usg/print";

type FollowUpRow = {
  id: string;
  patientName: string;
  studyKey: string;
  studyTitle: string;
  scanDate: string | null;
  followUpDate: string;
  followUpNote: string | null;
  serialNo: number | null;
  referredBy: string;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function daysUntil(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

export type UsgFollowUpWidgetProps = {
  /** v6.10 — when false (the per-clinic toggle is off), the widget renders
   *  nothing. Default true. */
  enabled?: boolean;
};

export function UsgFollowUpWidget({ enabled = true }: UsgFollowUpWidgetProps) {
  const [due, setDue] = useState<FollowUpRow[]>([]);
  const [upcoming, setUpcoming] = useState<FollowUpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [dueRes, upRes] = await Promise.all([
        fetch("/api/usg/follow-ups?status=due"),
        fetch("/api/usg/follow-ups?status=upcoming"),
      ]);
      if (dueRes.ok) {
        const d = (await dueRes.json()) as { reports: FollowUpRow[] };
        setDue(d.reports);
      }
      if (upRes.ok) {
        const u = (await upRes.json()) as { reports: FollowUpRow[] };
        setUpcoming(u.reports);
      }
    } catch (err) {
      toast.error(`Follow-ups load failed — ${(err as Error)?.message ?? "network error"}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (enabled) void load();
    else setLoading(false);
  }, [enabled]);

  // v6.10 — when the toggle is off, render nothing.
  if (enabled === false) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-xs text-amber-700">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading follow-ups…
      </div>
    );
  }

  const total = due.length + upcoming.length;
  if (total === 0 || dismissed) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-amber-600" />
        <h3 className="text-sm font-bold text-amber-900">
          Follow-ups{due.length > 0 ? ` · ${due.length} due today` : ""}
        </h3>
        <button
          onClick={() => setDismissed(true)}
          className="ml-auto rounded-md p-1 text-amber-600 hover:bg-amber-100"
          title="Hide for this session"
          aria-label="Hide follow-ups widget"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-1.5">
        {due.slice(0, 5).map((r) => {
          const days = daysUntil(r.followUpDate);
          return (
            <FollowUpRow
              key={r.id}
              r={r}
              tone="due"
              badge={days === 0 ? "Today" : days < 0 ? `${Math.abs(days)}d overdue` : `Due today`}
            />
          );
        })}
        {upcoming.slice(0, 3).map((r) => {
          const days = daysUntil(r.followUpDate);
          return (
            <FollowUpRow
              key={r.id}
              r={r}
              tone="upcoming"
              badge={`in ${days}d`}
            />
          );
        })}
        {total > 8 ? (
          <p className="text-[10px] text-amber-700">
            +{total - 8} more — see Insights for the full list.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function FollowUpRow({
  r, tone, badge,
}: {
  r: FollowUpRow;
  tone: "due" | "upcoming";
  badge: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-white px-2.5 py-1.5 text-[11px]",
        tone === "due" ? "border-amber-200" : "border-sky-100",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-semibold text-foreground">{r.patientName}</span>
          {r.serialNo != null ? (
            <span className="shrink-0 rounded bg-sky-50 px-1 text-[9px] font-bold text-sky-700 ring-1 ring-sky-100">
              {formatUsgSerial(r.serialNo)}
            </span>
          ) : null}
          <span
            className={cn(
              "shrink-0 rounded px-1 py-0.5 text-[9px] font-bold",
              tone === "due" ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700",
            )}
          >
            {badge}
          </span>
        </div>
        <p className="truncate text-[10px] text-muted-foreground">
          {r.studyTitle || r.studyKey}
          {r.followUpNote ? ` · ${r.followUpNote}` : ""}
          {r.referredBy ? ` · Dr. ${r.referredBy}` : ""}
        </p>
      </div>
      <span className="shrink-0 text-[9px] text-faint">scan {fmtDate(r.scanDate)}</span>
      {r.referredBy ? (
        <Button
          variant="ghost" size="sm"
          className="h-6 w-6 p-0 text-amber-700 hover:bg-amber-100"
          title={`Call referring doctor: ${r.referredBy}`}
          onClick={() => toast.info(`Reminder: contact Dr. ${r.referredBy} about ${r.patientName}'s follow-up`)}
        >
          <Phone className="h-3 w-3" />
        </Button>
      ) : null}
    </div>
  );
}
