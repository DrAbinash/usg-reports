import { useState } from "react";

const LAN_OHIF = "http://172.16.1.139:3010";
const TS_OHIF = "https://ohif-viewer.tail7005c0.ts.net";

type Props = { studyInstanceUid: string | null };

/** v6.22 — compact left-sidebar DICOM viewer for emergency reference.
 *  ~200px wide, collapsible, only shown when a study is attached. */
export function UsgViewerSidebar({ studyInstanceUid }: Props) {
  const [open, setOpen] = useState(true);
  const [route, setRoute] = useState<"auto" | "lan" | "tailscale">("auto");

  if (!studyInstanceUid) return null;

  const pageHttps = typeof window !== "undefined" && window.location.protocol === "https:";
  const base = route === "lan" ? LAN_OHIF : route === "tailscale" ? TS_OHIF : pageHttps ? TS_OHIF : LAN_OHIF;
  const routeLabel = base === TS_OHIF ? "TS" : "LAN";
  const src = `${base}/viewer?StudyInstanceUIDs=${encodeURIComponent(studyInstanceUid)}`;

  return (
    <div className="rounded-lg border border-border bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-1 px-2 py-1.5 text-[10px] border-b bg-gray-50">
        <span className="font-bold text-indigo-700">DICOM</span>
        <span className="rounded bg-indigo-100 px-1.5 py-0.5 font-semibold text-indigo-700">{routeLabel}</span>
        <div className="ml-auto flex items-center gap-0.5">
          {(["auto", "lan", "tailscale"] as const).map((r) => (
            <button key={r} type="button" onClick={() => setRoute(r)}
              className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                route === r ? "bg-indigo-600 text-white" : "bg-white text-faint hover:bg-gray-100"
              }`}>
              {r === "auto" ? "A" : r === "lan" ? "L" : "T"}
            </button>
          ))}
          <a href={src} target="_blank" rel="noreferrer"
            className="rounded bg-white px-1.5 py-0.5 text-[9px] font-semibold hover:bg-gray-100" title="Open in new tab">
            ↗
          </a>
          <button type="button" onClick={() => setOpen((o) => !o)}
            className="rounded bg-white px-1.5 py-0.5 text-[9px] font-semibold hover:bg-gray-100">
            {open ? "−" : "+"}
          </button>
        </div>
      </div>
      {open && (
        <iframe
          title="OHIF DICOM viewer"
          src={src}
          className="w-full border-0 bg-black"
          style={{ height: "280px" }}
        />
      )}
    </div>
  );
}
