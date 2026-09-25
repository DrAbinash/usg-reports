"use client";
/**
 * Preview column — letterhead iframe + optional OHIF sidebar + focusMode
 * click-catcher overlay (enlarge-on-click; removed once focused).
 */
import { memo } from "react";
import { UsgViewerSidebar } from "../UsgViewerSidebar";
import type { ImageRow, PendingImage } from "../UsgImagesCard";
import { toast } from "sonner";
import { clearDraft } from "@/lib/usg/drafts";
import { formatUsgSerial } from "@/lib/usg/print";
import { isCleanRushFinalize } from "@/lib/usg/quickActions";
import type { UsgComposerState } from "@/lib/usg/types";
import { UsgDicomPicker } from "../UsgDicomPicker";
import { UsgFormFDialog, type FormFOrderLite } from "../UsgFormFDialog";
import { UsgPathologyDialog } from "../UsgPathologyDialog";
import { UsgStudyPicker } from "../UsgStudyPicker";
import { UsgQualityChecklist } from "../UsgQualityChecklist";
import { UsgMeasurementReviewDialog } from "../UsgMeasurementReviewDialog";
import { UsgCriticalCommDialog } from "../UsgCriticalCommDialog";
import { UsgAiDraftPanel } from "../UsgAiDraftPanel";
import { selectedPathologies, setOrganVar } from "@/lib/usg/composer";


export type PreviewZoneProps = {
  focusMode: "workspace" | "preview" | null;
  previewHtml: string;
  orderUid: string | null;
  onEnlarge: () => void;
  onResetFocus: () => void;
};

function previewEqual(a: PreviewZoneProps, b: PreviewZoneProps): boolean {
  return (
    a.focusMode === b.focusMode &&
    a.previewHtml === b.previewHtml &&
    a.orderUid === b.orderUid &&
    a.onEnlarge === b.onEnlarge &&
    a.onResetFocus === b.onResetFocus
  );
}

export const PreviewZone = memo(function PreviewZone({
  focusMode,
  previewHtml,
  orderUid,
  onEnlarge,
  onResetFocus,
}: PreviewZoneProps) {
  return (
    <div
      className="relative flex min-h-0 flex-col gap-3 overflow-hidden pr-1"
      onDoubleClick={(e) => {
        e.stopPropagation();
        onResetFocus();
      }}
    >
      {focusMode !== "preview" && (
        <div
          className="absolute inset-0 z-10 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onEnlarge();
          }}
          title="Click to enlarge viewer & letterpad"
        />
      )}
      {orderUid && <UsgViewerSidebar studyInstanceUid={orderUid} />}
      <div className="flex-1 min-h-0 rounded-lg border border-border bg-white shadow-sm overflow-hidden">
        <iframe
          title="USG report preview"
          srcDoc={previewHtml}
          className="h-full w-full border-0"
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}, previewEqual);

/** Image CRUD helpers — kept here so UsgComposer stays under the line budget. */
export async function flushPendingImages(
  id: string,
  pendingImages: PendingImage[],
  setPendingImages: React.Dispatch<React.SetStateAction<PendingImage[]>>,
  setImages: React.Dispatch<React.SetStateAction<ImageRow[]>>,
) {
  if (!pendingImages.length) return;
  const queue = [...pendingImages];
  setPendingImages([]);
  for (const p of queue) {
    const res = await fetch(`/api/usg/reports/${id}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    if (res.ok) {
      const { image } = (await res.json()) as { image: ImageRow };
      setImages((prev) => [...prev, image]);
    } else {
      toast.error((await res.json().catch(() => ({}))).error ?? "Could not attach an image");
    }
  }
}

export async function reloadImages(
  reportId: string | null,
  setImages: React.Dispatch<React.SetStateAction<ImageRow[]>>,
) {
  if (!reportId) return;
  const res = await fetch(`/api/usg/reports/${reportId}`);
  if (!res.ok) return;
  const fresh = (await res.json()).report as { images?: ImageRow[] };
  if (Array.isArray(fresh.images)) setImages(fresh.images);
}

export function addImage(
  dataUrl: string,
  opts: {
    isFinal: boolean;
    savedId: string | null;
    setImages: React.Dispatch<React.SetStateAction<ImageRow[]>>;
    setPendingImages: React.Dispatch<React.SetStateAction<PendingImage[]>>;
  },
) {
  if (opts.isFinal) {
    toast.error("Finalized reports keep their images frozen");
    return;
  }
  if (opts.savedId) {
    void (async () => {
      const res = await fetch(`/api/usg/reports/${opts.savedId}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      if (res.ok) {
        const { image } = (await res.json()) as { image: ImageRow };
        opts.setImages((prev) => [...prev, image]);
      } else {
        toast.error((await res.json().catch(() => ({}))).error ?? "Could not attach the image");
      }
    })();
  } else {
    opts.setPendingImages((prev) => [...prev, { dataUrl, caption: "" }]);
    toast.info("Still attached — saves with the draft (Save to keep it permanently)");
  }
}

