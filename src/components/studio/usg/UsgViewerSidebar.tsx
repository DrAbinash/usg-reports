"use client";
/**
 * Embedded OHIF — CARE enlarge model adapted to USG Studio:
 *   1. Column vertical (split / Viewer+ / letterpad) — mutual resize with letterpad
 *   2. Fullscreen overlay
 *   3. Open in new tab
 *
 * Click / iframe-focus → parent promotes Viewer+; letterpad click shrinks us.
 *
 * The viewer URL is never constructed here: it comes from the shared resolver
 * (src/lib/usg/ohifResolver.ts via /api/usg/ohif/status), so this pane follows
 * the same AUTO/manual routing as every other launch path in the studio.
 */
import { useCallback, useEffect, useState } from "react";
import { Columns2, Maximize2, Minimize2, Monitor, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  OHIF_ROUTE_BUTTONS,
  buildOhifViewerUrl,
  fetchOhifStatus,
  getCachedOhifStatus,
  invalidateOhifStatusCache,
  ohifRouteLabel,
  pickOhifEndpoint,
  readStoredOhifRoute,
  storeOhifRoute,
  type OhifEndpointInfo,
  type OhifLayoutMode,
  type OhifRoute,
  type OhifStatus,
} from "@/lib/usg/ohifLaunch";

type Props = {
  studyInstanceUid: string | null;
  layout?: OhifLayoutMode;
  onLayoutChange?: (mode: OhifLayoutMode) => void;
  /** Fired when user engages the OHIF pane (chrome click or iframe focus). */
  onActivate?: () => void;
};

const LAYOUT_STORAGE = "care-usg-ohif-layout";

/** AUTO/L/T/C buttons are troubleshooting aids, so each shows its own truth. */
function endpointOf(status: OhifStatus | null, key: OhifRoute): OhifEndpointInfo | null {
  if (!status || key === "auto") return null;
  return status.endpoints.find((e) => e.key === key) ?? null;
}

