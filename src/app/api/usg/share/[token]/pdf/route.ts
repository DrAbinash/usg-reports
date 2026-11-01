import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { makeLookup, normaliseState, resolve } from "@/lib/usg/composer";
import { loadAllPathologies, loadNormalOverrides } from "@/lib/usg/server";
import { buildUsgReportPdf } from "@/lib/usg/pdf";
import { renderHtmlToPdf, browserPdfAvailable } from "@/lib/usg/pdfRenderHtml";
import { formatUsgSerial, frozenPrintSettingsOf, toUsgPrintSettings } from "@/lib/usg/print";
import { isShareRevoked, verifyShareToken } from "@/lib/usg/secureShare";
import { payloadInputFor, qrPngFor } from "@/lib/usg/qrServer";
import { audit } from "@/lib/usg/audit";

type Ctx = { params: Promise<{ token: string }> };

function fmtDate(d: Date | null | undefined): string {
  const date = d ?? new Date();
  return new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Request origin (for the QR target) — proxied LAN installs included. */
function originOf(req: Request): string | null {
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  return host ? `${proto}://${host}` : null;
}

/**
 * GET /api/usg/share/[token]/pdf — public PDF download for a valid share token.
 * Session not required; token is the auth.
 */
export async function GET(req: Request, ctx: Ctx) {
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
  if (isShareRevoked(verified, report.shareRevokedAt)) {
    return Response.json({ error: "This link has been withdrawn by the clinic" }, { status: 410 });
  }

  // The register number is what the referring doctor reads back to us, so it is
  // the filename. The patient's name is not: this endpoint is reachable without
  // a session, and a download a patient saves on a shared phone carries its
  // filename into that phone's file list, its recents, and any sync folder it
  // happens to have. The on-screen share page already says the name — the file
  // does not need to repeat it where the screen will not.
  const filename =
    report.serialNo != null
      ? `${formatUsgSerial(report.serialNo)}-copy.pdf`
      : `usg-report-${report.id.slice(0, 8)}.pdf`;

  const asPdf = (body: Uint8Array): Response =>
    new Response(body as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        // Patient data, minted per request: a shared device's cache would
        // otherwise keep the report after the link itself is withdrawn.
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });

  await audit({
    action: "report.sharePdf",
    reportId: report.id,
    serialNo: report.serialNo ?? undefined,
    patientName: report.patientName,
    detail: "shared PDF downloaded",
  });

  // The sheet that was signed, not a re-render of it. This is the same document
  // the patient is looking at one screen earlier (`/share/[token]` serves
  // `reportHtml` too), and the same engine the clinic prints with — so the PDF
  // and the page cannot disagree, and a Settings change after the signature
  // cannot restyle a report already filed. The frozen page carries the
  // verification QR that was stamped at finalize, so nothing is added here.
  const frozenHtml = report.reportHtml?.trim() ?? "";
  if (frozenHtml && browserPdfAvailable()) {
    try {
      return asPdf(await renderHtmlToPdf(frozenHtml));
    } catch {
      // the vector generator below is the fallback, not an error
    }
  }

  const settings = await getSettings();
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

  const input = payloadInputFor(report);
  const qrPng = await qrPngFor(input, originOf(req));
  const frozen = frozenPrintSettingsOf(report.printSettingsJson);

  const bytes = await buildUsgReportPdf({
    settings:
      frozen ??
      toUsgPrintSettings({
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
    qrPng,
  });

  return asPdf(bytes);
}