export function setCaption(
  kind: "server" | "pending",
  key: string,
  caption: string,
  opts: {
    setImages: React.Dispatch<React.SetStateAction<ImageRow[]>>;
    setPendingImages: React.Dispatch<React.SetStateAction<PendingImage[]>>;
    captionTimer: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
    savedIdRef: React.MutableRefObject<string | null>;
  },
) {
  if (kind === "pending") {
    opts.setPendingImages((prev) => prev.map((p, i) => (String(i) === key ? { ...p, caption } : p)));
    return;
  }
  opts.setImages((prev) => prev.map((p) => (p.id === key ? { ...p, caption } : p)));
  if (opts.captionTimer.current) clearTimeout(opts.captionTimer.current);
  opts.captionTimer.current = setTimeout(() => {
    fetch(`/api/usg/reports/${opts.savedIdRef.current}/images/${key}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caption }),
    }).then(
      (res) => {
        if (!res.ok) toast.error(`Caption save failed (${res.status})`);
      },
      (err) => toast.error(`Caption save failed — ${err?.message ?? "network error"}`),
    );
  }, 600);
}

export function removeImage(
  kind: "server" | "pending",
  key: string,
  opts: {
    setImages: React.Dispatch<React.SetStateAction<ImageRow[]>>;
    setPendingImages: React.Dispatch<React.SetStateAction<PendingImage[]>>;
    savedIdRef: React.MutableRefObject<string | null>;
  },
) {
  if (kind === "pending") {
    opts.setPendingImages((prev) => prev.filter((_, i) => String(i) !== key));
    return;
  }
  opts.setImages((prev) => prev.filter((p) => p.id !== key));
  fetch(`/api/usg/reports/${opts.savedIdRef.current}/images/${key}`, { method: "DELETE" }).then(
    (res) => {
      if (!res.ok) toast.error(`Remove failed (${res.status}) — refresh the page`);
    },
    (err) => toast.error(`Remove failed — ${err?.message ?? "network error"}`),
  );
}

export function moveImage(
  kind: "server" | "pending",
  key: string,
  dir: -1 | 1,
  opts: {
    setImages: React.Dispatch<React.SetStateAction<ImageRow[]>>;
    setPendingImages: React.Dispatch<React.SetStateAction<PendingImage[]>>;
    savedIdRef: React.MutableRefObject<string | null>;
  },
) {
  if (kind === "pending") {
    opts.setPendingImages((prev) => {
      const i = Number(key);
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    return;
  }
  opts.setImages((prev) => {
    const i = prev.findIndex((p) => p.id === key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= prev.length) return prev;
    const next = [...prev];
    [next[i], next[j]] = [next[j], next[i]];
    for (const [idx, img] of next.entries()) {
      if (idx === i || idx === j) {
        fetch(`/api/usg/reports/${opts.savedIdRef.current}/images/${img.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sortOrder: (idx + 1) * 10 }),
        }).then(
          (res) => {
            if (!res.ok) toast.error(`Order save failed (${res.status})`);
          },
          (err) => toast.error(`Order save failed — ${err?.message ?? "network error"}`),
        );
      }
    }
    return next.map((img, idx) => (idx === i || idx === j ? { ...img, sortOrder: (idx + 1) * 10 } : img));
  });
}


export type PersistDeps = {
  patientName: string;
  patientPhone: string;
  patientAge: string;
  patientSex: string;
  referredBy: string;
  studyKey: string;
  technique: string;
  state: UsgComposerState;
  scanDate: string;
  savedIdRef: React.MutableRefObject<string | null>;
  frozenHtmlRef: React.MutableRefObject<string | null>;
  dirtyRef: React.MutableRefObject<boolean>;
  dKey: string;
  pendingImages: PendingImage[];
  setPendingImages: React.Dispatch<React.SetStateAction<PendingImage[]>>;
  setImages: React.Dispatch<React.SetStateAction<ImageRow[]>>;
  setBusy: (v: "" | "save" | "finalize" | "print") => void;
  setSerial: (v: string | undefined) => void;
  setFinalizedHere: (v: boolean) => void;
  onSaved: () => void;
};

