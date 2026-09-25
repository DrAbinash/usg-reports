import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { makeLookup, normaliseState, resolve } from "@/lib/usg/composer";
import { loadAllPathologies, loadNormalOverrides } from "@/lib/usg/server";
import { buildUsgReportHtml, formatUsgSerial, toUsgPrintSettings } from "@/lib/usg/print";
import { verifyShareToken } from "@/lib/usg/secureShare";
import { Download, Link2Off } from "lucide-react";

type PageProps = { params: Promise<{ token: string }> };

export const metadata: Metadata = {
  title: "Shared USG Report",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  other: { robots: "noindex, nofollow" },
};

function fmtDate(d: Date | null | undefined): string {
  const date = d ?? new Date();
  return new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function ExpiredView({ reason }: { reason: "expired" | "invalid" | "missing" }) {
  const title = reason === "expired" ? "Link Expired" : "Link Unavailable";
  const body =
    reason === "expired"
      ? "This secure report link has expired (valid for 7 days). Please ask the clinic to share again."
      : "This secure report link is invalid or the report is no longer available.";
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-rose-50 via-white to-violet-50 p-6">
      <meta name="robots" content="noindex, nofollow" />
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7 text-center shadow-lg">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
          <Link2Off className="h-5 w-5" />
        </div>
        <h1 className="text-[18px] font-extrabold tracking-tight">{title}</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

export default async function ShareReportPage({ params }: PageProps) {
  const { token: rawToken } = await params;
  const token = decodeURIComponent(rawToken);
  const verified = verifyShareToken(token);
  if ("error" in verified) {
    return <ExpiredView reason={verified.error} />;
  }

  const report = await db.usgReport.findUnique({
    where: { id: verified.reportId },
    include: { images: { orderBy: { sortOrder: "asc" } } },
  });
  if (!report || report.status !== "FINALIZED") {
    return <ExpiredView reason="missing" />;
  }

  const settings = await getSettings();
  let html = report.reportHtml?.trim() || "";
  if (!html) {
    const all = await loadAllPathologies();
    const lookup = makeLookup(all);
    const overrides = await loadNormalOverrides();
    let parsed: unknown = {};
    try {
      parsed = JSON.parse(report.stateJson || "{}");
    } catch {
      parsed = {};
    }
    const state = normaliseState(parsed, report.studyKey, overrides);
    const resolved = resolve(state, lookup, report.technique, overrides);
    html = buildUsgReportHtml(
      toUsgPrintSettings({
        ...(settings as unknown as Record<string, unknown>),
        studioId: (settings as { clinicId?: string }).clinicId ?? "default",
      }),
      {
        name: report.patientName,
        age: report.patientAge,
        sex: report.patientSex === "CHILD" ? "Child" : report.patientSex,
        referredBy: report.referredBy,
        date: fmtDate(report.scanDate ?? report.finalizedAt ?? report.createdAt),
        serial: report.serialNo != null ? formatUsgSerial(report.serialNo) : undefined,
        provisional: false,
      },
      resolved,
      report.images.map((i) => ({ dataUrl: i.dataUrl, caption: i.caption })),
    );
  }

  const pdfHref = `/api/usg/share/${encodeURIComponent(token)}/pdf`;
  const hospital = settings.hospitalName || "CARE Diagnostics";
  const serial =
    report.serialNo != null ? formatUsgSerial(report.serialNo) : report.id.slice(0, 8);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <meta name="robots" content="noindex, nofollow" />
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white/95 px-3.5 py-2.5 backdrop-blur print:hidden">
        <div>
          <h1 className="text-[14px] font-extrabold tracking-tight">{hospital}</h1>
          <p className="text-[11px] text-slate-500">
            Secure share · {serial} · valid 7 days
          </p>
        </div>
        <a
          href={pdfHref}
          download
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 text-[12px] font-bold text-sky-700 hover:bg-sky-100"
        >
          <Download className="h-3.5 w-3.5" /> Download PDF
        </a>
      </header>
      <div className="p-2.5 print:p-0">
        <iframe
          title="Shared USG report"
          srcDoc={html}
          className="min-h-[100vh] w-full rounded-xl border-0 bg-white shadow-sm print:rounded-none print:shadow-none"
        />
      </div>
    </div>
  );
}
