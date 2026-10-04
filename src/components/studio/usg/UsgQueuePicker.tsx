"use client";
/**
 * Compact patient + study jump picker (CARE RadiologyReportingWorkspace pattern).
 * Lets the sonographer switch cases from Studio without bouncing to Worklist.
 * Date range defaults to today; patient select sits beside study select.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useStudio } from "@/lib/store";
import { toLocalDateString } from "@/lib/usg/dates";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type QueueOrder = {
  id: string;
  accessionNumber: string | null;
  careWorklistId: string | null;
  patientName: string;
  patientAge: string;
  patientSex: string;
  patientPhone: string;
  testName: string;
  status: string;
  ignored: boolean;
  studyDate: string | null;
  reportId: string | null;
  referringDoctor: string;
};

type WorklistResponse = {
  orders: QueueOrder[];
  error?: string;
};

function patientKey(o: Pick<QueueOrder, "patientName" | "patientPhone" | "patientSex">): string {
  const phone = (o.patientPhone || "").replace(/\D/g, "");
  const name = (o.patientName || "").trim().toLowerCase();
  return phone ? `p:${phone}` : `n:${name}|${o.patientSex || ""}`;
}

function stampShort(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(o: QueueOrder): string {
  if (o.status === "REPORTED") return "done";
  if (o.status === "REPORTING" || o.reportId) return "draft";
  return "pending";
}

async function fetchWorklistRange(from: string, to: string): Promise<WorklistResponse> {
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  const res = await fetch(`/api/usg/worklist?${qs.toString()}`);
  if (!res.ok) throw new Error(`worklist ${res.status}`);
  const body = (await res.json()) as WorklistResponse;
  if (body.error) throw new Error(body.error);
  return body;
}

type Props = {
  /** Compact chrome for the pink header while composing. */
  compact?: boolean;
  className?: string;
  /** Currently open report id (highlight / skip re-open). */
  currentReportId?: string | null;
};

