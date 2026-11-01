import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link2, Loader2, Ban } from "lucide-react";

type Candidate = {
  studyInstanceUid: string;
  studyDate: string | null;
  studyTime: string | null;
  testName: string;
  referringDoctor: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  orderId: string | null;
  patientName: string;
  currentUid: string | null;
  onLinked: () => void;
};

/**
 * Pick which study's images a worklist row should show.
 *
 * The sync links scans by patient name when the machine gives it nothing else,
 * and it marks those rows with a chip. This is what the chip is for: the two
 * scans of a same-named patient on one afternoon, or the wrong one of two visits,
 * corrected here in a click instead of by editing a database.
 *
 * Listing happens server-side (the order id is the only thing in the URL, never a
 * patient name), and the POST re-reads the DICOM header and refuses anything whose
 * PatientName does not match this row.
 */
export function UsgStudyLinkDialog({ open, onClose, orderId, patientName, currentUid, onLinked }: Props) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !orderId) return;
    setLoading(true);
    setNote(null);
    fetch(`/api/usg/worklist/${orderId}/link`)
      .then((r) => r.json())
      .then((d) => {
        setCandidates(Array.isArray(d?.candidates) ? d.candidates : []);
        if (d?.ok === false) setNote(d.error ?? "The PACS could not be asked.");
      })
      .catch(() => setNote("The PACS could not be asked."))
      .finally(() => setLoading(false));
  }, [open, orderId]);

  if (!open || !orderId) return null;

  const send = async (studyInstanceUid: string | null) => {
    setBusy(studyInstanceUid ?? "clear");
    try {
      const r = await fetch(`/api/usg/worklist/${orderId}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studyInstanceUid }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(d?.error ?? "The link was not changed.");
        return;
      }
      toast.success(studyInstanceUid ? "Images linked to that study." : "Images cleared from this row.");
      onLinked();
      onClose();
    } finally {
      setBusy(null);
    }
  };

  const hhmm = (t: string | null) => {
    const d = (t ?? "").replace(/[^0-9]/g, "");
    return d.length >= 4 ? `${d.slice(0, 2)}:${d.slice(2, 4)}` : "";
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Which study belongs to ${patientName}`}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-card p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center gap-2 text-sm font-bold">
          <Link2 className="h-4 w-4" /> Choose the study for {patientName}
        </div>
        <p className="mb-3 text-[11px] text-muted-foreground">
          Scans taken in the last few days whose header carries this patient's name. A study that names a
          different patient is refused, so this list is the whole argument.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-[12px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Asking the PACS…
          </div>
        ) : candidates.length === 0 ? (
          <p className="py-4 text-[12px] text-muted-foreground">
            {note ?? "No scans with this name are in the PACS right now."}
          </p>
        ) : (
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {candidates.map((c) => (
              <li key={c.studyInstanceUid}>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => send(c.studyInstanceUid)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-[12px] hover:bg-accent disabled:opacity-50 ${
                    c.studyInstanceUid === currentUid ? "border-emerald-300 bg-emerald-50/60" : "border-line"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{c.testName || "Study"}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {c.studyDate ?? "no date"} {hhmm(c.studyTime)}
                      {c.referringDoctor ? ` · ${c.referringDoctor}` : ""} · ..{c.studyInstanceUid.slice(-8)}
                    </span>
                  </span>
                  {c.studyInstanceUid === currentUid ? (
                    <span className="shrink-0 text-[10px] font-bold text-emerald-700">shown now</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={busy !== null || !currentUid}
            onClick={() => send(null)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-rose-700 disabled:opacity-40"
            title="Take the images off this row. The sync will not guess a replacement back in."
          >
            <Ban className="h-3.5 w-3.5" /> Clear this row's images
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-[12px] font-semibold hover:bg-accent"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
