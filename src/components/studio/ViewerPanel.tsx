"use client";
/**
 * OHIF viewer panel — LAN/Tailscale toggle (soul of CARE #634) +
 * key-image capture (premium report soul): grabs the active viewport
 * canvas and files it under the report for printing.
 */
import { useRef, useState } from "react";
import { PanelRightClose, PanelRightOpen, Wifi, Network, ExternalLink, Camera, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function initialNetwork(): "lan" | "tailscale" {
  if (typeof window === "undefined") return "lan";
  return localStorage.getItem("studioViewerNetwork") === "tailscale" ? "tailscale" : "lan";
}

export function ViewerPanel({
  lanUrl, tailscaleUrl, studyInstanceUid, testName, reportId, onImageCaptured,
}: {
  lanUrl: string;
  tailscaleUrl: string;
  studyInstanceUid: string | null;
  testName: string | null;
  reportId?: string;
  onImageCaptured?: () => void;
}) {
  const [network, setNetwork] = useState<"lan" | "tailscale">(initialNetwork);
  const [open, setOpen] = useState(true);
  const [failed, setFailed] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const choose = (n: "lan" | "tailscale") => {
    setNetwork(n);
    setFailed(false);
    localStorage.setItem("studioViewerNetwork", n);
  };

  const base = network === "tailscale" ? tailscaleUrl : lanUrl;
  const configured = !!base;
  const src = configured && studyInstanceUid ? `${base.replace(/\/+$/, "")}/viewer?StudyInstanceUIDs=${studyInstanceUid}` : null;

  /** Capture the largest canvas in the OHIF viewport (same-origin only). */
  const captureImage = async () => {
    if (!reportId) return;
    const iframe = iframeRef.current;
    let doc: Document | null = null;
    try {
      doc = iframe?.contentDocument ?? null;
    } catch {
      doc = null; // cross-origin access throws
    }
    if (!doc) {
      toast.error("Screen capture needs OHIF embedded on the Studio origin. Use “From DICOM” in Key images — it picks and renders images directly from Orthanc.");
      return;
    }
    const canvases = Array.from(doc.querySelectorAll("canvas"));
    let best: HTMLCanvasElement | null = null;
    let bestArea = 0;
    for (const c of canvases) {
      const area = c.width * c.height;
      if (area > bestArea && c.width >= 120 && c.height >= 120) {
        best = c;
        bestArea = area;
      }
    }
    if (!best) {
      toast.error("No viewport image found — open a study in the viewer first.");
      return;
    }
    let dataUrl: string;
    try {
      dataUrl = best.toDataURL("image/jpeg", 0.92);
    } catch {
      toast.error("The viewer blocked the capture. Use Upload/Paste in Key images instead.");
      return;
    }
    if (dataUrl.length < 3000) {
      toast.error("Captured an empty frame — scroll to an image in the viewer, then try again.");
      return;
    }
    setCapturing(true);
    const r = await fetch(`/api/reports/${reportId}/images`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dataUrl, source: "capture" }),
    }).then((res) => res.json()).catch(() => null);
    setCapturing(false);
    if (r?.error) { toast.error(r.error); return; }
    if (r?.ok) {
      toast.success("Key image captured — it prints in the report");
      onImageCaptured?.();
    }
  };

  return (
    <div className={cn("relative h-full shrink-0 border-l border-border bg-panel transition-all", open ? "w-[46%] min-w-[380px]" : "w-12")}>
      <button
        onClick={() => setOpen(!open)}
        className="absolute -left-3 top-4 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-primary"
        aria-label={open ? "Collapse viewer" : "Expand viewer"}
      >
        {open ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
      </button>

      {open ? (
        <div className="flex h-full flex-col">
          <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">Viewer</span>
            <button
              onClick={captureImage}
              disabled={!reportId || capturing || !src}
              data-testid="capture-image"
              title="Capture this view as a key image (prints in the report)"
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-bold transition-all",
                reportId && src
                  ? "bg-primary text-primary-foreground shadow-sm hover:brightness-110 active:scale-95"
                  : "bg-muted text-faint cursor-not-allowed",
              )}
            >
              {capturing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              Capture
            </button>
            <div className="ml-auto flex rounded-md border border-border bg-card p-0.5">
              <button
                onClick={() => choose("lan")}
                className={cn(
                  "flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold transition-all",
                  network === "lan" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
                title="Hospital LAN (faster)"
              >
                <Wifi className="h-3 w-3" /> LAN
              </button>
              <button
                onClick={() => choose("tailscale")}
                className={cn(
                  "flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold transition-all",
                  network === "tailscale" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
                title="Tailscale (outside hospital)"
              >
                <Network className="h-3 w-3" /> Tailscale
              </button>
            </div>
          </div>

          <div className="relative min-h-0 flex-1">
            {src ? (
              failed ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                  <p className="text-[12px] font-medium text-warn">Viewer did not load on {network === "lan" ? "LAN" : "Tailscale"}.</p>
                  <div className="flex gap-2">
                    {network === "lan" && tailscaleUrl ? (
                      <button onClick={() => choose("tailscale")} className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground">
                        Switch to Tailscale?
                      </button>
                    ) : null}
                    {network === "tailscale" && lanUrl ? (
                      <button onClick={() => choose("lan")} className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground">
                        Switch to LAN?
                      </button>
                    ) : null}
                    <button onClick={() => setFailed(false)} className="rounded-md border border-border bg-card px-3 py-1.5 text-[12px] font-medium">
                      Retry
                    </button>
                  </div>
                </div>
              ) : (
                <iframe
                  ref={iframeRef}
                  src={src}
                  className="h-full w-full border-0 bg-[#0e1216]"
                  title="OHIF viewer"
                  onError={() => setFailed(true)}
                />
              )
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-card ring-1 ring-border">
                  <ExternalLink className="h-5 w-5 text-faint" />
                </div>
                {!configured ? (
                  <>
                    <p className="text-[12.5px] font-semibold">OHIF viewer not configured</p>
                    <p className="max-w-[240px] text-[11.5px] leading-relaxed text-faint">
                      Set the LAN and Tailscale viewer URLs in Settings → Integrations. The viewer embeds here once configured.
                    </p>
                  </>
                ) : !studyInstanceUid ? (
                  <>
                    <p className="text-[12.5px] font-semibold">No study linked</p>
                    <p className="max-w-[240px] text-[11.5px] leading-relaxed text-faint">
                      {testName ? `${testName} has no Study Instance UID yet — match it from the Worklist.` : "Match this order to an Orthanc study first."}
                    </p>
                  </>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex h-full flex-col items-center pt-12">
          <span className="rotate-90 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.2em] text-faint">Viewer</span>
        </div>
      )}
    </div>
  );
}
