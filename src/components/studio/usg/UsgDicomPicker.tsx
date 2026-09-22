import { useState, useEffect } from "react";

type Series = { uid: string; description?: string; number?: number; modality?: string; count?: number };
type Instance = { sopUid: string; instanceNumber: number };

type Props = {
  open: boolean;
  onClose: () => void;
  reportId: string | null;
  studyInstanceUid: string | null;
  onAdded: () => void;
  onOcrResult?: (ocr: any) => void;
};

const asArray = (d: any): any[] =>
  Array.isArray(d) ? d : Array.isArray(d?.series) ? d.series : Array.isArray(d?.rows) ? d.rows : Array.isArray(d?.instances) ? d.instances : [];

export function UsgDicomPicker({ open, onClose, reportId, studyInstanceUid, onAdded, onOcrResult }: Props) {
  const [series, setSeries] = useState<Series[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<Series | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [ocrBusy, setOcrBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !studyInstanceUid) return;
    setLoading(true);
    fetch(`/api/usg/dicom/series?study=${encodeURIComponent(studyInstanceUid)}`)
      .then((r) => r.json())
      .then((data) => {
        const arr = asArray(data) as Series[];
        setSeries(arr);
        if (arr.length > 0) setSelectedSeries(arr[0]);
      })
      .catch(() => console.error("Could not load series"))
      .finally(() => setLoading(false));
  }, [open, studyInstanceUid]);

  useEffect(() => {
    if (!selectedSeries || !studyInstanceUid) return;
    fetch(`/api/usg/dicom/instances?study=${encodeURIComponent(studyInstanceUid)}&series=${encodeURIComponent(selectedSeries.uid)}`)
      .then((r) => r.json())
      .then((data) => {
        const arr = asArray(data) as Instance[];
        setInstances(arr);
        setSelected(new Set());
        const t: Record<string, string> = {};
        arr.forEach((inst) => {
          t[inst.sopUid] = `/api/usg/dicom/rendered?study=${encodeURIComponent(studyInstanceUid)}&series=${encodeURIComponent(selectedSeries.uid)}&sop=${encodeURIComponent(inst.sopUid)}&size=200`;
        });
        setThumbs(t);
      })
      .catch(() => console.error("Could not load instances"));
  }, [selectedSeries, studyInstanceUid]);

  const toggleSelect = (sopUid: string) =>
    setSelected((prev) => { const n = new Set(prev); if (n.has(sopUid)) n.delete(sopUid); else n.add(sopUid); return n; });

  const addSelected = async () => {
    if (!reportId || !studyInstanceUid || !selectedSeries || selected.size === 0) return;
    let added = 0;
    for (const sopUid of Array.from(selected)) {
      const inst = instances.find((i) => i.sopUid === sopUid);
      if (!inst) continue;
      try {
        const r = await fetch(`/api/usg/reports/${reportId}/images/dicom`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ studyInstanceUid, seriesInstanceUid: selectedSeries.uid, sopInstanceUid: sopUid, instanceNumber: inst.instanceNumber }),
        });
        if (r.ok) added++;
      } catch {}
    }
    if (added > 0) { alert(`${added} image(s) attached to report`); onAdded(); onClose(); }
    else alert("Could not attach images");
  };

  const runOcrOnSelected = async () => {
    if (selected.size === 0) return;
    const firstSop = Array.from(selected)[0];
    const thumbUrl = thumbs[firstSop];
    if (!thumbUrl) return;
    setOcrBusy(firstSop);
    try {
      const ocrUrl = thumbUrl.replace("size=200", "size=1024");
      const imgRes = await fetch(ocrUrl);
      const blob = await imgRes.blob();
      const reader = new FileReader();
      reader.onloadend = async () => {
        const imageBase64 = reader.result as string;
        const ocrRes = await fetch("/api/usg/ocr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageBase64 }) });
        if (ocrRes.ok) {
          const { ocr, engine } = await ocrRes.json();
          if (ocr && onOcrResult) { onOcrResult(ocr); alert(`OCR complete via ${engine} — verify extracted values`); }
        } else {
          const err = await ocrRes.json().catch(() => ({ error: "OCR failed" }));
          alert(err.error || "OCR failed");
        }
        setOcrBusy(null);
      };
      reader.readAsDataURL(blob);
    } catch (e: any) { alert(`OCR error: ${e.message}`); setOcrBusy(null); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold">Select Images from PACS</h2>
          <button onClick={onClose} className="text-faint hover:text-black text-2xl">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? <div className="py-12 text-center text-faint">Loading series…</div>
          : series.length === 0 ? <div className="py-12 text-center text-faint">No series found</div>
          : (
            <div className="flex gap-4 h-[60vh]">
              <div className="w-64 flex-shrink-0 overflow-y-auto border-r pr-2">
                <div className="mb-2 text-xs font-semibold text-faint">SERIES ({series.length})</div>
                {series.map((s) => (
                  <button key={s.uid} onClick={() => setSelectedSeries(s)}
                    className={`mb-1 w-full rounded px-3 py-2 text-left text-sm ${selectedSeries?.uid === s.uid ? "bg-indigo-50 font-semibold text-indigo-700" : "hover:bg-gray-50"}`}>
                    <div className="truncate">{s.description || `Series ${s.number ?? ""}`}</div>
                    <div className="text-xs text-faint">{s.modality} · {s.count ?? "?"} images</div>
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto">
                {instances.length === 0 ? <div className="py-12 text-center text-faint">No instances</div>
                : (
                  <div className="grid grid-cols-4 gap-3">
                    {instances.map((inst) => {
                      const isSel = selected.has(inst.sopUid);
                      return (
                        <div key={inst.sopUid} onClick={() => toggleSelect(inst.sopUid)}
                          className={`relative cursor-pointer rounded border-2 ${isSel ? "border-indigo-500" : "border-transparent hover:border-gray-300"}`}>
                          <img src={thumbs[inst.sopUid]} alt={`Image ${inst.instanceNumber}`} loading="lazy" className="h-32 w-full rounded object-cover" />
                          <div className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">{inst.instanceNumber}</div>
                          {isSel && <div className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-xs text-white">✓</div>}
                          {ocrBusy === inst.sopUid && (
                            <div className="absolute inset-0 flex items-center justify-center rounded bg-black/50">
                              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t bg-gray-50 px-6 py-4">
          <div className="text-sm text-faint">{selected.size > 0 ? `${selected.size} selected` : "Click thumbnails to select"}</div>
          <div className="flex gap-2">
            <button onClick={runOcrOnSelected} disabled={selected.size === 0 || !!ocrBusy}
              className="rounded border border-border px-4 py-2 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">
              {ocrBusy ? "OCR…" : "OCR Selected"}
            </button>
            <button onClick={addSelected} disabled={selected.size === 0}
              className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
              Attach to Report ({selected.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
