"use client";
/** PACS-only fallback queue — fully self-contained; renders only when CARE is down. */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { WifiOff, Activity, RefreshCw } from "lucide-react";

type PacsRow = {
  worklistId: string; accessionNumber: string; patientName: string;
  patientAge: string; patientSex: string; referringDoctor: string;
  testName: string; studyDate: string | null; studyInstanceUid: string;
};

export function UsgPacsQueue() {
  const router = useRouter();
  const [rows, setRows] = useState<PacsRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/usg/worklist/pacs");
      if (r.ok) { setRows(((await r.json()).rows ?? []) as PacsRow[]); setError(null); }
      else setError(`PACS query failed (HTTP ${r.status}) — the route itself is broken; check studio logs.`);
    } catch { setError("PACS route unreachable (network/exception)."); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const draft = async (row: PacsRow) => {
    setBusy(row.worklistId);
    try {
      const r = await fetch("/api/usg/reports/pacs-draft", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row),
      });
      if (r.ok) router.push(`/studio/usg/${(await r.json()).reportId}`);
    } catch { /* ignore */ } finally { setBusy(null); }
  };

  return (
    <div className="rounded-lg border-2 border-dashed border-orange-400 bg-orange-50 p-4 dark:border-orange-600 dark:bg-orange-900/20">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <WifiOff className="h-5 w-5 text-orange-600" />
          <span className="font-bold text-orange-800 dark:text-orange-300">
            CARE ERP unreachable — live PACS queue (unbilled drafts only)
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-2 h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Loading…" : "Refresh"}
        </Button>
      </div>
      {rows.length > 0 ? (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.worklistId} className="flex items-center justify-between rounded border border-orange-200 bg-white p-3 dark:border-orange-700 dark:bg-gray-800">
              <div>
                <div className="font-semibold">
                  {row.patientName}{" "}
                  <span className="text-xs text-muted-foreground">({row.patientAge || "?"} / {row.patientSex || "?"})</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {row.testName || "USG study"} · {row.studyDate ?? "no date"} · {row.accessionNumber || "no accession"} · {row.referringDoctor}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost"
                  onClick={() => window.open(`http://172.16.1.139:3010/viewer?StudyInstanceUIDs=${row.studyInstanceUid}`, "_blank")}>
                  <Activity className="mr-1 h-3 w-3" /> Viewer
                </Button>
                <Button size="sm" disabled={busy === row.worklistId}
                  className="bg-orange-600 text-white hover:bg-orange-700"
                  onClick={() => void draft(row)}>
                  Draft report (UNBILLED)
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-2 text-center text-sm text-orange-700 dark:text-orange-400">
          {loading ? "Asking Orthanc…" : error ? <span className="font-semibold text-red-600 dark:text-red-400">{error}</span> : "No USG studies in Orthanc from the last 72 hours."}
        </div>
      )}
    </div>
  );
}
