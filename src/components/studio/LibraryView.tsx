"use client";
/** Library — finalized reports (frozen snapshots), preview + reprint. */
import { useEffect, useState } from "react";
import { BillingBadge, ModalityChip, SectionLabel } from "./bits";
import { PrintOverlay } from "./PrintOverlay";
import { Button } from "@/components/ui/button";
import { BookLock, Printer, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type LibReport = {
  id: string; accession: string; patientName: string; patientAge: string | null;
  testName: string | null; modality: string; billingStatus: string | null;
  finalizedAt: string | null; reportHtml: string | null;
};

export function LibraryView() {
  const [reports, setReports] = useState<LibReport[]>([]);
  const [search, setSearch] = useState("");
  const [printHtml, setPrintHtml] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/library")
      .then((r) => r.json())
      .then((d) => setReports(d.reports ?? []))
      .catch(() => toast.error("Could not load the library"));
  }, []);

  const shown = reports.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      r.patientName.toLowerCase().includes(q) ||
      r.accession.toLowerCase().includes(q) ||
      (r.testName ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <BookLock className="h-4 w-4 text-primary" />
        <SectionLabel>Library · finalized reports</SectionLabel>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search archived reports…"
          className="h-10 border-border bg-card pl-9 text-[13px]"
        />
      </div>

      {shown.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/50 px-3 py-10 text-center text-[12px] text-faint">
          Nothing finalized yet. Reports appear here the moment they are stamped.
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
            >
              <ModalityChip modality={r.modality} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-semibold">{r.patientName}</span>
                  <span className="hidden shrink-0 font-mono text-[10px] text-faint sm:inline">{r.accession}</span>
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {r.testName ?? "—"}
                  {r.finalizedAt
                    ? ` · finalized ${new Date(r.finalizedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`
                    : ""}
                </div>
              </div>
              <BillingBadge status={r.billingStatus} />
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-border bg-card text-[11.5px]"
                disabled={!r.reportHtml}
                onClick={() => setPrintHtml(r.reportHtml)}
              >
                <Printer className="mr-1.5 h-3 w-3" /> Reprint
              </Button>
            </div>
          ))}
        </div>
      )}

      {printHtml ? <PrintOverlay html={printHtml} onClose={() => setPrintHtml(null)} /> : null}
    </div>
  );
}
