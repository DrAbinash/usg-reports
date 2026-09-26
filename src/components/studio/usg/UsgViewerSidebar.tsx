import { useState } from "react";

const LAN_OHIF = "http://172.16.1.139:3010";
const TS_OHIF = "https://ohif-viewer.tail7005c0.ts.net";

type Props = {
  studyInstanceUid: string | null;
  /** When true, occupy most of the preview column (focus / enlarge). */
  enlarged?: boolean;
};

/** Expand modes for the embedded OHIF pane.
 *  - vertical (default): full-width tall pane; iframe fills the box (no letterbox)
 *  - horizontal: short ribbon (explicit opt-in)
 *  - collapsed: header only */
type ExpandMode = "collapsed" | "vertical" | "horizontal";

/** Stacked OHIF viewer above the letterpad preview.
 *  The shell is always full column width so enlarge grows the DICOM viewport,
 *  not empty white gutters around a locked aspect box. */
export function UsgViewerSidebar({ studyInstanceUid, enlarged = false }: Props) {
  const [mode, setMode] = useState<ExpandMode>("vertical");
  const [route, setRoute] = useState<"auto" | "lan" | "tailscale">("auto");

  if (!studyInstanceUid) return null;

  const pageHttps = typeof window !== "undefined" && window.location.protocol === "https:";
  const base = route === "lan" ? LAN_OHIF : route === "tailscale" ? TS_OHIF : pageHttps ? TS_OHIF : LAN_OHIF;
  const routeLabel = base === TS_OHIF ? "TS" : "LAN";
  const src = `${base}/viewer?StudyInstanceUIDs=${encodeURIComponent(studyInstanceUid)}`;
  const open = mode !== "collapsed";

  // Full-width shells only — never aspect-lock / center (that left white gutters
  // while the preview column grew on enlarge).
  const shellClass =
    mode === "vertical"
      ? `flex w-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-black shadow-sm ${
          enlarged ? "flex-[0_0_72%]" : "flex-[0_0_62%]"
        }`
      : mode === "horizontal"
        ? "flex w-full shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-black shadow-sm"
        : "w-full shrink-0 overflow-hidden rounded-lg border border-border bg-white shadow-sm";

  return (
    <div className={shellClass}>
      <div className="flex shrink-0 items-center gap-1 border-b border-white/10 bg-slate-900 px-2 py-1 text-[10px] text-white">
        <span className="font-bold text-sky-300">DICOM</span>
        <span className="rounded bg-sky-500/20 px-1.5 py-0.5 font-semibold text-sky-200">{routeLabel}</span>
        <span
          className="rounded bg-white/10 px-1.5 py-0.5 font-semibold text-white/80"
          title={
            mode === "vertical"
              ? "Tall viewer (default) — fills column width"
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
                route === r ? "bg-sky-500 text-white" : "bg-white/10 text-white/70 hover:bg-white/20"
              }`}
            >
              {r === "auto" ? "A" : r === "lan" ? "L" : "T"}
            </button>
          ))}
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold text-white/80 hover:bg-white/20"
            title="Open in new tab"
          >
            ↗
          </a>
          {open && (
            <button
              type="button"
              onClick={() => setMode((m) => (m === "horizontal" ? "vertical" : "horizontal"))}
              className={`rounded px-1.5 py-0.5 text-[9px] font-semibold hover:bg-white/20 ${
                mode === "horizontal" ? "bg-sky-500 text-white" : "bg-white/10 text-white/70"
              }`}
              title={mode === "horizontal" ? "Switch to tall vertical" : "Switch to wide ribbon"}
            >
              {mode === "horizontal" ? "▮" : "▬"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setMode((m) => (m === "collapsed" ? "vertical" : "collapsed"))}
            className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold text-white/80 hover:bg-white/20"
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
              ? "block h-full min-h-0 w-full flex-1 border-0 bg-black"
              : "block w-full border-0 bg-black"
          }
          style={mode === "horizontal" ? { height: "220px" } : { height: "100%" }}
        />
      )}
    </div>
  );
}
