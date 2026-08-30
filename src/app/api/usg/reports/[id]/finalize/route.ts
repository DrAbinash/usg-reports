import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { normaliseState, makeLookup, resolve } from "@/lib/usg/composer";
import { loadAllPathologies } from "@/lib/usg/server";
import { buildUsgReportHtml } from "@/lib/usg/print";

type Ctx = { params: Promise<{ id: string }> };

function fmtDate(d: Date | null | undefined): string {
  if (!d) return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export async function POST(_req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;

  const report = await db.usgReport.findUnique({ where: { id } });
  if (!report) return Response.json({ error: "Not found" }, { status: 404 });

  // Re-finalize allowed: rebuilds the snapshot from the CURRENT state + settings.
  const settings = await getSettings();
  const all = await loadAllPathologies();
  const lookup = makeLookup(all);
  const state = normaliseState(safeParse(report.stateJson), report.studyKey);
  const resolved = resolve(state, lookup, report.technique);

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
    },
    {
      name: report.patientName,
      age: report.patientAge,
      sex: report.patientSex,
      referredBy: report.referredBy,
      date: fmtDate(report.finalizedAt ?? report.createdAt),
    },
    resolved,
  );

  const updated = await db.usgReport.update({
    where: { id },
    data: {
      status: "FINALIZED",
      reportHtml: html,
      finalizedAt: new Date(),
      studyTitle: resolved.title,
      findings: resolved.sections.map((s) => `${s.label}: ${s.text}`).join("\n\n"),
      impression: resolved.impression.join("\n"),
    },
  });
  return Response.json({ report: updated, html });
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
