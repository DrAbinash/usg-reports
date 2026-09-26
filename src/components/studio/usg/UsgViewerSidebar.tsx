import { useState } from "react";

const LAN_OHIF = "http://172.16.1.139:3010";
const TS_OHIF = "https://ohif-viewer.tail7005c0.ts.net";

type Props = { studyInstanceUid: string | null };

/** Expand modes for the embedded OHIF pane.
 *  - vertical (default): tall diagnostic box (~65% column height, portrait/square)
 *  - horizontal: legacy short ribbon (explicit opt-in)
 *  - collapsed: header only */
type ExpandMode = "collapsed" | "vertical" | "horizontal";

/** Stacked OHIF viewer above the letterpad preview.
 *  Defaults to a tall vertical box so the diagnostic viewport is usable;
 *  the report preview stays below (never beside) in PreviewZone's column. */
export function UsgViewerSidebar({ studyInstanceUid }: Props) {
  const [mode, setMode] = useState<ExpandMode>("vertical");
  const [route, setRoute] = useState<"auto" | "lan" | "tailscale">("auto");

  if (!studyInstanceUid) return null;

  const pageHttps = typeof window !== "undefined" && window.location.protocol === "https:";
  const base = route === "lan" ? LAN_OHIF : route === "tailscale" ? TS_OHIF : pageHttps ? TS_OHIF : LAN_OHIF;
  const routeLabel = base === TS_OHIF ? "TS" : "LAN";
  const src = `${base}/viewer?StudyInstanceUIDs=${encodeURIComponent(studyInstanceUid)}`;
  const open = mode !== "collapsed";

  // Vertical: ~65% of the preview column, width locked to a portrait/square aspect
  // so the pane cannot collapse into a landscape ribbon. Horizontal: legacy 280px strip.
  const shellClass =
    mode === "vertical"
      ? "mx-auto flex aspect-[4/5] w-auto max-w-full min-h-[300px] flex-[0_0_65%] flex-col self-center overflow-hidden rounded-lg border border-border bg-white shadow-sm"
      : mode === "horizontal"
        ? "flex w-full shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-white shadow-sm"
        : "w-full shrink-0 overflow-hidden rounded-lg border border-border bg-white shadow-sm";

  return (
    <div className={shellClass}>
      <div className="flex shrink-0 items-center gap-1 border-b bg-gray-50 px-2 py-1.5 text-[10px]">
        <span className="font-bold text-indigo-700">DICOM</span>
        <span className="rounded bg-indigo-100 px-1.5 py-0.5 font-semibold text-indigo-700">{routeLabel}</span>
        <span
          className="rounded bg-white px-1.5 py-0.5 font-semibold text-faint"
          title={
            mode === "vertical"
              ? "Tall vertical viewer (default)"
              : mode === "horizontal"
                ? "Wide ribbon viewer"
                : "Collapsed"
          }
        >
          {mode === "vertical" ? "Tall" : mode === "horizontal" ? "Wide" : "Hide"}
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          {(["auto", "lan", "tailscale"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoute(r)}
              className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                route === r ? "bg-indigo-600 text-white" : "bg-white text-faint hover:bg-gray-100"
              }`}
            >
              {r === "auto" ? "A" : r === "lan" ? "L" : "T"}
            </button>
          ))}
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="rounded bg-white px-1.5 py-0.5 text-[9px] font-semibold hover:bg-gray-100"
            title="Open in new tab"
          >
            ↗
          </a>
          {open && (
            <button
              type="button"
              onClick={() => setMode((m) => (m === "horizontal" ? "vertical" : "horizontal"))}
              className={`rounded px-1.5 py-0.5 text-[9px] font-semibold hover:bg-gray-100 ${
                mode === "horizontal" ? "bg-indigo-600 text-white" : "bg-white text-faint"
              }`}
              title={mode === "horizontal" ? "Switch to tall vertical" : "Switch to wide ribbon"}
            >
              {mode === "horizontal" ? "▮" : "▬"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setMode((m) => (m === "collapsed" ? "vertical" : "collapsed"))}
            className="rounded bg-white px-1.5 py-0.5 text-[9px] font-semibold hover:bg-gray-100"
            title={open ? "Collapse viewer" : "Expand tall viewer"}
          >
            {open ? "−" : "+"}
          </button>
        </div>
      </div>
      {open && (
        <iframe
          title="OHIF DICOM viewer"
          src={src}
          className={
            mode === "vertical"
              ? "min-h-0 w-full flex-1 border-0 bg-black"
              : "w-full border-0 bg-black"
          }
          style={mode === "horizontal" ? { height: "280px" } : undefined}
        />
      )}
    </div>
  );
}
