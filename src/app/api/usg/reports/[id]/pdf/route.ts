import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { makeLookup, normaliseState, resolve } from "@/lib/usg/composer";
import { loadAllPathologies, loadNormalOverrides } from "@/lib/usg/server";
import { buildUsgReportPdf } from "@/lib/usg/pdf";
import { formatUsgSerial } from "@/lib/usg/print";
import { payloadInputFor, qrPngFor } from "@/lib/usg/qrServer";

type Ctx = { params: Promise<{ id: string }> };

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
 * The report as a real PDF (v5): vector text, embedded logo / signature /
 * stills, verification QR. Finalized reports rebuild from their frozen
 * data; drafts render watermarked PROVISIONAL — same discipline as print.
 */
export async function GET(req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;

  const report = await db.usgReport.findUnique({
    where: { id },
    include: { images: { orderBy: { sortOrder: "asc" } } },
  });
  if (!report) return Response.json({ error: "Not found" }, { status: 404 });

  const settings = await getSettings();
  const all = await loadAllPathologies();
  const lookup = makeLookup(all);
  const overrides = await loadNormalOverrides();
  const state = normaliseState(safeParse(report.stateJson), report.studyKey, overrides);
  const resolved = resolve(state, lookup, report.technique, overrides);

  const input = payloadInputFor(report);
  const qrPng = await qrPngFor(input, originOf(req));

  const bytes = await buildUsgReportPdf({
    settings: {
      appTitle: settings.appTitle,
      hospitalName: settings.hospitalName,
      addressLine: settings.addressLine,
      phone: settings.phone,
      email: settings.email,
      logoUrl: settings.logoUrl,
      footerMessage: settings.footerMessage,
      usgDoctorName: settings.usgDoctorName,
      usgDoctorQual: settings.usgDoctorQual,
      usgDoctorRegNo: settings.usgDoctorRegNo,
      usgMachineLine: settings.usgMachineLine,
      usgShowMachine: settings.usgShowMachine,
      usgFooterLine: settings.usgFooterLine,
      usgDeclarationLine: settings.usgDeclarationLine,
      usgPrintStyle: settings.usgPrintStyle,
      usgPrintCompact: settings.usgPrintCompact,
      usgPrintPaper: settings.usgPrintPaper,
      usgSignatureUrl: settings.usgSignatureUrl,
    },
    patient: {
      name: report.patientName,
      age: report.patientAge,
      sex: report.patientSex === "CHILD" ? "Child" : report.patientSex,
      referredBy: report.referredBy,
      date: fmtDate(report.scanDate ?? report.finalizedAt ?? report.createdAt),
      serial: report.serialNo != null ? formatUsgSerial(report.serialNo) : undefined,
      provisional: report.status !== "FINALIZED",
    },
    resolved,
    images: report.images.map((i) => ({ dataUrl: i.dataUrl, caption: i.caption })),
    qrPng,
  });

  const filename =
    report.serialNo != null
      ? `${formatUsgSerial(report.serialNo)}-${report.patientName.replace(/[^a-z0-9]+/gi, "-").slice(0, 30)}.pdf`
      : `usg-draft-${report.id.slice(0, 8)}.pdf`;

  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
