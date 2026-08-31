"use client";
/**
 * USG Studio — Dr Sugandha's sonography reporting home.
 * List mode: saved reports with search + status filter.
 * Composer mode: organ-based whole-abdomen reporting with live preview.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FileText, Loader2, Plus, Printer, RotateCcw, Search, Trash2, Waves } from "lucide-react";
import type { UsgPathologyDef } from "@/lib/usg/types";
import type { UsgPrintSettings } from "@/lib/usg/print";
import { UsgComposer, type UsgReportRow } from "./UsgComposer";

const EMPTY_SETTINGS: UsgPrintSettings = {
  appTitle: "CARE Reporting Studio",
  hospitalName: "",
  addressLine: "",
  phone: "",
  email: "",
  logoUrl: "",
  footerMessage: "",
  usgDoctorName: "",
  usgDoctorQual: "",
  usgDoctorRegNo: "",
  usgMachineLine: "This Scan has been proudly done on GE Voluson Pro 4-D USG Machine",
  usgShowMachine: true,
  usgFooterLine: "Kindly co-relate with clinico-pathological findings.",
  usgDeclarationLine: "",
};

export function UsgStudioView() {
  const [pathologies, setPathologies] = useState<UsgPathologyDef[]>([]);
  const [settings, setSettings] = useState<UsgPrintSettings>(EMPTY_SETTINGS);
  const [reports, setReports] = useState<UsgReportRow[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "DRAFT" | "FINALIZED">("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<UsgReportRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [reprintHtml, setReprintHtml] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const [pRes, sRes, rRes] = await Promise.all([
      fetch("/api/usg/pathologies"),
      fetch("/api/settings"),
      fetch("/api/usg/reports"),
    ]);
    if (pRes.ok) setPathologies(((await pRes.json()).pathologies ?? []) as UsgPathologyDef[]);
    if (sRes.ok) {
      const s = (await sRes.json()).settings ?? {};
      setSettings({
        appTitle: s.appTitle ?? "",
        hospitalName: s.hospitalName ?? "",
        addressLine: s.addressLine ?? "",
        phone: s.phone ?? "",
        email: s.email ?? "",
        logoUrl: s.logoUrl ?? "",
        footerMessage: s.footerMessage ?? "",
        usgDoctorName: s.usgDoctorName ?? "",
        usgDoctorQual: s.usgDoctorQual ?? "",
        usgDoctorRegNo: s.usgDoctorRegNo ?? "",
        usgMachineLine: s.usgMachineLine ?? "",
        usgShowMachine: s.usgShowMachine !== false,
        usgFooterLine: s.usgFooterLine ?? "",
        usgDeclarationLine: s.usgDeclarationLine ?? "",
      });
    }
    if (rRes.ok) setReports(((await rRes.json()).reports ?? []) as UsgReportRow[]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await loadAll();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAll]);

  const refreshReports = useCallback(async () => {
    const res = await fetch("/api/usg/reports");
    if (res.ok) setReports(((await res.json()).reports ?? []) as UsgReportRow[]);
  }, []);

  const openReport = async (row: UsgReportRow) => {
    if (row.status === "FINALIZED") {
      // Finalized = frozen snapshot: open the reprint view.
      setEditing(row);
      setCreating(false);
      const res = await fetch(`/api/usg/reports/${row.id}`);
      if (res.ok) {
        const fresh = (await res.json()).report as UsgReportRow;
        setReprintHtml(fresh.reportHtml ?? "");
      }
    } else {
      setReprintHtml(null);
      setEditing(row);
      setCreating(false);
    }
  };

  const del = async (row: UsgReportRow) => {
    if (!confirm(`Delete ${row.patientName}'s USG report? This cannot be undone.`)) return;
    const res = await fetch(`/api/usg/reports/${row.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Report deleted");
      refreshReports();
    } else {
      toast.error("Delete failed");
    }
  };

  const composerMode = creating || editing !== null;

  const filtered = useMemo(
    () =>
      reports.filter((r) => {
        if (statusFilter && r.status !== statusFilter) return false;
        if (!query.trim()) return true;
        const q = query.trim().toLowerCase();
        return (
          r.patientName.toLowerCase().includes(q) ||
          (r.studyTitle ?? "").toLowerCase().includes(q) ||
          r.referredBy.toLowerCase().includes(q) ||
          (r.impression ?? "").toLowerCase().includes(q)
        );
      }),
    [reports, query, statusFilter],
  );

  const counts = useMemo(
    () => ({
      total: reports.length,
      finalized: reports.filter((r) => r.status === "FINALIZED").length,
    }),
    [reports],
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading USG studio…
      </div>
    );
  }

  if (composerMode) {
    return (
      <div className="h-full">
        <UsgComposer
          pathologies={pathologies}
          settings={settings}
          report={editing}
          onBack={() => {
            setEditing(null);
            setCreating(false);
            setReprintHtml(null);
            refreshReports();
          }}
          onSaved={() => {
            loadAll();
          }}
        />
        {reprintHtml ? (
          <ReprintOverlay
            html={reprintHtml}
            onClose={() => {
              setReprintHtml(null);
              setEditing(null);
            }}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      {/* Hero strip */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose-600 via-pink-600 to-fuchsia-600 p-5 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <Waves className="h-6 w-6" />
          </div>
          <div className="leading-tight">
            <h1 className="text-lg font-extrabold tracking-tight">USG Studio</h1>
            <p className="text-[12px] font-medium text-white/85">
              Organ-wise reporting — normal base, one-tap pathology swap, auto impression
            </p>
          </div>
          <Button
            onClick={() => setCreating(true)}
            className="ml-auto h-10 bg-white text-rose-700 shadow hover:bg-white/90"
          >
            <Plus className="mr-1.5 h-4 w-4" /> New Report
          </Button>
        </div>
        <div className="mt-3 flex gap-4 text-[11px] font-semibold text-white/80">
          <span>{counts.total} reports</span>
          <span>{counts.finalized} finalized</span>
          <span>{pathologies.length} quick-select findings</span>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search patient, study, doctor, impression…"
            className="h-9 border-border bg-panel pl-8 text-[13px]"
          />
        </div>
        {(["", "DRAFT", "FINALIZED"] as const).map((s) => (
          <button
            key={s || "all"}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors",
              statusFilter === s
                ? "border-rose-300 bg-rose-50 text-rose-700"
                : "border-border bg-panel text-muted-foreground hover:text-foreground",
            )}
          >
            {s === "" ? "All" : s === "DRAFT" ? "Drafts" : "Finalized"}
          </button>
        ))}
      </div>

      {/* Reports */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <FileText className="mx-auto mb-2 h-8 w-8 text-faint" />
          <p className="text-[13px] font-semibold text-muted-foreground">No USG reports yet</p>
          <p className="mt-1 text-[12px] text-faint">
            Start a whole-abdomen report — pick pathologies per organ, print on the clinic letterhead.
          </p>
          <Button onClick={() => setCreating(true)} className="mt-4 h-9 bg-rose-600 hover:bg-rose-700">
            <Plus className="mr-1.5 h-4 w-4" /> New Report
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="group flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm transition-colors hover:border-rose-200 hover:shadow"
              onClick={() => openReport(r)}
            >
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold",
                  r.status === "FINALIZED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
                )}
              >
                {r.patientSex === "M" ? "M" : "F"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-bold">{r.patientName}</span>
                  <span className="text-[11px] text-faint">
                    {r.patientAge ? `${r.patientAge} yrs` : ""} {r.referredBy ? `· ${r.referredBy}` : ""}
                  </span>
                </div>
                <p className="truncate text-[11.5px] text-muted-foreground">{r.studyTitle || r.studyKey}</p>
              </div>
              <p className="hidden max-w-[240px] truncate text-[11px] text-faint md:block">
                {r.impression?.split("\n")[0] || "—"}
              </p>
              <Badge
                variant="outline"
                className={cn(
                  "h-5 shrink-0 px-1.5 text-[9px] font-bold",
                  r.status === "FINALIZED"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700",
                )}
              >
                {r.status === "FINALIZED" ? "FINAL" : "DRAFT"}
              </Badge>
              <span className="shrink-0 text-[10px] text-faint">
                {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-faint opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  del(r);
                }}
                title="Delete report"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Finalized report = frozen snapshot view + reprint. */
function ReprintOverlay({ html, onClose }: { html: string; onClose: () => void }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur">
      <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-2.5">
        <span className="text-[13px] font-bold">Finalized report — frozen snapshot</span>
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            className="h-8 bg-rose-600 hover:bg-rose-700"
            onClick={() => {
              const win = frameRef.current?.contentWindow;
              if (win) {
                win.focus();
                win.print();
              }
            }}
          >
            <Printer className="mr-1.5 h-4 w-4" /> Print
          </Button>
          <Button size="sm" variant="outline" className="h-8" onClick={onClose}>
            <RotateCcw className="mr-1.5 h-4 w-4" /> Back
          </Button>
        </div>
      </div>
      <iframe ref={frameRef} title="finalized-report" srcDoc={html} className="min-h-0 flex-1 bg-white" />
    </div>
  );
}
