"use client";
/**
 * USG Studio — Dr Sugandha's sonography reporting home.
 * List mode: saved reports with search + status filter.
 * Patients mode: the registry — every patient with her scans, last visit and
 * a one-click "New scan" that prefills her details (patient history view).
 * Composer mode: organ-based whole-abdomen reporting with live preview.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UsgQuickSelect } from "./UsgQuickSelect";
import { useStudio } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BookOpen, Download, FileText, Loader2, MessageCircle, Phone, Plus, Printer, RotateCcw, Search, Stethoscope, Trash2, Users, Waves, Repeat, History } from "lucide-react";
import type { UsgPathologyDef } from "@/lib/usg/types";
import type { UsgPrintSettings } from "@/lib/usg/print";
import { formatUsgSerial } from "@/lib/usg/print";
import { normalOverrideKey, type NormalOverrides } from "@/lib/usg/studies";
import type { PathologyWordingOverrides } from "@/lib/usg/triad";
import { UsgComposer, type UsgReportRow, type ReportOrderLite } from "./UsgComposer";
import type { FormFDefaults } from "./UsgFormFDialog";
import type { DiffSource } from "./UsgDiffPanel";
import { shareReportWhatsapp } from "./shareWhatsapp";
import { UsgPacsReturnButton } from "./UsgPacsReturnButton";
import { UsgFollowUpWidget } from "./UsgFollowUpWidget";

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
  referredBy?: string;
};

type SettingsBundle = {
  settings: UsgPrintSettings;
  formFDefaults: FormFDefaults;
};

async function fetchUsgReport(id: string) {
  const res = await fetch(`/api/usg/reports/${id}`);
  if (!res.ok) throw new Error(`report ${res.status}`);
  return (await res.json()) as { report: UsgReportRow; order: ReportOrderLite | null };
}

async function fetchPatientsList() {
  const res = await fetch("/api/usg/patients");
  if (!res.ok) throw new Error("patients");
  return ((await res.json()).patients ?? []) as PatientRow[];
}

async function fetchReportsList() {
  const res = await fetch("/api/usg/reports");
  if (!res.ok) throw new Error("reports");
  return ((await res.json()).reports ?? []) as UsgReportRow[];
}

async function fetchSettingsBundle(): Promise<SettingsBundle> {
  const sRes = await fetch("/api/settings");
  if (!sRes.ok) throw new Error("settings");
  const s = (await sRes.json()).settings ?? {};
  const formFDefaults: FormFDefaults = {
    pcpndtCentreName: s.pcpndtCentreName ?? "",
    pcpndtRegistrationNo: s.pcpndtRegistrationNo ?? "",
    pcpndtPlace: s.pcpndtPlace ?? "",
    usgDoctorName: s.usgDoctorName ?? "",
    usgDoctorQual: s.usgDoctorQual ?? "",
    usgDoctorRegNo: s.usgDoctorRegNo ?? "",
  };
  const settings: UsgPrintSettings = {
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
    usgPrintFontSize: Number(s.usgPrintFontSize) > 0 ? Number(s.usgPrintFontSize) : 10,
    usgPrintLineHeight: Number(s.usgPrintLineHeight) > 0 ? Number(s.usgPrintLineHeight) : 1.4,
    usgPrintSpacing: s.usgPrintSpacing ?? "tight",
    usgPrintShowTechnique: s.usgPrintShowTechnique !== false && s.usgPrintShowTechnique !== "false",
    usgPrintShowThanks: s.usgPrintShowThanks !== false && s.usgPrintShowThanks !== "false",
    enableCriticalComm: s.enableCriticalComm !== false,
    enableFollowUps: s.enableFollowUps !== false,
    enableAiDraft: s.enableAiDraft !== false,
    enableBirads: s.enableBirads !== false,
    enableDicomSr: s.enableDicomSr !== false,
    studyTechniqueDefaults: (s as { studyTechniqueDefaults?: Record<string, string> }).studyTechniqueDefaults ?? {},
    machineLineByStudio: (s as { machineLineByStudio?: Record<string, string> }).machineLineByStudio ?? {},
    studioId: String((s as { clinicId?: string }).clinicId ?? "default"),
  };
  return { settings, formFDefaults };
}

async function fetchNormalsMap(): Promise<NormalOverrides> {
  const nRes = await fetch("/api/usg/normals");
  if (!nRes.ok) throw new Error("normals");
  const rows = ((await nRes.json()).overrides ?? []) as { studyKey: string; organKey: string; text: string }[];
  const map: NormalOverrides = {};
  for (const r of rows) {
    if (r.text.trim()) map[normalOverrideKey(r.studyKey, r.organKey)] = r.text.trim();
  }
  return map;
}

async function fetchPathologyWording(): Promise<PathologyWordingOverrides> {
  const wRes = await fetch("/api/usg/pathology-wording");
  if (!wRes.ok) throw new Error("pathology-wording");
  const body = await wRes.json().catch(() => ({}));
  return {
    impressions: (body.impressions ?? {}) as Record<string, string>,
    advice: (body.advice ?? {}) as Record<string, string>,
  };
}

async function fetchQuickSelectPatients() {
  for (const url of ["/api/usg/worklist", "/api/usg/reports"]) {
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      const d = await r.json();
      const arr: any[] = Array.isArray(d)
        ? d
        : Array.isArray(d?.rows)
          ? d.rows
          : Array.isArray(d?.reports)
            ? d.reports
            : Array.isArray(d?.items)
              ? d.items
              : [];
      if (arr.length) {
        return arr
          .map((x: any) => ({
            id: x.id ?? x.reportId ?? x.worklistId ?? String(x.patientId ?? ""),
            name: x.patientName ?? x.name ?? "",
            age: x.age ?? x.patientAge ?? "",
            sex: x.sex ?? x.patientSex ?? "",
            studyDate: x.scanDate ?? x.studyDate ?? x.date ?? "",
            study: x.studyTitle ?? x.study ?? x.testName ?? "",
            referrer: x.referredBy ?? x.referringDoctor ?? "",
            status: x.status ?? "",
          }))
          .filter((q: any) => q.id);
      }
    } catch {
      /* try next */
    }
  }
  return [] as any[];
}

