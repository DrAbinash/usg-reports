import { useEffect, useState } from "react";

const LAN_OHIF = "http://172.16.1.139:3010";
const TS_OHIF = "https://ohif-viewer.tail7005c0.ts.net";

type Props = { studyInstanceUid: string | null };

/** v6.20 — embedded OHIF viewport inside the composer (your ERP's three modes):
 *  Compact strip · Enlarge overlay (Escape exits) · New-tab full page.
 *  Transport auto-selects by page scheme (https → Tailscale, http → LAN),
 *  with manual LAN/Tailscale override chips, exactly like the workspace. */
export function UsgViewerRail({ studyInstanceUid }: Props) {
  const [open, setOpen] = useState(true);
  const [wide, setWide] = useState(false);
  const [route, setRoute] = useState<"auto" | "lan" | "tailscale">("auto");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setWide(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pageHttps = typeof window !== "undefined" && window.location.protocol === "https:";
  const base = route === "lan" ? LAN_OHIF : route === "tailscale" ? TS_OHIF : pageHttps ? TS_OHIF : LAN_OHIF;
  const routeLabel = base === TS_OHIF ? "Tailscale" : "LAN";
  const src = studyInstanceUid ? `${base}/viewer?StudyInstanceUIDs=${encodeURIComponent(studyInstanceUid)}` : null;

  const toolbar = (
    <div className="flex items-center gap-2 px-3 py-1.5 text-[11px]">
      <span className="font-bold tracking-wide text-indigo-700">DICOM VIEWER</span>
      <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700">{routeLabel}</span>
      <div className="ml-auto flex items-center gap-1">
        {(["auto", "lan", "tailscale"] as const).map((r) => (
          <button key={r} type="button" onClick={() => setRoute(r)}
            className={`rounded px-2 py-0.5 font-semibold ${route === r ? "bg-indigo-600 text-white" : "bg-white text-faint hover:bg-gray-50"}`}>
            {r === "auto" ? "Auto" : r === "lan" ? "LAN" : "Tailscale"}
          </button>
        ))}
        <button type="button" onClick={() => setWide((w) => !w)}
          className="rounded border border-border bg-white px-2 py-0.5 font-semibold hover:bg-gray-50">
          {wide ? "Compact" : "Enlarge"}
        </button>
        {src && (
          <a href={src} target="_blank" rel="noreferrer"
            className="rounded border border-border bg-white px-2 py-0.5 font-semibold hover:bg-gray-50">New tab</a>
        )}
        <button type="button" onClick={() => setOpen((o) => !o)}
          className="rounded border border-border bg-white px-2 py-0.5 font-semibold hover:bg-gray-50">
          {open ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );

  const frame = src ? (
    <iframe title="OHIF DICOM viewer" src={src} className="h-full w-full border-0 bg-black" />
  ) : (
    <div className="flex h-full items-center justify-center text-xs text-faint">No study attached — awaiting images</div>
  );

  return (
    <>
      <div className="rounded-lg border border-border bg-white shadow-sm">
        {toolbar}
        {open && <div className="h-[30vh] overflow-hidden rounded-b-lg">{frame}</div>}
      </div>
      {wide && src && (
        <div className="fixed inset-4 z-40 flex flex-col overflow-hidden rounded-lg border border-border bg-white shadow-2xl">
          {toolbar}
          <div className="flex-1 overflow-hidden">{frame}</div>
        </div>
      )}
    </>
  );
}
