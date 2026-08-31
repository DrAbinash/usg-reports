import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { normaliseState, makeLookup, resolve } from "@/lib/usg/composer";
import { loadAllPathologies, loadNormalOverrides } from "@/lib/usg/server";
import { buildUsgReportHtml, formatUsgSerial } from "@/lib/usg/print";
import { audit } from "@/lib/usg/audit";
import { payloadInputFor, qrDataUrlFor } from "@/lib/usg/qrServer";

type Ctx = { params: Promise<{ id: string }> };

function fmtDate(d: Date | null | undefined): string {
  if (!d) return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export async function POST(req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;

  const report = await db.usgReport.findUnique({ where: { id } });
  if (!report) return Response.json({ error: "Not found" }, { status: 404 });

  // Register discipline: the sequential number is stamped at FIRST
  // finalization and never changes afterwards — re-finalize rebuilds the
  // snapshot but keeps the same register number (no renumbering, ever, even
  // if an earlier report is deleted — the max+1 rule leaves gaps, never
  // reuses a printed number).
  let serialNo = report.serialNo;
  if (serialNo == null) {
    serialNo = await db.$transaction(async (tx) => {
      const fresh = await tx.usgReport.findUnique({ where: { id }, select: { serialNo: true } });
      if (fresh?.serialNo != null) return fresh.serialNo; // raced finalize already stamped it
      const max = await tx.usgReport.aggregate({ _max: { serialNo: true } });
      return (max._max.serialNo ?? 0) + 1;
    });
  }

  // Re-finalize allowed: rebuilds the snapshot from the CURRENT state + settings.
  const settings = await getSettings();
  const all = await loadAllPathologies();
  const lookup = makeLookup(all);
  const overrides = await loadNormalOverrides();
  const state = normaliseState(safeParse(report.stateJson), report.studyKey, overrides);
  const resolved = resolve(state, lookup, report.technique, overrides);

  // Machine stills embed into the frozen snapshot at finalization.
  const images = await db.usgReportImage.findMany({
    where: { reportId: id },
    orderBy: { sortOrder: "asc" },
  });

  // Verification QR — signed against the install secret, URL form when the
  // request origin is known so scanning opens the verify page directly.
  const origin =
    req.headers.get("x-forwarded-proto") ?? "http", reqHost = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const qr = await qrDataUrlFor(
    payloadInputFor({ ...report, serialNo }),
    reqHost ? `${origin}://${reqHost}` : null,
  );

  const html = buildUsgReportHtml(
    {
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
    {
      name: report.patientName,
      age: report.patientAge,
      sex: report.patientSex,
      referredBy: report.referredBy,
      // The printed date is the day the scan was DONE (back-datable), falling
      // back to the finalization/creation day for older rows.
      date: fmtDate(report.scanDate ?? report.finalizedAt ?? report.createdAt),
      serial: formatUsgSerial(serialNo),
    },
    resolved,
    images.map((i) => ({ dataUrl: i.dataUrl, caption: i.caption })),
    qr ? { dataUrl: qr } : null,
  );

  const updated = await db.usgReport.update({
    where: { id },
    data: {
      status: "FINALIZED",
      reportHtml: html,
      finalizedAt: new Date(),
      serialNo,
      studyTitle: resolved.title,
      findings: resolved.sections.map((s) => `${s.label}: ${s.text}`).join("\n\n"),
      impression: resolved.impression.join("\n"),
    },
  });
  await audit({
    action: "report.finalize",
    reportId: updated.id,
    serialNo,
    patientName: updated.patientName,
    detail: `register no. ${formatUsgSerial(serialNo)} frozen — reprint only`,
  });
  return Response.json({ report: updated, html, serialNo });
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
