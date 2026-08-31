"use client";
/**
 * USG Studio — Dr Sugandha's sonography reporting home.
 * List mode: saved reports with search + status filter.
 * Patients mode: the registry — every patient with her scans, last visit and
 * a one-click "New scan" that prefills her details (patient history view).
 * Composer mode: organ-based whole-abdomen reporting with live preview.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FileText, Loader2, Phone, Plus, Printer, RotateCcw, Search, Stethoscope, Trash2, Users, Waves, Repeat, History } from "lucide-react";
import type { UsgPathologyDef } from "@/lib/usg/types";
import type { UsgPrintSettings } from "@/lib/usg/print";
import { formatUsgSerial } from "@/lib/usg/print";
import { UsgComposer, type UsgReportRow } from "./UsgComposer";
import type { DiffSource } from "./UsgDiffPanel";

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
  usgPrintStyle: "premium",
  usgPrintCompact: false,
  usgPrintPaper: "a4",
  usgSignatureUrl: "",
};

type PatientRow = {
  id: string;
  name: string;
  phone: string;
  notes: string;
  scanCount: number;
  lastScanAt: string | null;
};

type ComposerPrefill = {
  patientName?: string;
  patientPhone?: string;
  patientAge?: string;
  patientSex?: string;
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
  const [prefill, setPrefill] = useState<ComposerPrefill | null>(null);
  const [diffSource, setDiffSource] = useState<DiffSource | null>(null);

  // Registry (Patients mode)
  const [mode, setMode] = useState<"reports" | "patients">("reports");
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [patientQuery, setPatientQuery] = useState("");
  const [patientDetail, setPatientDetail] = useState<
    (PatientRow & { reports: UsgReportRow[] }) | null
  >(null);

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
        usgPrintStyle: s.usgPrintStyle ?? "premium",
        usgPrintCompact: s.usgPrintCompact === true || s.usgPrintCompact === "true",
        usgPrintPaper: s.usgPrintPaper ?? "a4",
        usgSignatureUrl: s.usgSignatureUrl ?? "",
      });
    }
    if (rRes.ok) setReports(((await rRes.json()).reports ?? []) as UsgReportRow[]);
  }, []);

  const loadPatients = useCallback(async () => {
    const res = await fetch("/api/usg/patients");
    if (res.ok) setPatients(((await res.json()).patients ?? []) as PatientRow[]);
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

  useEffect(() => {
    if (mode !== "patients") return;
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/usg/patients");
      if (!res.ok || cancelled) return;
      const d = await res.json();
      if (!cancelled) setPatients((d.patients ?? []) as PatientRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const refreshReports = useCallback(async () => {
    const res = await fetch("/api/usg/reports");
    if (res.ok) setReports(((await res.json()).reports ?? []) as UsgReportRow[]);
  }, []);

  const openReport = async (row: UsgReportRow) => {
    setEditing(row);
    setCreating(false);
    setPrefill(null);
    // Always fetch the full row — patient phone + attached stills live on it.
    const res = await fetch(`/api/usg/reports/${row.id}`);
    if (res.ok) {
      const fresh = (await res.json()).report as UsgReportRow;
      setEditing({ ...row, ...fresh });
      if (fresh.status === "FINALIZED") setReprintHtml(fresh.reportHtml ?? "");
      else setReprintHtml(null);
    } else {
      setReprintHtml(null);
    }
  };

  const del = async (row: UsgReportRow) => {
    if (!confirm(`Delete ${row.patientName}'s USG report? This cannot be undone.`)) return;
    const res = await fetch(`/api/usg/reports/${row.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Report deleted");
      refreshReports();
      if (patientDetail) void openPatient(patientDetail.id, true);
    } else {
      toast.error("Delete failed");
    }
  };

  /** Follow-up — duplicate any report as a fresh editable draft (same patient,
   *  study and composer state) for the repeat scan. The previous scan travels
   *  with the draft so the composer can show the “Δ vs previous” panel. */
  const duplicate = async (row: UsgReportRow) => {
    const res = await fetch(`/api/usg/reports/${row.id}/duplicate`, { method: "POST" });
    if (!res.ok) {
      toast.error("Could not create the follow-up draft");
      return;
    }
    const { report, source } = (await res.json()) as {
      report: UsgReportRow;
      source: { id: string; serialNo?: number | null; scanDate: string } | null;
    };
    toast.success(`Follow-up draft created for ${report.patientName}`);
    setReprintHtml(null);
    setEditing({ ...report, patient: row.patient ?? null });
    setCreating(false);
    setPrefill(null);
    if (source) {
      // Fetch the frozen snapshot (stateJson + impression column) for the diff.
      const prev = await fetch(`/api/usg/reports/${source.id}`);
      if (prev.ok) {
        const p = (await prev.json()).report as UsgReportRow;
        setDiffSource({
          id: source.id,
          serial: source.serialNo != null ? formatUsgSerial(source.serialNo) : undefined,
          date: new Date(source.scanDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
          stateJson: p.stateJson,
          impression: p.impression ?? "",
        });
      }
    }
  };

  const openPatient = useCallback(async (id: string, force = false) => {
    const res = await fetch(`/api/usg/patients/${id}`);
    if (!res.ok) {
      toast.error("Could not open this patient");
      return;
    }
    const p = (await res.json()).patient as PatientRow & { reports: UsgReportRow[] };
    setPatientDetail(p);
    if (force) setMode("patients");
  }, []);

  /** New scan for a patient — prefill name/phone (age & sex from her last
   *  report so the strip is one-glance ready) and jump into the composer. */
  const newScanFor = (p: PatientRow & { reports?: UsgReportRow[] }) => {
    const last = p.reports?.[0];
    setPrefill({
      patientName: p.name,
      patientPhone: p.phone,
      patientAge: last?.patientAge ?? "",
      patientSex: last?.patientSex ?? "F",
    });
    setPatientDetail(null);
    setEditing(null);
    setCreating(true);
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

  const filteredPatients = useMemo(() => {
    if (!patientQuery.trim()) return patients;
    const q = patientQuery.trim().toLowerCase();
    return patients.filter((p) => p.name.toLowerCase().includes(q) || p.phone.includes(q));
  }, [patients, patientQuery]);

  const counts = useMemo(
    () => ({
      total: reports.length,
      finalized: reports.filter((r) => r.status === "FINALIZED").length,
      patients: patients.length,
    }),
    [reports, patients],
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
          prefill={prefill}
          diffSource={diffSource}
          onBack={() => {
            setEditing(null);
            setCreating(false);
            setReprintHtml(null);
            setPrefill(null);
            setDiffSource(null);
            refreshReports();
            if (mode === "patients") void loadPatients();
          }}
          onSaved={() => {
            loadAll();
            loadPatients();
          }}
        />
        {reprintHtml ? (
          <ReprintOverlay
            html={reprintHtml}
            serial={editing?.serialNo != null ? formatUsgSerial(editing.serialNo) : undefined}
            onClose={() => {
              setReprintHtml(null);
              setEditing(null);
            }}
            onFollowUp={() => editing && duplicate(editing)}
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
            onClick={() => {
              setPrefill(null);
              setCreating(true);
            }}
            className="ml-auto h-10 bg-white text-rose-700 shadow hover:bg-white/90"
          >
            <Plus className="mr-1.5 h-4 w-4" /> New Report
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-[11px] font-semibold text-white/80">
          <span>{counts.total} reports</span>
          <span>{counts.finalized} finalized</span>
          <span>{counts.patients} patients</span>
          <span>{pathologies.length} quick-select findings</span>
        </div>
      </div>

      {/* Reports ↔ Patients mode switch */}
      <div className="flex items-center gap-2">
        <div className="flex rounded-full border border-border bg-panel p-1">
          {(
            [
              { id: "reports", label: "Reports", icon: FileText },
              { id: "patients", label: "Patients", icon: Users },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setMode(m.id);
                setPatientDetail(null);
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-semibold transition-colors",
                mode === m.id ? "bg-card text-rose-700 shadow-sm ring-1 ring-rose-200" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <m.icon className="h-3.5 w-3.5" />
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {mode === "patients" ? (
        patientDetail ? (
          <PatientHistory
            patient={patientDetail}
            onBack={() => setPatientDetail(null)}
            onNewScan={() => newScanFor(patientDetail)}
            onOpenReport={openReport}
            onDuplicate={duplicate}
            onDelete={del}
          />
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
              <Input
                value={patientQuery}
                onChange={(e) => setPatientQuery(e.target.value)}
                placeholder="Search patient name or phone…"
                className="h-9 border-border bg-panel pl-8 text-[13px]"
              />
            </div>
            {filteredPatients.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
                <Users className="mx-auto mb-2 h-8 w-8 text-faint" />
                <p className="text-[13px] font-semibold text-muted-foreground">No patients yet</p>
                <p className="mt-1 text-[12px] text-faint">
                  Patients appear here automatically once a report is saved with a name — add a phone
                  number to link repeat scans into one history.
                </p>
              </div>
            ) : (
              filteredPatients.map((p) => (
                <div
                  key={p.id}
                  className="group flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm transition-colors hover:border-rose-200 hover:shadow"
                  onClick={() => openPatient(p.id)}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-[11px] font-bold text-rose-700">
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-bold">{p.name}</span>
                      {p.scanCount > 1 ? (
                        <span className="shrink-0 rounded bg-sky-50 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-sky-700 ring-1 ring-sky-100">
                          {p.scanCount} scans
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      {p.phone ? (
                        <>
                          <Phone className="h-3 w-3" /> {p.phone}
                        </>
                      ) : (
                        <span className="text-faint">no phone on file</span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] text-faint">
                    {p.lastScanAt
                      ? new Date(p.lastScanAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                      : "never scanned"}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 border-rose-200 bg-rose-50 px-2 text-[11px] text-rose-700 opacity-0 transition-opacity hover:bg-rose-100 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      newScanFor(p);
                    }}
                    title="Start a new scan prefilled with her details"
                  >
                    <Plus className="mr-1 h-3 w-3" /> New scan
                  </Button>
                </div>
              ))
            )}
          </div>
        )
      ) : (
        <>
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
              <Button
                onClick={() => {
                  setPrefill(null);
                  setCreating(true);
                }}
                className="mt-4 h-9 bg-rose-600 hover:bg-rose-700"
              >
                <Plus className="mr-1.5 h-4 w-4" /> New Report
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((r) => (
                <ReportCard key={r.id} r={r} onOpen={() => openReport(r)} onDuplicate={() => duplicate(r)} onDelete={() => del(r)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** One report row — shared by the reports list and the patient history. */
function ReportCard({
  r,
  onOpen,
  onDuplicate,
  onDelete,
}: {
  r: UsgReportRow;
  onOpen: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="group flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm transition-colors hover:border-rose-200 hover:shadow"
      onClick={onOpen}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold",
          r.status === "FINALIZED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
        )}
      >
        {r.patientSex === "M" ? "M" : r.patientSex === "CHILD" ? "C" : "F"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] font-bold">{r.patientName}</span>
          {r.serialNo != null ? (
            <span className="shrink-0 rounded bg-sky-50 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-sky-700 ring-1 ring-sky-100">
              {formatUsgSerial(r.serialNo)}
            </span>
          ) : null}
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
        {new Date(r.scanDate ?? r.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 text-faint opacity-0 transition-opacity hover:text-sky-600 group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onDuplicate();
        }}
        title="Duplicate as a follow-up draft for the repeat scan"
      >
        <Repeat className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 text-faint opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title="Delete report"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

/** Patient history — every scan of one person, newest first. */
function PatientHistory({
  patient,
  onBack,
  onNewScan,
  onOpenReport,
  onDuplicate,
  onDelete,
}: {
  patient: PatientRow & { reports: UsgReportRow[] };
  onBack: () => void;
  onNewScan: () => void;
  onOpenReport: (r: UsgReportRow) => void;
  onDuplicate: (r: UsgReportRow) => void;
  onDelete: (r: UsgReportRow) => void;
}) {
  const finalized = patient.reports.filter((r) => r.status === "FINALIZED");
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8 px-2 text-muted-foreground">
          <RotateCcw className="h-4 w-4" />
        </Button>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-[13px] font-bold text-rose-700">
          {patient.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-extrabold tracking-tight">{patient.name}</h2>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
            {patient.phone ? (
              <span className="flex items-center gap-1 font-semibold">
                <Phone className="h-3 w-3" /> {patient.phone}
              </span>
            ) : null}
            <span className="flex items-center gap-1">
              <History className="h-3 w-3" /> {patient.reports.length} scan{patient.reports.length !== 1 ? "s" : ""} ·{" "}
              {finalized.length} finalized
            </span>
            <span>
              last visit{" "}
              {patient.reports[0]
                ? new Date(patient.reports[0].scanDate ?? patient.reports[0].createdAt).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : "—"}
            </span>
          </div>
          {patient.notes ? <p className="mt-1 text-[11.5px] text-faint">{patient.notes}</p> : null}
        </div>
        <Button onClick={onNewScan} className="h-9 bg-rose-600 hover:bg-rose-700">
          <Plus className="mr-1.5 h-4 w-4" /> New scan
        </Button>
      </div>

      {patient.reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <Stethoscope className="mx-auto mb-2 h-7 w-7 text-faint" />
          <p className="text-[12.5px] font-semibold text-muted-foreground">No scans recorded yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {patient.reports.map((r) => (
            <ReportCard key={r.id} r={r} onOpen={() => onOpenReport(r)} onDuplicate={() => onDuplicate(r)} onDelete={() => onDelete(r)} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Finalized report = frozen snapshot view + reprint + follow-up. */
function ReprintOverlay({
  html,
  serial,
  onClose,
  onFollowUp,
}: {
  html: string;
  serial?: string;
  onClose: () => void;
  onFollowUp: () => void;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur">
      <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-2.5">
        <span className="text-[13px] font-bold">Finalized report{serial ? ` — ${serial}` : ""}</span>
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
            onClick={onFollowUp}
            title="Duplicate this report as an editable draft for the repeat scan"
          >
            <Repeat className="mr-1.5 h-4 w-4" /> Follow-up scan
          </Button>
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
