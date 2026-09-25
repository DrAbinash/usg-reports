import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { makeLookup, normaliseState, resolve } from "@/lib/usg/composer";
import { loadAllPathologies, loadNormalOverrides } from "@/lib/usg/server";
import { buildUsgReportPdf } from "@/lib/usg/pdf";
import { formatUsgSerial, toUsgPrintSettings } from "@/lib/usg/print";
import { verifyShareToken } from "@/lib/usg/secureShare";

type Ctx = { params: Promise<{ token: string }> };

function fmtDate(d: Date | null | undefined): string {
  const date = d ?? new Date();
  return new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * GET /api/usg/share/[token]/pdf — public PDF download for a valid share token.
 * Session not required; token is the auth.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const decoded = decodeURIComponent(token);
  const verified = verifyShareToken(decoded);
  if ("error" in verified) {
    return Response.json(
      { error: verified.error === "expired" ? "Link expired" : "Invalid link" },
      { status: verified.error === "expired" ? 410 : 400 },
    );
  }

  const report = await db.usgReport.findUnique({
    where: { id: verified.reportId },
    include: { images: { orderBy: { sortOrder: "asc" } } },
  });
  if (!report || report.status !== "FINALIZED") {
    return Response.json({ error: "Report not available" }, { status: 404 });
  }

  const settings = await getSettings();
  const all = await loadAllPathologies();
  const lookup = makeLookup(all);
  const overrides = await loadNormalOverrides();
  const state = normaliseState(
    (() => {
      try {
        return JSON.parse(report.stateJson || "{}");
      } catch {
        return {};
      }
    })(),
    report.studyKey,
    overrides,
  );
  const resolved = resolve(state, lookup, report.technique, overrides);

  const bytes = await buildUsgReportPdf({
    settings: toUsgPrintSettings({
      ...(settings as unknown as Record<string, unknown>),
      studioId: (settings as { clinicId?: string }).clinicId ?? "default",
    }),
    patient: {
      name: report.patientName,
      age: report.patientAge,
      sex: report.patientSex === "CHILD" ? "Child" : report.patientSex,
      referredBy: report.referredBy,
      date: fmtDate(report.scanDate ?? report.finalizedAt ?? report.createdAt),
      serial: report.serialNo != null ? formatUsgSerial(report.serialNo) : undefined,
      provisional: false,
    },
    resolved,
    images: report.images.map((i) => ({ dataUrl: i.dataUrl, caption: i.caption })),
  });

  const filename =
    report.serialNo != null
      ? `${formatUsgSerial(report.serialNo)}-${report.patientName.replace(/[^a-z0-9]+/gi, "-").slice(0, 30)}.pdf`
      : `usg-report-${report.id.slice(0, 8)}.pdf`;

  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