export function UsgStudioView() {
  const queryClient = useQueryClient();

  const pathologiesQ = useQuery({
    queryKey: ["usg", "pathologies"],
    queryFn: async () => {
      const pRes = await fetch("/api/usg/pathologies");
      if (!pRes.ok) throw new Error("pathologies");
      return ((await pRes.json()).pathologies ?? []) as UsgPathologyDef[];
    },
  });
  const settingsQ = useQuery({
    queryKey: ["usg", "settings"],
    queryFn: fetchSettingsBundle,
  });
  const reportsQ = useQuery({
    queryKey: ["usg", "reports"],
    queryFn: fetchReportsList,
  });
  const normalsQ = useQuery({
    queryKey: ["usg", "normals"],
    queryFn: fetchNormalsMap,
  });
  const pathologyWordingQ = useQuery({
    queryKey: ["usg", "pathology-wording"],
    queryFn: fetchPathologyWording,
  });
  const quickSelectQ = useQuery({
    queryKey: ["usg", "quick-select"],
    queryFn: fetchQuickSelectPatients,
  });

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "DRAFT" | "FINALIZED">("");
  const [editing, setEditing] = useState<UsgReportRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [reprintHtml, setReprintHtml] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<ComposerPrefill | null>(null);
  const [diffSource, setDiffSource] = useState<DiffSource | null>(null);
  const [registerHtml, setRegisterHtml] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [order, setOrder] = useState<ReportOrderLite | null>(null);

  const [mode, setMode] = useState<"reports" | "patients">("reports");
  const [patientQuery, setPatientQuery] = useState("");
  const [patientDetail, setPatientDetail] = useState<
    (PatientRow & { reports: UsgReportRow[] }) | null
  >(null);

  const patientsQ = useQuery({
    queryKey: ["usg", "patients"],
    queryFn: fetchPatientsList,
    enabled: mode === "patients",
  });

  const [deleteTarget, setDeleteTarget] = useState<UsgReportRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const pathologies = pathologiesQ.data ?? [];
  const settings = settingsQ.data?.settings ?? null;
  const formFDefaults = settingsQ.data?.formFDefaults ?? null;
  const reports = reportsQ.data ?? [];
  const normalOverrides = normalsQ.data ?? {};
  const pathologyWording = pathologyWordingQ.data ?? { impressions: {}, advice: {} };
  const patients = patientsQ.data ?? [];
  const quickSelectPatients = quickSelectQ.data ?? [];

  const loading =
    pathologiesQ.isLoading ||
    settingsQ.isLoading ||
    reportsQ.isLoading ||
    normalsQ.isLoading ||
    pathologyWordingQ.isLoading;

  const setPathologyWording = useCallback(
    (next: PathologyWordingOverrides) => {
      queryClient.setQueryData(["usg", "pathology-wording"], next);
    },
    [queryClient],
  );

  const refreshReports = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["usg", "reports"] });
  }, [queryClient]);

  const loadPatients = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["usg", "patients"] });
  }, [queryClient]);

  const loadAll = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["usg", "pathologies"] }),
      queryClient.invalidateQueries({ queryKey: ["usg", "settings"] }),
      queryClient.invalidateQueries({ queryKey: ["usg", "reports"] }),
      queryClient.invalidateQueries({ queryKey: ["usg", "normals"] }),
      queryClient.invalidateQueries({ queryKey: ["usg", "pathology-wording"] }),
    ]);
  }, [queryClient]);

  const prefetchReport = useCallback(
    (id: string) => {
      if (!id) return;
      void queryClient.prefetchQuery({
        queryKey: ["usg", "report", id],
        queryFn: () => fetchUsgReport(id),
      });
    },
    [queryClient],
  );

  useEffect(() => {
    void queryClient.prefetchQuery({
      queryKey: ["usg", "patients"],
      queryFn: fetchPatientsList,
    });
  }, [queryClient]);

  useEffect(() => {
    for (const r of reports.slice(0, 20)) prefetchReport(r.id);
  }, [reports, prefetchReport]);

  const openReportId = useStudio((s) => s.openReportId);
  const clearOpenReport = useStudio((s) => s.clearOpenReport);
  useEffect(() => {
    if (!openReportId || loading) return;
    let alive = true;
    void (async () => {
      try {
        const d = await queryClient.fetchQuery({
          queryKey: ["usg", "report", openReportId],
          queryFn: () => fetchUsgReport(openReportId),
        });
        if (alive) {
          setEditing(d.report);
          setOrder(d.order ?? null);
          setCreating(false);
          setPrefill(null);
          setDiffSource(null);
          setReprintHtml(d.report.status === "FINALIZED" ? d.report.reportHtml ?? "" : null);
        }
      } catch {
        /* ignore */
      }
      clearOpenReport();
    })();
    return () => {
      alive = false;
    };
  }, [openReportId, loading, clearOpenReport, queryClient]);

  const openReport = async (row: UsgReportRow) => {
    setEditing(row);
    setCreating(false);
    setPrefill(null);
    try {
      const d = await queryClient.fetchQuery({
        queryKey: ["usg", "report", row.id],
        queryFn: () => fetchUsgReport(row.id),
      });
      const fresh = d.report;
      setOrder(d.order ?? null);
      setEditing({ ...row, ...fresh });
      if (fresh.status === "FINALIZED") setReprintHtml(fresh.reportHtml ?? "");
      else setReprintHtml(null);
    } catch {
      setOrder(null);
      setReprintHtml(null);
    }
  };

  const del = (row: UsgReportRow) => {
    setDeleteTarget(row);
  };

  const duplicateMutation = useMutation({
    mutationFn: async (row: UsgReportRow) => {
      const res = await fetch(`/api/usg/reports/${row.id}/duplicate`, { method: "POST" });
      if (!res.ok) throw new Error("Could not create the follow-up draft");
      const body = (await res.json()) as {
        report: UsgReportRow;
        source: { id: string; serialNo?: number | null; scanDate: string } | null;
      };
      return { ...body, row };
    },
    onSuccess: async ({ report, source, row }) => {
      toast.success(`Follow-up draft created for ${report.patientName}`);
      await queryClient.invalidateQueries({ queryKey: ["usg", "reports"] });
      setReprintHtml(null);
      setEditing({ ...report, patient: row.patient ?? null });
      setCreating(false);
      setPrefill(null);
      if (source) {
        try {
          const p = (
            await queryClient.fetchQuery({
              queryKey: ["usg", "report", source.id],
              queryFn: () => fetchUsgReport(source.id),
            })
          ).report;
          setDiffSource({
            id: source.id,
            serial: source.serialNo != null ? formatUsgSerial(source.serialNo) : undefined,
            date: new Date(source.scanDate).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            }),
            stateJson: p.stateJson,
            impression: p.impression ?? "",
          });
        } catch {
          /* ignore */
        }
      }
    },
    onError: (err: Error) => toast.error(err.message || "Could not create the follow-up draft"),
  });

  const duplicate = async (row: UsgReportRow) => {
    await duplicateMutation.mutateAsync(row);
  };

  const openPatient = useCallback(
    async (id: string, force = false) => {
      try {
        const p = await queryClient.fetchQuery({
          queryKey: ["usg", "patient", id],
          queryFn: async () => {
            const res = await fetch(`/api/usg/patients/${id}`);
            if (!res.ok) throw new Error("patient");
            return (await res.json()).patient as PatientRow & { reports: UsgReportRow[] };
          },
        });
        setPatientDetail(p);
        if (force) setMode("patients");
      } catch {
        toast.error("Could not open this patient");
      }
    },
    [queryClient],
  );

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/usg/reports/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = new Error(`Delete failed (${res.status})`) as Error & { status: number };
        err.status = res.status;
        throw err;
      }
      return id;
    },
    onSuccess: async () => {
      toast.success("Report deleted");
      await queryClient.invalidateQueries({ queryKey: ["usg", "reports"] });
      if (patientDetail) void openPatient(patientDetail.id, true);
    },
    onError: (err: Error & { status?: number }) => {
      if (err.status === 409) toast.error("Finalized reports cannot be deleted via this action.");
      else toast.error(err.message || "Delete failed");
    },
  });

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const newScanFor = (p: PatientRow & { reports?: UsgReportRow[] }) => {
    const last = p.reports?.[0];
    setPrefill({
      patientName: p.name,
      patientPhone: p.phone,
      patientAge: last?.patientAge ?? "",
      patientSex: last?.patientSex ?? "F",
      referredBy: last?.referredBy ?? "",
    });
    setPatientDetail(null);
    setEditing(null);
    setCreating(true);
  };

  const openRegisterMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/usg/register?format=html");
      if (!res.ok) throw new Error("Could not build the register");
      return await res.text();
    },
    onSuccess: (html) => setRegisterHtml(html),
    onError: (err: Error) => toast.error(err.message || "Could not build the register"),
  });

  const openRegister = async () => {
    await openRegisterMutation.mutateAsync();
  };

  const composerMode = creating || editing !== null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || composerMode) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (mode === "patients" && patientDetail) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });


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
        <div className="px-4 pt-3">
          <UsgQuickSelect
            patients={quickSelectPatients}
            currentPatientId={null}
            onSelect={(pid) => void openReport({ id: pid } as UsgReportRow)}
          />
        </div>
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading USG studio…
      </div>
    );
  }

  if (composerMode) {
    if (!settings) {
      // Audit #15 — the studio cannot render the composer without settings
      // (the live preview needs the letterhead for first paint). Show a
      // minimal loader instead of a flash of unstyled/empty preview.
      return (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading studio…
        </div>
      );
    }
    return (
      <div className="h-full">
        <UsgComposer
          pathologies={pathologies}
          settings={settings}
          report={editing}
          prefill={prefill}
          diffSource={diffSource}
          normalOverrides={normalOverrides}
          pathologyWording={pathologyWording}
          onPathologyWordingChange={setPathologyWording}
          order={order}
          formFDefaults={formFDefaults}
          onBack={() => {
            setEditing(null);
            setCreating(false);
            setOrder(null);
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
        {registerHtml ? (
          <RegisterOverlay
            html={registerHtml}
            onClose={() => setRegisterHtml(null)}
          />
        ) : null}
        {reprintHtml && editing ? (
          <ReprintOverlay
            html={reprintHtml}
            serial={editing?.serialNo != null ? formatUsgSerial(editing.serialNo) : undefined}
            reportId={editing.id}
            patientName={editing.patientName}
            date={new Date(editing.scanDate ?? editing.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
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
          <Button
            onClick={openRegister}
            variant="outline"
            title="The sequential USG register — print or export (PC-PNDT discipline)"
            className="h-10 border-white/40 bg-white/10 px-3 text-[12px] font-semibold text-white backdrop-blur hover:bg-white/20"
          >
            <BookOpen className="mr-1.5 h-4 w-4" /> Register
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
        <div className="flex rounded-full border-2 border-rose-200 bg-rose-50/60 p-1 shadow-sm" role="tablist" aria-label="Studio mode">
          {(
            [
              { id: "reports", label: "Reports", icon: FileText },
              { id: "patients", label: "Patients", icon: Users },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => {
                setMode(m.id);
                setPatientDetail(null);
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-5 py-2 text-[13px] font-bold transition-colors",
                mode === m.id
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-rose-900/70 hover:bg-white hover:text-rose-800",
              )}
            >
              <m.icon className="h-4 w-4" />
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
            onPrefetch={prefetchReport}
          />
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
              <Input
                ref={searchRef}
                value={patientQuery}
                onChange={(e) => setPatientQuery(e.target.value)}
                placeholder="Search patient name or phone… ( / )"
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
                  role="button"
                  tabIndex={0}
                  aria-label={`Open patient ${p.name}${p.phone ? `, phone ${p.phone}` : ""}`}
                  className="group flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm transition-colors hover:border-rose-200 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2"
                  onClick={() => openPatient(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openPatient(p.id);
                    }
                  }}
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
          {/* v6.9 — Follow-up reminders widget (shows due + upcoming)
              v6.10 — gated by the enableFollowUps feature toggle */}
          <UsgFollowUpWidget enabled={settings?.enableFollowUps !== false} />

          {/* Search + filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
              <Input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search patient, study, doctor, impression… ( / )"
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
                <ReportCard key={r.id} r={r} onOpen={() => openReport(r)} onDuplicate={() => duplicate(r)} onDelete={() => del(r)} onPrefetch={() => prefetchReport(r.id)} />
              ))}
            </div>
          )}
        </>
      )}

      {registerHtml ? <RegisterOverlay html={registerHtml} onClose={() => setRegisterHtml(null)} /> : null}

      {/* Audit #14 — proper delete confirmation with loading state.
          Replaces the synchronous window.confirm() that blocked the
          main thread and gave no feedback during the network round-trip. */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!deleting) setDeleteTarget(open ? deleteTarget : null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this USG report?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `${deleteTarget.patientName} — ${deleteTarget.studyTitle || "USG study"}${deleteTarget.status === "FINALIZED" ? " (FINALIZED)" : ""}. This cannot be undone.`
                : "This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** One report row — shared by the reports list and the patient history. */
function ReportCard({
  r,
  onOpen,
  onDuplicate,
  onDelete,
  onPrefetch,
}: {
  r: UsgReportRow;
  onOpen: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onPrefetch?: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ${r.patientName}'s USG report${r.studyTitle ? ` — ${r.studyTitle}` : ""}`}
      className="group flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm transition-colors hover:border-rose-200 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2"
      onClick={onOpen}
      onMouseEnter={() => onPrefetch?.()}
      onFocus={() => onPrefetch?.()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
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
      {r.status === "FINALIZED" && (
        <div onClick={(e) => e.stopPropagation()} className="opacity-0 transition-opacity group-hover:opacity-100">
          <UsgPacsReturnButton reportId={r.id} />
        </div>
      )}
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
  onPrefetch,
}: {
  patient: PatientRow & { reports: UsgReportRow[] };
  onBack: () => void;
  onNewScan: () => void;
  onOpenReport: (r: UsgReportRow) => void;
  onDuplicate: (r: UsgReportRow) => void;
  onDelete: (r: UsgReportRow) => void;
  onPrefetch?: (id: string) => void;
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
            <ReportCard key={r.id} r={r} onOpen={() => onOpenReport(r)} onDuplicate={() => onDuplicate(r)} onDelete={() => onDelete(r)} onPrefetch={() => onPrefetch?.(r.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Finalized report = frozen snapshot view + reprint + follow-up + share. */
function ReprintOverlay({
  html, serial, reportId, patientName, date, onClose, onFollowUp,
}: {
  html: string;
  serial?: string;
  reportId: string;
  patientName: string;
  date: string;
  onClose: () => void;
  onFollowUp: () => void;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2.5">
        <span className="text-[13px] font-bold">Finalized report{serial ? ` — ${serial}` : ""}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <a href={`/api/usg/reports/${reportId}/pdf`} target="_blank" rel="noreferrer" download>
            <Button size="sm" variant="outline" className="h-8 border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100" title="Open / download the PDF">
              <Download className="mr-1.5 h-4 w-4" /> PDF
            </Button>
          </a>
          <Button
            size="sm"
            variant="outline"
            className="h-8 border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            title="Share via WhatsApp — secure 7-day link (wa.me deep link)"
            onClick={() => {
              void shareReportWhatsapp(reportId).then((r) => {
                if (r === "failed") toast.error("Could not create share link");
              });
            }}
          >
            <MessageCircle className="mr-1.5 h-4 w-4" /> Share via WhatsApp
          </Button>
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

/** The sequential register — full-screen printable view + CSV export. */
function RegisterOverlay({ html, onClose }: { html: string; onClose: () => void }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur">
      <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-2.5">
        <BookOpen className="h-4 w-4 text-rose-600" />
        <span className="text-[13px] font-bold">USG Register — sequential, never renumbered</span>
        <div className="ml-auto flex gap-2">
          <a href="/api/usg/register?format=csv" download>
            <Button size="sm" variant="outline" className="h-8 border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100">
              <Download className="mr-1.5 h-4 w-4" /> CSV
            </Button>
          </a>
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
      <iframe ref={frameRef} title="usg-register" srcDoc={html} className="min-h-0 flex-1 bg-white" />
    </div>
  );
}