export async function persistReport(
  status: "" | "finalize",
  deps: PersistDeps,
): Promise<string | null> {
  if (!deps.patientName.trim()) {
    toast.error("Patient name is required");
    return null;
  }
  deps.setBusy(status === "finalize" ? "finalize" : "save");
  try {
    const payload = {
      patientName: deps.patientName.trim(),
      patientPhone: deps.patientPhone.trim(),
      patientAge: deps.patientAge.trim(),
      patientSex: deps.patientSex,
      referredBy: deps.referredBy.trim(),
      studyKey: deps.studyKey,
      technique: deps.technique,
      state: deps.state,
      scanDate: deps.scanDate,
    };
    let id = deps.savedIdRef.current;
    if (id) {
      const res = await fetch(`/api/usg/reports/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Save failed");
    } else {
      const res = await fetch("/api/usg/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Save failed");
      id = (await res.json()).report.id as string;
      deps.savedIdRef.current = id;
    }
    if (status === "finalize" && id) {
      const res = await fetch(`/api/usg/reports/${id}/finalize`, { method: "POST" });
      if (!res.ok) throw new Error("Finalize failed");
      const body = (await res.json()) as { serialNo?: number; html?: string; report?: { reportHtml?: string | null } };
      if (typeof body.serialNo === "number") deps.setSerial(formatUsgSerial(body.serialNo));
      deps.setFinalizedHere(true);
      if (typeof body.html === "string" && body.html.trim()) {
        deps.frozenHtmlRef.current = body.html;
      } else if (body.report?.reportHtml) {
        deps.frozenHtmlRef.current = body.report.reportHtml;
      }
      deps.dirtyRef.current = false;
      clearDraft(deps.dKey);
      toast.success(`Report finalized — register no. ${formatUsgSerial(body.serialNo ?? 0)} frozen for reprint`);
    } else {
      deps.dirtyRef.current = false;
      toast.success("Draft saved");
    }
    deps.onSaved();
    if (id) await flushPendingImages(id, deps.pendingImages, deps.setPendingImages, deps.setImages);
    return id;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Save failed");
    return null;
  } finally {
    deps.setBusy("");
  }
}

export function printInIframe(printRef: React.RefObject<HTMLIFrameElement | null>, html: string) {
  const frame = printRef.current;
  if (!frame) return;
  frame.srcdoc = html;
  const win = frame.contentWindow;
  if (win) {
    win.focus();
    setTimeout(() => win.print(), 150);
  }
}

export async function printFrozenReport(
  id: string,
  frozenHtmlRef: React.MutableRefObject<string | null>,
  printRef: React.RefObject<HTMLIFrameElement | null>,
): Promise<boolean> {
  if (frozenHtmlRef.current && !/PROVISIONAL/i.test(frozenHtmlRef.current)) {
    printInIframe(printRef, frozenHtmlRef.current);
    return true;
  }
  const res = await fetch(`/api/usg/reports/${id}`, { method: "GET" });
  if (!res.ok) return false;
  const row = (await res.json()).report as { status?: string; reportHtml?: string | null } | null;
  if (row?.status === "FINALIZED" && row.reportHtml) {
    frozenHtmlRef.current = row.reportHtml;
    printInIframe(printRef, row.reportHtml);
    return true;
  }
  return false;
}

export async function printReport(opts: {
  patientName: string;
  setBusy: (v: "" | "save" | "finalize" | "print") => void;
  report: { id?: string; status?: string; reportHtml?: string | null } | null;
  finalizedHere: boolean;
  frozenHtmlRef: React.MutableRefObject<string | null>;
  savedIdRef: React.MutableRefObject<string | null>;
  printRef: React.RefObject<HTMLIFrameElement | null>;
  previewHtml: string;
  persist: (status: "" | "finalize") => Promise<string | null>;
}) {
  if (!opts.patientName.trim()) {
    toast.error("Patient name is required");
    return;
  }
  opts.setBusy("print");
  try {
    if (opts.report?.status === "FINALIZED" && opts.report.reportHtml) {
      opts.frozenHtmlRef.current = opts.report.reportHtml;
      printInIframe(opts.printRef, opts.report.reportHtml);
    } else if (opts.finalizedHere || opts.frozenHtmlRef.current) {
      const id = opts.savedIdRef.current ?? opts.report?.id;
      if (id) {
        const ok = await printFrozenReport(id, opts.frozenHtmlRef, opts.printRef);
        if (!ok && opts.frozenHtmlRef.current) printInIframe(opts.printRef, opts.frozenHtmlRef.current);
        else if (!ok) toast.error("Could not load the finalized snapshot for print");
      } else if (opts.frozenHtmlRef.current) {
        printInIframe(opts.printRef, opts.frozenHtmlRef.current);
      }
    } else {
      const id = await opts.persist("");
      if (id) {
        const res = await fetch(`/api/usg/reports/${id}`, { method: "GET" });
        const row = res.ok ? ((await res.json()).report as { status?: string; reportHtml?: string | null }) : null;
        if (row?.status === "FINALIZED" && row.reportHtml) {
          opts.frozenHtmlRef.current = row.reportHtml;
          printInIframe(opts.printRef, row.reportHtml);
        } else {
          printInIframe(opts.printRef, opts.previewHtml);
        }
      }
    }
  } finally {
    opts.setBusy("");
  }
}

export async function finalizeFastReport(opts: {
  isFinal: boolean;
  busyRef: React.MutableRefObject<string>;
  state: UsgComposerState;
  persist: (status: "" | "finalize") => Promise<string | null>;
  frozenHtmlRef: React.MutableRefObject<string | null>;
  printRef: React.RefObject<HTMLIFrameElement | null>;
  setQualityOpen: (v: boolean) => void;
  alsoPrint?: boolean;
}) {
  if (opts.isFinal || opts.busyRef.current) return;
  if (isCleanRushFinalize(opts.state)) {
    const id = await opts.persist("finalize");
    if (id && opts.alsoPrint) {
      const ok = await printFrozenReport(id, opts.frozenHtmlRef, opts.printRef);
      if (!ok) toast.error("Finalized, but could not load the print snapshot");
    }
    return;
  }
  if (opts.alsoPrint) {
    opts.setQualityOpen(true);
    toast.message("Review quality checklist, then finalize — print after");
    return;
  }
  opts.setQualityOpen(true);
}


export function ComposerDialogs(p: {
  dicomOpen: boolean; setDicomOpen: (v: boolean) => void;
  formFOpen: boolean; setFormFOpen: (v: boolean) => void;
  formFDefaults: any; order: any; report: any; onSaved: () => void;
  dialogOrgan: string | null; setDialogOrgan: (v: string | null) => void; study: any;
  pickerOpen: boolean; setPickerOpen: (v: boolean) => void; pickStudy: (k: string) => void; studyKey: string;
  qualityOpen: boolean; setQualityOpen: (v: boolean) => void; state: UsgComposerState; resolved: any;
  persist: (status: "" | "finalize") => Promise<string | null>;
  reviewSrResult: any; reviewOpen: boolean; setReviewOpen: (v: boolean) => void;
  reviewSrMeasurements: any; setState: React.Dispatch<React.SetStateAction<UsgComposerState>>;
  commOpen: boolean; setCommOpen: (v: boolean) => void; savedIdRef: React.MutableRefObject<string | null>;
  patientName: string; impressionManual: boolean; setImpressionManual: (v: boolean) => void;
  referredBy: string; settings: any; isPregnancyStudy: boolean; orderUid: string | null;
  technique: string;
  togglePathology: (organKey: string, key: string | null) => void;
}) {
  const {
    dicomOpen, setDicomOpen, formFOpen, setFormFOpen, formFDefaults, order, report, onSaved,
    dialogOrgan, setDialogOrgan, study, pickerOpen, setPickerOpen, pickStudy, studyKey,
    qualityOpen, setQualityOpen, state, resolved, persist,
    reviewSrResult, reviewOpen, setReviewOpen, reviewSrMeasurements, setState,
    commOpen, setCommOpen, savedIdRef, patientName, impressionManual, setImpressionManual,
    referredBy, settings, isPregnancyStudy, orderUid, technique, togglePathology,
  } = p;
  return (
    <>
      <UsgDicomPicker
        open={dicomOpen}
        reportId={savedIdRef.current ?? report?.id ?? null}
        studyInstanceUid={orderUid ?? null}
        onClose={() => setDicomOpen(false)}
        onAdded={() => { /* refresh images */ }}
        onOcrResult={(ocr) => {
          if (isPregnancyStudy && ocr) {
            const obPatch: any = {};
            if (ocr.bpd) obPatch.bpdMm = parseFloat(ocr.bpd) * 10;
            if (ocr.hc) obPatch.hcMm = parseFloat(ocr.hc) * 10;
            if (ocr.ac) obPatch.acMm = parseFloat(ocr.ac) * 10;
            if (ocr.fl) obPatch.flMm = parseFloat(ocr.fl) * 10;
            if (ocr.fhr) obPatch.fhr = parseInt(ocr.fhr);
            if (ocr.fetalPresentation) obPatch.presentation = ocr.fetalPresentation.toLowerCase();
            if (ocr.placentaPosition) obPatch.placentaPosition = ocr.placentaPosition;
            if (ocr.liquorAfi) obPatch.liquorAfi = ocr.liquorAfi;
            setState((s) => ({ ...s, ob: { ...((s as any).ob ?? {}), ...obPatch } }));
            toast.success(`OCR → ${Object.keys(obPatch).length} OB fields filled (verify values)`);
          }
        }}
      />

      {formFDefaults ? (
        <UsgFormFDialog
          open={formFOpen}
          onClose={() => setFormFOpen(false)}
          defaults={formFDefaults}
          order={order as FormFOrderLite | undefined}
          report={report ?? undefined}
          onSaved={onSaved}
        />
      ) : null}

      <UsgPathologyDialog
        open={dialogOrgan !== null}
        organKey={dialogOrgan ?? ""}
        organLabel={study.organs.find((o) => o.key === dialogOrgan)?.label ?? ""}
        editing={null}
        onClose={() => setDialogOrgan(null)}
        onSaved={onSaved}
      />

      <UsgStudyPicker open={pickerOpen} currentKey={studyKey} onPick={pickStudy} onClose={() => setPickerOpen(false)} />

      <UsgQualityChecklist
        open={qualityOpen}
        onOpenChange={setQualityOpen}
        state={state}
        resolved={resolved}
        onForceFinalize={() => void persist("finalize")}
      />

      {reviewSrResult && (
        <UsgMeasurementReviewDialog
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          srResult={reviewSrResult}
          srMeasurements={reviewSrMeasurements}
          onAccept={(vars) => {
            let applied = 0;
            setState((s) => {
              let next = s;
              for (const [organ, kv] of Object.entries(vars)) {
                for (const [k, v] of Object.entries(kv)) {
                  if (!v) continue;
                  next = setOrganVar(next, organ, k, v);
                  applied++;
                }
              }
              return next;
            });
            if (applied > 0) toast.success(`${applied} measurement(s) filled from machine SR`);
          }}
        />
      )}

      <UsgCriticalCommDialog
        open={commOpen}
        onOpenChange={setCommOpen}
        reportId={savedIdRef.current ?? report?.id ?? null}
        patientName={patientName}
        initialFinding={(impressionManual ? state.impressionOverride ?? "" : resolved.impression.join("\n")).split("\n")[0] ?? ""}
        initialRecipient={referredBy}
      />

      {settings.enableAiDraft !== false ? (
        <UsgAiDraftPanel
          reportId={savedIdRef.current ?? report?.id ?? null}
          technique={technique}
          togglePathology={togglePathology}
          organHasPathology={(organKey) => {
            const o = state.organs.find((x) => x.organ === organKey);
            return selectedPathologies(o ?? { pathology: null }).length > 0;
          }}
          onInsertImpression={(text) => {
            setImpressionManual(true);
            setState((s) => ({ ...s, impressionOverride: text }));
            toast.success("AI impression inserted — review and edit");
          }}
          onInsertAdvice={(lines) => {
            // Free-text advice has no separate override field — land as conclusion
            // addendum lines the doctor can edit/dismiss in the triad impression zone.
            setState((s) => {
              const prev = (s.impressionAddendum ?? "").trim();
              const next = [...(prev ? prev.split(/\n+/) : []), ...lines]
                .map((l) => l.trim())
                .filter(Boolean);
              return { ...s, impressionAddendum: [...new Set(next)].join("\n") };
            });
            toast.success("AI advice added as conclusion lines — review");
          }}
        />
      ) : null}
    </>
  );
}