export function UsgQueuePicker({ compact = false, className, currentReportId }: Props) {
  const openComposer = useStudio((s) => s.openComposer);
  const queryClient = useQueryClient();
  const today = useMemo(() => toLocalDateString(), []);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [patientId, setPatientId] = useState("");
  const [opening, setOpening] = useState(false);

  const worklistQ = useQuery({
    queryKey: ["usg", "worklist", from, to],
    queryFn: () => fetchWorklistRange(from, to),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  // The workstation clock is not authoritative. dates.ts documents why — a PC
  // set to the wrong year silently empties the "Today" filter — and the worklist
  // waits for the server's clinicToday because of it, but this picker seeded
  // itself from the browser, so on a mis-set machine it showed "No studies in
  // range" for a clinic full of patients. Adopt the server's date as soon as it
  // is heard, and only while the range is still the one we guessed with, so a
  // date the doctor chose himself is never overwritten.
  const serverToday = (worklistQ.data as { clinicToday?: string } | undefined)?.clinicToday;
  useEffect(() => {
    if (!serverToday || serverToday === today) return;
    setFrom((f) => (f === today ? serverToday : f));
    setTo((t) => (t === today ? serverToday : t));
  }, [serverToday, today]);

  const orders = useMemo(
    () => (worklistQ.data?.orders ?? []).filter((o) => !o.ignored),
    [worklistQ.data],
  );

  const patients = useMemo(() => {
    const map = new Map<string, { key: string; name: string; age: string; sex: string; count: number; pending: number }>();
    for (const o of orders) {
      const key = patientKey(o);
      const prev = map.get(key);
      if (prev) {
        prev.count += 1;
        if (o.status !== "REPORTED") prev.pending += 1;
      } else {
        map.set(key, {
          key,
          name: o.patientName || "Unnamed",
          age: o.patientAge || "",
          sex: o.patientSex || "",
          count: 1,
          pending: o.status !== "REPORTED" ? 1 : 0,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.pending !== b.pending) return b.pending - a.pending;
      return a.name.localeCompare(b.name);
    });
  }, [orders]);

  // Drop stale patient filter when the date range changes.
  useEffect(() => {
    if (patientId && !patients.some((p) => p.key === patientId)) {
      setPatientId("");
    }
  }, [patients, patientId]);

  const studies = useMemo(() => {
    const list = patientId ? orders.filter((o) => patientKey(o) === patientId) : orders;
    return [...list].sort((a, b) => {
      const ap = a.status === "REPORTED" ? 1 : 0;
      const bp = b.status === "REPORTED" ? 1 : 0;
      if (ap !== bp) return ap - bp;
      return (b.studyDate ?? "").localeCompare(a.studyDate ?? "");
    });
  }, [orders, patientId]);

  const prefetchReport = useCallback(
    (id: string | null | undefined) => {
      if (!id) return;
      void queryClient.prefetchQuery({
        queryKey: ["usg", "report", id],
        queryFn: async () => {
          const res = await fetch(`/api/usg/reports/${id}`);
          if (!res.ok) throw new Error("report");
          return res.json();
        },
        staleTime: 60_000,
      });
    },
    [queryClient],
  );

  useEffect(() => {
    for (const o of studies.slice(0, 25)) prefetchReport(o.reportId);
  }, [studies, prefetchReport]);

  const openOrder = useCallback(
    async (orderId: string) => {
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;
      if (order.reportId && order.reportId === currentReportId) {
        toast.message("Already open");
        return;
      }
      setOpening(true);
      try {
        if (order.reportId) {
          prefetchReport(order.reportId);
          openComposer(order.reportId);
          return;
        }
        const r = await fetch(`/api/usg/worklist/${order.id}/start`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        }).then((x) => x.json() as Promise<{ report?: { id: string }; error?: string } | null>);
        if (!r || r.error || !r.report?.id) {
          toast.error(r?.error ?? "Could not start the report");
          return;
        }
        void queryClient.invalidateQueries({ queryKey: ["usg", "worklist"] });
        openComposer(r.report.id);
      } catch {
        toast.error("Could not open the study");
      } finally {
        setOpening(false);
      }
    },
    [orders, currentReportId, openComposer, prefetchReport, queryClient],
  );

  // A patient with exactly one study in range needs no dropdown trip — open it.
  // Once per patient selection, so stepping back out to the list does not
  // bounce the doctor straight back in.
  const autoOpenedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!patientId) return;
    if (studies.length !== 1) {
      autoOpenedKeyRef.current = null;
      return;
    }
    if (worklistQ.isLoading || opening) return;
    const only = studies[0];
    const key = `${patientId}|${only.id}`;
    if (autoOpenedKeyRef.current === key) return;
    autoOpenedKeyRef.current = key;
    if (only.reportId && only.reportId === currentReportId) return;
    void openOrder(only.id);
  }, [patientId, studies, currentReportId, opening, worklistQ.isLoading, openOrder]);

  const inputCls = compact
    ? "h-7 rounded-md border border-border bg-background px-1.5 text-[10px]"
    : "h-8 rounded-md border border-border bg-background px-2 text-[12px]";

  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-1.5",
        compact ? "shrink-0" : "rounded-xl border border-indigo-200 bg-white px-3 py-2 shadow-sm",
        className,
      )}
      data-testid="usg-queue-picker"
    >
      {!compact ? (
        <span className="rounded-md bg-indigo-600 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
          Select patient
        </span>
      ) : null}

      <label className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
        <span className="shrink-0">From</span>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value || today)}
          className={cn(inputCls, compact ? "w-[7.25rem]" : "w-[8.5rem]")}
          aria-label="From date"
          data-testid="queue-from"
        />
      </label>
      <label className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
        <span className="shrink-0">To</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value || today)}
          className={cn(inputCls, compact ? "w-[7.25rem]" : "w-[8.5rem]")}
          aria-label="To date"
          data-testid="queue-to"
        />
      </label>

      <select
        className={cn(inputCls, compact ? "min-w-[8rem] max-w-[11rem]" : "min-w-[11rem] max-w-[16rem] flex-1")}
        value={patientId}
        onChange={(e) => setPatientId(e.target.value)}
        aria-label="Select patient"
        data-testid="queue-patient"
        disabled={worklistQ.isLoading || opening}
      >
        <option value="">
          {worklistQ.isLoading
            ? "Loading patients…"
            : `All patients (${patients.length})`}
        </option>
        {patients.map((p) => (
          <option key={p.key} value={p.key}>
            {p.name}
            {p.age ? ` · ${p.age}` : ""}
            {p.sex ? `/${p.sex}` : ""}
            {p.pending ? ` · ${p.pending} open` : ""}
          </option>
        ))}
      </select>

      <select
        className={cn(inputCls, compact ? "min-w-[9rem] max-w-[14rem]" : "min-w-[14rem] max-w-[22rem] flex-1")}
        value=""
        onChange={(e) => {
          const id = e.target.value;
          if (id) void openOrder(id);
        }}
        onFocus={() => {
          for (const o of studies.slice(0, 10)) prefetchReport(o.reportId);
        }}
        aria-label="Select study"
        data-testid="queue-study"
        disabled={worklistQ.isLoading || opening || studies.length === 0}
      >
        <option value="">
          {opening
            ? "Opening…"
            : worklistQ.isLoading
              ? "Loading studies…"
              : studies.length === 0
                ? from && to
                  ? `Nothing between ${from} and ${to} — widen the dates or press Sync`
                  : "No studies loaded — press Sync"
                : `Select study (${studies.length})`}
        </option>
        {studies.map((o) => {
          const open = o.reportId && o.reportId === currentReportId;
          const time = stampShort(o.studyDate);
          const acc = o.accessionNumber || (o.careWorklistId ? `WL ${o.careWorklistId}` : "");
          return (
            <option key={o.id} value={o.id} disabled={!!open}>
              {o.patientName}
              {" · "}
              {/* Age/sex and phone are the only reliable way to tell two "Rina
                  Kumari" rows apart before the study is open. */}
              {o.patientAge || o.patientSex ? `${o.patientAge || "?"}${o.patientSex === "M" ? "M" : o.patientSex === "F" ? "F" : ""} · ` : ""}
              {o.testName || "USG"}
              {time ? ` · ${time}` : ""}
              {acc ? ` · ${acc}` : ""}
              {o.patientPhone ? ` · ${o.patientPhone}` : ""}
              {" · "}
              {open ? "OPEN" : statusLabel(o)}
            </option>
          );
        })}
      </select>

      {(worklistQ.isFetching || opening) && (
        <Loader2 className={cn("animate-spin text-indigo-600", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
      )}
    </div>
  );
}
