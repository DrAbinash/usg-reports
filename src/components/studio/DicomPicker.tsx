"use client";
/**
 * DICOM image picker — the premium-report soul from CARE R1.3:
 * browse the linked study's series → instances, preview server-rendered
 * slices, and file key images into the report (frozen at pick time).
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Layers, ImagePlus, ChevronLeft, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Series = { uid: string; description: string; modality: string; number: string };
type Instance = { sopUid: string; instanceNumber: string };

export function DicomPicker({
  open, onClose, reportId, studyInstanceUid, onAdded,
}: {
  open: boolean;
  onClose: () => void;
  reportId: string;
  studyInstanceUid: string | null;
  onAdded?: () => void;
}) {
  const [series, setSeries] = useState<Series[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openSeries, setOpenSeries] = useState<string | null>(null);
  const [instances, setInstances] = useState<Instance[] | null>(null);
  const [selected, setSelected] = useState<{ inst: Instance; series: Series } | null>(null);
  const [caption, setCaption] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!open || !studyInstanceUid) return;
    let alive = true;
    const load = async () => {
      const r = await fetch(`/api/dicom/series?study=${encodeURIComponent(studyInstanceUid)}`)
        .then((res) => res.json())
        .catch(() => null);
      if (!alive) return;
      if (!r || r.error) {
        setError(r?.error ?? "Could not reach the Studio API");
        setSeries(null);
      } else {
        setError(null);
        setSeries(r.series ?? []);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [open, studyInstanceUid]);

  const loadInstances = (s: Series) => {
    setOpenSeries(s.uid);
    setInstances(null);
    setSelected(null);
    fetch(`/api/dicom/instances?study=${encodeURIComponent(studyInstanceUid ?? "")}&series=${encodeURIComponent(s.uid)}`)
      .then((r) => r.json())
      .then((r) => {
        if (r.error) { toast.error(r.error); setInstances([]); }
        else setInstances(r.instances ?? []);
      })
      .catch(() => toast.error("Could not load instances"));
  };

  const addImage = async () => {
    if (!selected) return;
    setAdding(true);
    const r = await fetch(`/api/reports/${reportId}/images/dicom`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        seriesInstanceUid: selected.series.uid,
        sopInstanceUid: selected.inst.sopUid,
        caption: caption.trim() || `${selected.series.description || selected.series.modality} · img ${selected.inst.instanceNumber}`,
      }),
    }).then((res) => res.json()).catch(() => null);
    setAdding(false);
    if (r?.error) { toast.error(r.error); return; }
    if (r?.ok) {
      toast.success("Key image added from DICOM");
      setSelected(null);
      setCaption("");
      onAdded?.();
    }
  };

  const previewSrc = selected && studyInstanceUid
    ? `/api/dicom/rendered?study=${encodeURIComponent(studyInstanceUid)}&series=${encodeURIComponent(selected.series.uid)}&sop=${encodeURIComponent(selected.inst.sopUid)}&size=420`
    : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] w-[min(940px,94vw)] overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-5 py-3.5">
          <DialogTitle className="flex items-center gap-2 text-[14px]">
            <Layers className="h-4 w-4 text-primary" />
            Select key images from DICOM
            <span className="ml-2 text-[11px] font-normal text-faint">picked images are frozen into the printed report</span>
          </DialogTitle>
        </DialogHeader>

        {!studyInstanceUid ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <AlertTriangle className="h-5 w-5 text-warn" />
            <p className="text-[13px] font-semibold">No study linked</p>
            <p className="max-w-[380px] text-[12px] text-faint">Match this order to an Orthanc study from the Worklist first, then pick images.</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <AlertTriangle className="h-5 w-5 text-warn" />
            <p className="text-[13px] font-semibold">{error}</p>
            <p className="max-w-[380px] text-[12px] text-faint">Check Orthanc URL and credentials in Settings → Integrations (use the Test button).</p>
          </div>
        ) : (
          <div className="flex h-[62vh] min-h-0">
            {/* Series / instances column */}
            <div className="studio-scroll w-[46%] min-w-[300px] overflow-y-auto border-r border-border p-3">
              {!series ? (
                <div className="flex items-center gap-2 p-4 text-[12px] text-faint">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading series…
                </div>
              ) : series.length === 0 ? (
                <p className="p-4 text-[12px] text-faint">No series found for this study.</p>
              ) : (
                <div className="space-y-1.5">
                  {series.map((s) => (
                    <div key={s.uid} className="overflow-hidden rounded-lg border border-border bg-card">
                      <button
                        onClick={() => loadInstances(s)}
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-accent",
                          openSeries === s.uid && "bg-accent",
                        )}
                      >
                        <span className="rounded bg-panel px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">{s.number || "—"}</span>
                        <span className="min-w-0 flex-1 truncate text-[12px] font-medium">{s.description || s.modality || "Series"}</span>
                        <span className="shrink-0 text-[10px] font-bold text-faint">{s.modality}</span>
                      </button>
                      {openSeries === s.uid ? (
                        <div className="border-t border-border bg-panel/60 p-2">
                          {!instances ? (
                            <div className="flex items-center gap-2 px-2 py-3 text-[11px] text-faint">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading images…
                            </div>
                          ) : (
                            <div className="grid max-h-64 grid-cols-8 gap-1 overflow-y-auto">
                              {instances.map((inst) => (
                                <button
                                  key={inst.sopUid}
                                  onClick={() => { setSelected({ inst, series: s }); setCaption(""); }}
                                  className={cn(
                                    "flex h-8 items-center justify-center rounded font-mono text-[11px] font-semibold transition-all",
                                    selected?.inst.sopUid === inst.sopUid
                                      ? "bg-primary text-primary-foreground shadow-sm"
                                      : "bg-card text-muted-foreground ring-1 ring-border hover:text-foreground hover:ring-primary/40",
                                  )}
                                  title={`Image ${inst.instanceNumber}`}
                                >
                                  {inst.instanceNumber || "·"}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Preview column */}
            <div className="flex min-w-0 flex-1 flex-col">
              {selected ? (
                <>
                  <div className="flex min-h-0 flex-1 items-center justify-center bg-[#0e1216] p-3">
                    {previewSrc ? (
                      <img src={previewSrc} alt={`Image ${selected.inst.instanceNumber}`} className="max-h-full max-w-full object-contain" />
                    ) : null}
                  </div>
                  <div className="space-y-2 border-t border-border p-3">
                    <div className="flex items-center gap-2 text-[11px] text-faint">
                      <ChevronLeft className="h-3 w-3" />
                      {selected.series.description || selected.series.modality} · image {selected.inst.instanceNumber}
                    </div>
                    <Input
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="Caption (printed under the image)…"
                      className="h-8 border-border bg-card text-[12px]"
                    />
                    <Button className="h-9 w-full gap-2 text-[12.5px]" onClick={addImage} disabled={adding}>
                      {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                      {adding ? "Rendering & saving…" : "Add to report"}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
                  <ImagePlus className="h-5 w-5 text-faint" />
                  <p className="text-[12.5px] font-semibold">Pick an image</p>
                  <p className="max-w-[260px] text-[11.5px] leading-relaxed text-faint">
                    Open a series on the left, tap an image number to preview it, then add it to the report.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
