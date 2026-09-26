"use client";
/**
 * Embedded OHIF — CARE enlarge model adapted to USG Studio:
 *   1. Column vertical (split / Viewer+ / letterpad) — mutual resize with letterpad
 *   2. Fullscreen overlay
 *   3. Open in new tab
 *
 * Click / iframe-focus → parent promotes Viewer+; letterpad click shrinks us.
 */
import { useEffect, useRef, useState } from "react";
import { Columns2, Maximize2, Minimize2, Monitor, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type OhifLayoutMode,
  type OhifRoute,
  ohifRouteLabel,
  ohifViewerUrl,
} from "@/lib/usg/ohifLaunch";

type Props = {
  studyInstanceUid: string | null;
  layout?: OhifLayoutMode;
  onLayoutChange?: (mode: OhifLayoutMode) => void;
  /** Fired when user engages the OHIF pane (chrome click or iframe focus). */
  onActivate?: () => void;
};

const LAYOUT_STORAGE = "care-usg-ohif-layout";

export function UsgViewerSidebar({
  studyInstanceUid,
  layout: layoutProp,
  onLayoutChange,
  onActivate,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [route, setRoute] = useState<OhifRoute>("auto");
  const [localLayout, setLocalLayout] = useState<OhifLayoutMode>(() => {
    try {
      const v = sessionStorage.getItem(LAYOUT_STORAGE);
      if (v === "report" || v === "split" || v === "viewerPlus" || v === "letterpad") return v;
    } catch {
      /* ignore */
    }
    return "split";
  });
  const [fullscreen, setFullscreen] = useState(false);

  const layout = layoutProp ?? localLayout;
  const setLayout = (mode: OhifLayoutMode) => {
    setLocalLayout(mode);
    try {
      sessionStorage.setItem(LAYOUT_STORAGE, mode);
    } catch {
      /* ignore */
    }
    onLayoutChange?.(mode);
  };

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  // CARE pattern: clicks inside the OHIF iframe do not bubble — detect via blur.
  useEffect(() => {
    const onBlur = () => {
      requestAnimationFrame(() => {
        const ae = document.activeElement;
        if (ae instanceof HTMLIFrameElement && ae.dataset.testid === "ohif-embed") {
          onActivate?.();
        }
      });
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [onActivate]);

  if (!studyInstanceUid) return null;

  const src = ohifViewerUrl(studyInstanceUid, route);
  const routeLabel = ohifRouteLabel(route);
  const reportFocus = layout === "report" && !fullscreen;

  // Height share vs letterpad (click either side to bias the other down).
  const shellClass = fullscreen
    ? "fixed inset-0 z-[60] flex flex-col bg-black shadow-2xl"
    : cn(
        "flex w-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-black shadow-sm transition-[flex-basis,flex-grow] duration-200",
        reportFocus && "hidden",
        !reportFocus && layout === "viewerPlus" && "min-h-0 flex-[1_1_90%]",
        !reportFocus && layout === "split" && "min-h-[240px] flex-[1_1_58%]",
        !reportFocus && layout === "letterpad" && "min-h-[120px] max-h-[28%] flex-[0_0_22%]",
      );

  return (
    <>
      {reportFocus ? (
        <button
          type="button"
          onClick={() => setLayout("split")}
          className="flex w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-dashed border-sky-300 bg-sky-50/80 px-3 py-2 text-[11px] font-semibold text-sky-900 hover:bg-sky-100"
          title="Show embedded OHIF viewer"
        >
          <Columns2 className="h-3.5 w-3.5" />
          OHIF / WADO images are hidden — click to open
        </button>
      ) : null}

      <div
        className={shellClass}
        data-testid="embedded-ohif-shell"
        onPointerDownCapture={() => onActivate?.()}
      >
        <div className="flex shrink-0 items-center gap-1 border-b border-white/10 bg-slate-900 px-2 py-1 text-[10px] text-white">
          <span className="font-bold text-sky-300">DICOM</span>
          <span className="rounded bg-sky-500/20 px-1.5 py-0.5 font-semibold text-sky-200">{routeLabel}</span>

          <div
            className="ml-1 flex items-center overflow-hidden rounded border border-white/15"
            data-testid="ohif-layout-selector"
          >
            {(
              [
                { mode: "report" as const, label: "Report", Icon: Minimize2, title: "Hide viewer — writing focus" },
                { mode: "split" as const, label: "Split", Icon: Columns2, title: "Balanced OHIF + letterpad" },
                { mode: "viewerPlus" as const, label: "OHIF+", Icon: Monitor, title: "Enlarge OHIF (shrink letterpad)" },
              ] as const
            ).map(({ mode, label, Icon, title }) => (
              <button
                key={mode}
                type="button"
                title={title}
                aria-pressed={layout === mode && !fullscreen}
                onClick={(e) => {
                  e.stopPropagation();
                  setFullscreen(false);
                  setLayout(mode);
                }}
                className={cn(
                  "inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold transition-colors",
                  layout === mode && !fullscreen
                    ? "bg-sky-500 text-white"
                    : "bg-white/5 text-white/70 hover:bg-white/15",
                )}
              >
                <Icon className="h-3 w-3" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-0.5">
            {(["auto", "lan", "tailscale"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setRoute(r);
                }}
                className={cn(
                  "rounded px-1.5 py-0.5 text-[9px] font-semibold",
                  route === r ? "bg-sky-500 text-white" : "bg-white/10 text-white/70 hover:bg-white/20",
                )}
              >
                {r === "auto" ? "A" : r === "lan" ? "L" : "T"}
              </button>
            ))}
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold text-white/80 hover:bg-white/20"
              title="Open in new tab"
            >
              ↗
            </a>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setFullscreen((v) => !v);
              }}
              className={cn(
                "rounded px-1.5 py-0.5 text-[9px] font-semibold hover:bg-white/20",
                fullscreen ? "bg-amber-500 text-white" : "bg-white/10 text-white/80",
              )}
              title={fullscreen ? "Exit fullscreen overlay (Esc)" : "Fullscreen overlay"}
            >
              {fullscreen ? <X className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            </button>
          </div>
        </div>

        <iframe
          ref={iframeRef}
          title="OHIF DICOM viewer"
          data-testid="ohif-embed"
          src={src}
          className="block h-full min-h-0 w-full flex-1 border-0 bg-black"
          style={{ height: "100%" }}
          allow="fullscreen"
        />
      </div>
    </>
  );
}