export function UsgViewerSidebar({
  studyInstanceUid,
  layout: layoutProp,
  onLayoutChange,
  onActivate,
}: Props) {
  const [route, setRoute] = useState<OhifRoute>(() => readStoredOhifRoute());
  const [status, setStatus] = useState<OhifStatus | null>(() => getCachedOhifStatus(route));
  /** The resolution this pane is currently showing, tagged with the inputs it
   * was computed for so a stale result can never be rendered. */
  const [resolved, setResolved] = useState<{
    key: string;
    src: string | null;
    active: OhifEndpointInfo | null;
    /** Reachable, but this browser would refuse to embed it (https page, http
     * viewer). Surfaced instead of silently showing a blank frame. */
    blocked: OhifEndpointInfo | null;
  } | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

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

  // Resolve the endpoint for this study + route. The reporting workspace never
  // waits on this: until it lands we show a status strip, and a failure leaves
  // the pane idle rather than hanging.
  const resolveKey = `${studyInstanceUid}|${route}|${reloadNonce}`;
  useEffect(() => {
    if (!studyInstanceUid) return;
    let alive = true;
    const key = resolveKey;
    void (async () => {
      const s = await fetchOhifStatus({ route });
      if (!alive) return;
      setStatus(s);
      const pick = s
        ? pickOhifEndpoint(s, route, window.location.protocol)
        : { endpoint: null, blocked: null };
      setResolved({
        key,
        src: pick.endpoint ? buildOhifViewerUrl(pick.endpoint.url, studyInstanceUid) : null,
        active: pick.endpoint,
        blocked: pick.blocked,
      });
    })();
    return () => {
      alive = false;
    };
  }, [studyInstanceUid, route, reloadNonce]);

  // Derived rather than stored — setting this synchronously in the effect above
  // would cascade an extra render on every resolve.
  const resolving = resolved?.key !== resolveKey;
  const src = resolving ? null : resolved!.src;
  const active = resolving ? null : resolved!.active;
  const blockedByMixedContent = resolving ? null : resolved!.blocked;

  const chooseRoute = useCallback((next: OhifRoute) => {
    setRoute(next);
    storeOhifRoute(next);
  }, []);

  /** Drop both caches and re-probe — the "it was working a minute ago" button. */
  const recheck = useCallback(() => {
    invalidateOhifStatusCache();
    setReloadNonce((n) => n + 1);
  }, []);

  if (!studyInstanceUid) return null;

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

  const statusChip = resolving
    ? { text: "routing…", cls: "bg-white/10 text-white/70" }
    : active
      ? active.reachable === false
        ? { text: `${ohifRouteLabel(route)} down`, cls: "bg-red-500/25 text-red-200" }
        : {
            text: active.sameOrigin ? `${ohifRouteLabel(active.key)} ·same-origin` : ohifRouteLabel(active.key),
            cls: "bg-emerald-500/25 text-emerald-200",
          }
      : { text: "no viewer", cls: "bg-amber-500/25 text-amber-200" };

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
        <div className="flex shrink-0 flex-col border-b border-white/10 bg-slate-900 text-[10px] text-white">
          <div className="flex items-center gap-1 px-2 py-1">
            <span className="font-bold text-sky-300">DICOM</span>
            <span
              className={cn("rounded px-1.5 py-0.5 font-semibold", statusChip.cls)}
              data-testid="ohif-route-status"
              title={active?.url || status?.serverPick.reason || "no endpoint resolved"}
            >
              {statusChip.text}
            </span>

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
              {OHIF_ROUTE_BUTTONS.map((r) => {
                const ep = endpointOf(status, r);
                const usable = r === "auto" || (ep?.configured ?? false);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      chooseRoute(r);
                    }}
                    title={
                      r === "auto"
                        ? "AUTO — route by measured reachability (LAN → custom → Tailscale)"
                        : !usable
                          ? `${ohifRouteLabel(r)} is not configured (Settings → Integrations → OHIF Viewer)`
                          : ep?.reachable === false
                            ? `${ohifRouteLabel(r)} — forced, currently unreachable: ${ep.error ?? "no answer"}`
                            : `Force ${ohifRouteLabel(r)} route`
                    }
                    aria-disabled={!usable}
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[9px] font-semibold",
                      route === r ? "bg-sky-500 text-white" : "bg-white/10 text-white/70 hover:bg-white/20",
                      !usable && route !== r && "opacity-40",
                    )}
                  >
                    {ohifRouteLabel(r).slice(0, 1)}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  recheck();
                }}
                title="Re-check viewer reachability now"
                className="rounded bg-white/10 p-1 text-white/80 hover:bg-white/20"
              >
                <RefreshCw className={cn("h-3 w-3", resolving && "animate-spin")} />
              </button>
              {src ? (
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
              ) : null}
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

          {blockedByMixedContent ? (
            <p
              className="border-t border-amber-400/30 bg-amber-500/15 px-2 py-1 text-[9.5px] text-amber-100"
              data-testid="ohif-mixed-content-notice"
              onPointerDownCapture={(e) => e.stopPropagation()}
            >
              {blockedByMixedContent.label} ({blockedByMixedContent.url}) is reachable, but this page is
              HTTPS — a browser will not embed an HTTP viewer. Open it in a new tab, or add a
              same-origin endpoint in Settings → Integrations → OHIF Viewer.
            </p>
          ) : !resolving && !active ? (
            <p
              className="border-t border-white/10 bg-slate-800 px-2 py-1 text-[9.5px] text-white/70"
              data-testid="ohif-unavailable-notice"
            >
              {status?.serverPick.reason ?? "Viewer routing status unavailable."} — reporting continues
              normally. <button type="button" onClick={() => recheck()} className="font-bold underline">Retry</button>
            </p>
          ) : null}
        </div>

        {src ? (
          <iframe
            title="OHIF DICOM viewer"
            data-testid="ohif-embed"
            src={src}
            className="block h-full min-h-0 w-full flex-1 border-0 bg-black"
            style={{ height: "100%" }}
            allow="fullscreen"
          />
        ) : (
          <div
            className="flex flex-1 items-center justify-center bg-black px-3 text-center text-[10px] text-white/50"
            data-testid="ohif-embed-placeholder"
          >
            {resolving ? "Finding the nearest OHIF viewer…" : "DICOM viewer not available on this route"}
          </div>
        )}
      </div>
    </>
  );
}
