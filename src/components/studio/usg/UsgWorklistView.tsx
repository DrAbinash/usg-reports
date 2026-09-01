"use client";
/**
 * UsgWorklistView — the bill desk, distilled for the sonographer.
 *
 * Every ultrasound the ERP bills lands here after a sync (CARE bridge) with
 * its demographics already attached; Orthanc-arrived studies carry a PACS
 * chip. "Start report" opens the composer pre-filled; "Form F" opens the
 * statutory form pre-populated. Reported rows stay for the day's record.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useStudio } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SectionLabel } from "../bits";
import { UsgFormFDialog, type FormFDefaults, type FormFOrderLite } from "./UsgFormFDialog";
import { Search, RefreshCw, ChevronRight, Hourglass, CheckCircle2, EyeOff, ScanLine, FileCheck2, CloudOff, Link2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Order = FormFOrderLite & {
  id: string;
  patientSex: string;
  modality: string;
  studyInstanceUid: string | null;
  billingStatus: string | null;
  status: string;
  ignored: boolean;
  reportId: string | null;
  formFId: string | null;
  careSyncedAt: string | null;
};

type SyncStats = {
  careRowsReceived?: number;
  ultrasoundRowsReceived?: number;
  imported?: number;
  updatedExisting?: number;
  skippedNoName?: number;
  skippedMissingIdentity?: number;
  errors?: number;
  matchedByStudyUid?: number;
  matchedByAccession?: number;
  ambiguousMatches?: number;
  awaitingImages?: number;
  unmatchedOrthanc?: number;
  skippedReasons?: string[];
};

type WorklistResponse = {
  orders: Order[];
  syncedAt: string | null;
  careOk: boolean;
  orthancOk: boolean;
  lastError: string | null;
  careConfigured: boolean;
  orthancConfigured: boolean;
};

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function BillingBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const tone =
    status === "PAID"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : status === "DUE"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-sky-50 text-sky-700 ring-sky-200";
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold ring-1", tone)}>{status.replace("_", " ")}</span>;
}

function SexChip({ sex }: { sex: string }) {
  const f = sex === "M";
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold ring-1", f ? "bg-sky-50 text-sky-700 ring-sky-200" : "bg-rose-50 text-rose-700 ring-rose-200")}>
      {sex === "M" ? "M" : "F"}
    </span>
  );
}

function OrderRow({
  order, onClick, action,
}: {
  order: Order;
  onClick?: () => void;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-all",
        onClick && "cursor-pointer hover:border-primary/40 hover:shadow-[0_2px_12px_-4px_rgba(46,109,164,0.25)]",
      )}
      onClick={onClick}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <SexChip sex={order.patientSex} />
          <span className="truncate text-[13px] font-semibold">{order.patientName}</span>
          <span className="shrink-0 text-[11px] text-faint">{order.patientAge || ""}</span>
          {/* Accession when the ERP supplied one; otherwise the bill-desk
              worklist row id — every order shows SOME stable identifier. */}
          {order.accessionNumber ? (
            <span className="hidden shrink-0 font-mono text-[10px] text-faint sm:inline">{order.accessionNumber}</span>
          ) : order.careWorklistId ? (
            <span className="hidden shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500 ring-1 ring-slate-200 sm:inline" title="Bill-desk order (no accession number — ERP identifies it by worklist id)">
              WL {order.careWorklistId}
            </span>
          ) : null}
          {order.studyInstanceUid ? (
            <span className="hidden items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200 md:flex">
              <ScanLine className="h-3 w-3" /> PACS
            </span>
          ) : order.status !== "REPORTED" ? (
            <span className="hidden items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200 md:flex" title="No Orthanc study linked yet — the order stays listed and links automatically once the images arrive">
              <Hourglass className="h-3 w-3" /> Awaiting images
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="truncate">{order.testName || "—"}</span>
          {order.referringDoctor ? <span className="hidden shrink-0 text-faint sm:inline">· {order.referringDoctor}</span> : null}
          {order.studyDate ? <span className="shrink-0 text-faint">· {timeAgo(order.studyDate)}</span> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <BillingBadge status={order.billingStatus} />
        {order.formFId ? (
          <span className="hidden rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200 md:inline">
            Form F
          </span>
        ) : null}
        {action}
        {onClick ? <ChevronRight className="h-4 w-4 text-faint transition-transform group-hover:translate-x-0.5" /> : null}
      </div>
    </div>
  );
}

export function UsgWorklistView() {
  const { openComposer } = useStudio();
  const [data, setData] = useState<WorklistResponse | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [q, setQ] = useState("");
  const [formFOpen, setFormFOpen] = useState(false);
  const [formFOrder, setFormFOrder] = useState<Order | null>(null);
  const [defaults, setDefaults] = useState<FormFDefaults | null>(null);

  const load = useCallback(() => {
    fetch("/api/usg/worklist")
      .then((r) => r.json())
      .then((r: (WorklistResponse & { error?: string }) | null) => {
        if (!r || r.error) return;
        setData(r);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (defaults) return;
    fetch("/api/settings")
      .then((r) => r.json())
      .then((r) => {
        const s = r?.settings;
        if (!s) return;
        setDefaults({
          pcpndtCentreName: s.pcpndtCentreName ?? "",
          pcpndtRegistrationNo: s.pcpndtRegistrationNo ?? "",
          pcpndtPlace: s.pcpndtPlace ?? "",
          usgDoctorName: s.usgDoctorName ?? "",
          usgDoctorQual: s.usgDoctorQual ?? "",
          usgDoctorRegNo: s.usgDoctorRegNo ?? "",
        });
      })
      .catch(() => {});
  }, [defaults]);

  const sync = async () => {
    setSyncing(true);
    const r = await fetch("/api/usg/worklist/sync", { method: "POST" })
      .then((x) => x.json() as Promise<(WorklistResponse & { ok?: boolean; newOrders?: number; stats?: SyncStats }) | null>)
      .catch(() => null);
    setSyncing(false);
    if (r?.ok) {
      if (r.lastError) toast.warning(r.lastError);
      else if (r.careConfigured || r.orthancConfigured) {
        const st = r.stats;
        const skipped = (st?.skippedNoName ?? 0) + (st?.skippedMissingIdentity ?? 0) + (st?.errors ?? 0);
        const bits = [
          `CARE ${r.careOk ? "✓" : "✗"}`,
          `Orthanc ${r.orthancOk ? "✓" : "✗"}`,
          r.newOrders ? `${r.newOrders} new` : "",
          st?.matchedByStudyUid ? `${st.matchedByStudyUid} by UID` : "",
          st?.matchedByAccession ? `${st.matchedByAccession} by accession` : "",
          st?.awaitingImages ? `${st.awaitingImages} awaiting images` : "",
          skipped ? `${skipped} skipped` : "",
        ].filter(Boolean);
        const t = toast.success(`Synced · ${bits.join(" · ")}`);
        if (skipped && st?.skippedReasons?.length) {
          // Safe diagnostics — ids + reasons only, never patient data.
          const reasons = (st.skippedReasons ?? []).slice(0, 3).join("\n");
          setTimeout(() => toast.info(reasons, { duration: 8000 }), 600);
        }
        void t;
      } else {
        toast.info("Not configured — set CARE / Orthanc in Settings → Integrations");
      }
      load();
    } else {
      toast.error("Sync failed");
    }
  };

  const startReport = async (order: Order) => {
    const r = await fetch(`/api/usg/worklist/${order.id}/start`, { method: "POST" })
      .then((x) => x.json())
      .catch(() => null);
    if (!r || r.error) {
      toast.error(r?.error ?? "Could not start the report");
      return;
    }
    load();
    openComposer(r.report.id);
  };

  const ignore = async (order: Order) => {
    await fetch(`/api/usg/worklist/${order.id}/ignore`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ignore: !order.ignored }),
    });
    load();
  };

  const orders = data?.orders ?? [];
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return orders;
    return orders.filter(
      (o) =>
        o.patientName.toLowerCase().includes(needle) ||
        (o.accessionNumber ?? "").toLowerCase().includes(needle) ||
        (o.careWorklistId ?? "").toLowerCase().includes(needle) ||
        (o.testName ?? "").toLowerCase().includes(needle) ||
        (o.referringDoctor ?? "").toLowerCase().includes(needle),
    );
  }, [orders, q]);

  const pending = shown.filter((o) => !o.ignored && (o.status === "PENDING" || o.status === "REPORTING"));
  const reported = shown.filter((o) => !o.ignored && o.status === "REPORTED");
  const hidden = shown.filter((o) => o.ignored);

  const banner = data
    ? data.careConfigured || data.orthancConfigured
      ? data.lastError
        ? { tone: "border-amber-200 bg-amber-50 text-amber-800", text: data.lastError }
        : { tone: "border-emerald-200 bg-emerald-50 text-emerald-800", text: `CARE ${data.careOk ? "connected" : data.careConfigured ? "down" : "off"} · Orthanc ${data.orthancOk ? "connected" : data.orthancConfigured ? "down" : "off"} · synced ${timeAgo(data.syncedAt)}` }
      : { tone: "border-border bg-panel text-muted-foreground", text: "Standalone mode — connect the CARE ERP in Settings → Integrations to pull the bill desk's ultrasound orders here." }
    : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search patient, accession, test, referrer…"
            className="h-10 border-border bg-card pl-9 text-[13px]"
          />
        </div>
        <Button onClick={() => void sync()} disabled={syncing} variant="outline" className="h-10 border-border bg-card text-[13px]">
          <RefreshCw className={cn("mr-2 h-3.5 w-3.5", syncing && "animate-spin")} />
          {syncing ? "Syncing…" : "Sync now"}
        </Button>
      </div>

      {banner ? (
        <div className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-[11.5px]", banner.tone)}>
          {banner.text.includes("Standalone") ? <CloudOff className="h-3.5 w-3.5 shrink-0" /> : <Link2 className="h-3.5 w-3.5 shrink-0" />}
          {banner.text}
        </div>
      ) : null}

      {/* To report */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <SectionLabel>To report · {pending.length}</SectionLabel>
        </div>
        <div className="space-y-2">
          {pending.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card/50 px-3 py-6 text-center text-[12px] text-faint">
              {data?.careConfigured ? "Nothing waiting — the list is clear." : "No orders yet. Sync after configuring the CARE ERP."}
            </div>
          ) : (
            pending.map((o) => (
              <OrderRow
                key={o.id}
                order={o}
                onClick={() => void startReport(o)}
                action={
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 border-rose-200 bg-rose-50 px-2 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFormFOrder(o);
                        setFormFOpen(true);
                      }}
                      title="PC-PNDT Form F — pre-filled from the bill desk"
                    >
                      <FileCheck2 className="mr-1 h-3 w-3" />
                      Form F
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[11px] text-faint hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        void ignore(o);
                      }}
                    >
                      <EyeOff className="mr-1 h-3 w-3" />
                      Ignore
                    </Button>
                  </div>
                }
              />
            ))
          )}
        </div>
      </section>

      {/* Reported */}
      {reported.length > 0 ? (
        <section>
          <div className="mb-2 flex items-center gap-2">
            <Hourglass className="h-4 w-4 text-emerald-600" />
            <SectionLabel>Reported · {reported.length}</SectionLabel>
          </div>
          <div className="space-y-2">
            {reported.slice(0, 10).map((o) => (
              <OrderRow
                key={o.id}
                order={o}
                onClick={() => o.reportId && openComposer(o.reportId)}
                action={
                  o.careSyncedAt ? null : (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200" title="ERP not yet told — retries on every sync">
                      ERP pending
                    </span>
                  )
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      {hidden.length > 0 ? (
        <section>
          <div className="mb-2 flex items-center gap-2">
            <EyeOff className="h-4 w-4 text-faint" />
            <SectionLabel>Ignored · {hidden.length}</SectionLabel>
          </div>
          <div className="space-y-2">
            {hidden.slice(0, 5).map((o) => (
              <OrderRow
                key={o.id}
                order={o}
                action={
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[11px] text-faint hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      void ignore(o);
                    }}
                  >
                    Restore
                  </Button>
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Form F dialog */}
      {defaults ? (
        <UsgFormFDialog
          open={formFOpen}
          onClose={() => setFormFOpen(false)}
          defaults={defaults}
          order={formFOrder}
          onSaved={load}
        />
      ) : null}
    </div>
  );
}
