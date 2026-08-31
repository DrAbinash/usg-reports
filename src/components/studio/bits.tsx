"use client";
/** Shared clinical chips and badges. */
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const MODALITY_STYLES: Record<string, { label: string; cls: string }> = {
  MR: { label: "MR", cls: "bg-[#e8f0f7] text-[#24567f] ring-[#c6d9e9]" },
  CT: { label: "CT", cls: "bg-teal-50 text-teal-800 ring-teal-200" },
  USG: { label: "USG", cls: "bg-violet-50 text-violet-800 ring-violet-200" },
  "X-Ray": { label: "X-RAY", cls: "bg-amber-50 text-amber-800 ring-amber-200" },
};

export function ModalityChip({ modality, className }: { modality: string; className?: string }) {
  const m = MODALITY_STYLES[modality] ?? MODALITY_STYLES.MR;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ring-1",
        m.cls,
        className,
      )}
    >
      {m.label}
    </span>
  );
}

const BILLING: Record<string, { label: string; cls: string }> = {
  PAID: { label: "PAID", cls: "bg-ok-bg text-ok ring-ok-line" },
  DUE: { label: "DUE", cls: "bg-bad-bg text-bad ring-bad-line" },
  UPI_PENDING: { label: "UPI PENDING", cls: "bg-warn-bg text-warn ring-warn-line" },
};

export function BillingBadge({ status }: { status: string | null }) {
  if (!status || !BILLING[status]) {
    return <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-faint ring-1 ring-border">BILLING N/A</span>;
  }
  const b = BILLING[status];
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ring-1", b.cls)}>
      {b.label}
    </span>
  );
}

const STATUS: Record<string, { label: string; cls: string }> = {
  TO_REPORT: { label: "To report", cls: "bg-[#e8f0f7] text-[#24567f] ring-[#c6d9e9]" },
  REPORTING: { label: "Reporting", cls: "bg-warn-bg text-warn ring-warn-line" },
  REPORTED: { label: "Reported", cls: "bg-ok-bg text-ok ring-ok-line" },
  AWAITING_IMAGES: { label: "Awaiting images", cls: "bg-muted text-muted-foreground ring-border" },
};

export function StatusChip({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, cls: "bg-muted text-muted-foreground ring-border" };
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1", s.cls)}>
      {s.label}
    </span>
  );
}

export function SeverityPill({ severity }: { severity: string | null }) {
  if (!severity) return null;
  const map: Record<string, string> = {
    mild: "bg-ok-bg text-ok ring-ok-line",
    moderate: "bg-warn-bg text-warn ring-warn-line",
    severe: "bg-bad-bg text-bad ring-bad-line",
  };
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize ring-1", map[severity] ?? "bg-muted text-muted-foreground ring-border")}>
      {severity}
    </span>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">{children}</div>;
}
