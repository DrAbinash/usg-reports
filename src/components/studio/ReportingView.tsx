"use client";
/** Reporting screen: patient rail + findings editor + viewer panel. */
import { useEffect, useState } from "react";
import { useStudio } from "@/lib/store";
import { FindingsEditor, type Finding, type Phrase, type ReportCore, type FormatOption } from "./FindingsEditor";
import type { KeyImage } from "./KeyImages";
import { ViewerPanel } from "./ViewerPanel";
import { PrintOverlay } from "./PrintOverlay";
import { BillingBadge, ModalityChip, StatusChip, SectionLabel } from "./bits";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Printer, Save, Stamp, ArrowLeft, FileText } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ReportBundle = {
  report: ReportCore & { finalizedAt: string | null };
  order: {
    id: string; accessionNumber: string; patientName: string; patientAge: string | null;
    patientGender: string | null; patientMrn: string | null; referringDoctor: string | null;
    testName: string | null; modality: string; bodyRegion: string; billingStatus: string | null;
    status: string; studyDate: string | null; studyInstanceUid: string | null;
  };
  findings: Finding[];
  phrases: Phrase[];
  images: KeyImage[];
};

export function ReportingView() {
  const { activeOrderId, setView } = useStudio();
  const [bundle, setBundle] = useState<ReportBundle | null>(null);
  const [formats, setFormats] = useState<FormatOption[]>([]);
  const [studyName, setStudyName] = useState<string | null | undefined>(undefined);
  const [viewerUrls, setViewerUrls] = useState({ lan: "", tailscale: "" });
  const [printHtml, setPrintHtml] = useState<string | null>(null);
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!activeOrderId) return;
    let alive = true;
    fetch(`/api/orders/${activeOrderId}/report`, { method: "POST" })
      .then((r) => r.json())
      .then((boot) => {
        if (!alive || boot.error) {
          if (boot.error) toast.error(boot.error);
          return;
        }
        return fetch(`/api/reports/${boot.reportId}`).then((res) => res.json());
      })
      .then((r) => {
        if (alive && r && !r.error) {
          setBundle(r);
          setStudyName(r.report.studyName ?? null);
          return fetch(`/api/formats?modality=${encodeURIComponent(r.order.modality)}&region=${encodeURIComponent(r.order.bodyRegion)}`)
            .then((res) => res.json())
            .then((f) => {
              if (alive && f.formats) setFormats(f.formats);
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        if (alive && s.settings) setViewerUrls({ lan: s.settings.ohifLanUrl ?? "", tailscale: s.settings.ohifTailscaleUrl ?? "" });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [activeOrderId]);

  if (!bundle) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-[13px] text-faint">
          <FileText className="h-4 w-4 animate-pulse" /> Opening report…
        </div>
      </div>
    );
  }

  const { report, order, findings, phrases } = bundle;
  const finalized = report.status === "FINALIZED";

  const openPreview = async () => {
    const r = await fetch(`/api/reports/${report.id}/preview`).then((res) => res.json());
    if (r.html) setPrintHtml(r.html);
  };

  const finalize = async () => {
    setConfirmFinalize(false);
    setBusy(true);
    const r = await fetch(`/api/reports/${report.id}/finalize`, { method: "POST" }).then((res) => res.json());
    setBusy(false);
    if (r.error) {
      toast.error(r.error);
      return;
    }
    if (r.localOnly) {
      toast.warning(`Finalized locally — CARE finalize failed (${r.careError}). Will retry.`);
    } else if (r.careOk) {
      toast.success("Finalized & billed in CARE");
    } else if (r.alreadyFinalized) {
      toast.info("Already finalized");
    } else {
      toast.success("Finalized");
    }
    setView("worklist");
  };

  return (
    <div className="flex h-full min-h-0">
      {/* Left rail */}
      <aside className="studio-scroll w-64 shrink-0 overflow-y-auto border-r border-border bg-panel p-4">
        <button
          onClick={() => setView("worklist")}
          className="mb-4 flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Worklist
        </button>

        <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
          <div className="flex items-center gap-2">
            <ModalityChip modality={order.modality} />
            <StatusChip status={order.status} />
          </div>
          <h2 className="mt-2.5 text-[15px] font-bold leading-tight">{order.patientName}</h2>
          <p className="text-[11.5px] text-muted-foreground">
            {order.patientAge ?? "—"} · {order.patientGender ?? "—"}
            {order.patientMrn ? ` · ${order.patientMrn}` : ""}
          </p>
          <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-[11.5px]">
            {[
              ["Accession", order.accessionNumber],
              ["Study", order.testName ?? "—"],
              ["Region", order.bodyRegion || "—"],
              ["Referred by", order.referringDoctor ?? "—"],
              ["Study date", order.studyDate ? new Date(order.studyDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-2">
                <span className="shrink-0 text-faint">{k}</span>
                <span className="truncate font-medium">{v}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-border pt-3">
            <BillingBadge status={order.billingStatus} />
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <Button
            variant="outline"
            className="h-9 w-full justify-start gap-2 border-border bg-card text-[12.5px]"
            onClick={() => toast.success("Draft saved")}
          >
            <Save className="h-3.5 w-3.5" /> Draft saved (auto)
          </Button>
          <Button
            variant="outline"
            className="h-9 w-full justify-start gap-2 border-border bg-card text-[12.5px]"
            onClick={openPreview}
          >
            <Printer className="h-3.5 w-3.5" /> Preview & Print A4
          </Button>
          <Button
            className="h-9 w-full justify-start gap-2 text-[12.5px]"
            disabled={finalized || busy}
            onClick={() => setConfirmFinalize(true)}
          >
            <Stamp className="h-3.5 w-3.5" /> {finalized ? "Finalized" : busy ? "Finalizing…" : "Finalize & bill"}
          </Button>
        </div>

        <p className="mt-3 rounded-md bg-accent px-2.5 py-2 text-[10.5px] leading-relaxed text-muted-foreground ring-1 ring-border">
          Tick <b>“Background graphics”</b> in the print dialog so the header band prints.
        </p>
      </aside>

      {/* Editor */}
      <div className="studio-scroll min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl p-4 md:p-6">
          <div className="mb-5">
            <SectionLabel>Report</SectionLabel>
            <h1 className="mt-1 text-lg font-bold tracking-tight" data-testid="report-title">
              {studyName || order.testName || order.bodyRegion}
              <span className="ml-2 font-mono text-[12px] font-medium text-faint">{order.accessionNumber}</span>
            </h1>
          </div>
          <FindingsEditor
            report={report}
            order={order}
            findings={findings}
            phrases={phrases}
            formats={formats}
            images={bundle.images ?? []}
            onMetaChange={(m) => {
              if (typeof m.studyName !== "undefined") setStudyName(m.studyName);
            }}
            onImagesChanged={() => {
              // Viewer capture landed — refresh the bundle so the strip updates.
              fetch(`/api/reports/${report.id}`)
                .then((res) => res.json())
                .then((r) => { if (r && !r.error) setBundle((b) => (b ? { ...b, images: r.images ?? [] } : b)); })
                .catch(() => {});
            }}
          />
        </div>
      </div>

      {/* Viewer */}
      <ViewerPanel
        lanUrl={viewerUrls.lan}
        tailscaleUrl={viewerUrls.tailscale}
        studyInstanceUid={order.studyInstanceUid}
        testName={order.testName}
        reportId={report.id}
        onImageCaptured={() => {
          fetch(`/api/reports/${report.id}`)
            .then((res) => res.json())
            .then((r) => { if (r && !r.error) setBundle((b) => (b ? { ...b, images: r.images ?? [] } : b)); })
            .catch(() => {});
        }}
      />

      {/* Print overlay */}
      {printHtml ? <PrintOverlay html={printHtml} onClose={() => setPrintHtml(null)} /> : null}

      {/* Finalize confirm */}
      <AlertDialog open={confirmFinalize} onOpenChange={setConfirmFinalize}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px]">Finalize this report?</AlertDialogTitle>
            <AlertDialogDescription className="text-[12.5px] leading-relaxed">
              The report is frozen as a PDF-style snapshot, marked Reported, and sent to CARE to create the billing row.
              Findings stay editable for reuse — but the printed report never changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-[12px]">Keep editing</AlertDialogCancel>
            <AlertDialogAction className="text-[12px]" onClick={finalize}>Finalize & bill</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
