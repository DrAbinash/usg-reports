import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { validateImageDataUrl } from "@/lib/usg/images";
import { audit } from "@/lib/usg/audit";

type Ctx = { params: Promise<{ id: string }> };

/** Attach a machine still (data URL) to a DRAFT report. Finalized reports
 *  are frozen — their printed snapshot already embeds the images. */
export async function POST(req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;

  const report = await db.usgReport.findUnique({ where: { id } });
  if (!report) return Response.json({ error: "Not found" }, { status: 404 });
  if (report.status === "FINALIZED") {
    return Response.json({ error: "Report is finalized and locked" }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl : "";
  const check = validateImageDataUrl(dataUrl);
  if (!check.ok) return Response.json({ error: check.error }, { status: 400 });

  const max = await db.usgReportImage.aggregate({
    where: { reportId: id },
    _max: { sortOrder: true },
  });

  const image = await db.usgReportImage.create({
    data: {
      reportId: id,
      dataUrl,
      caption: typeof body.caption === "string" ? body.caption.trim().slice(0, 120) : "",
      sortOrder: (max._max.sortOrder ?? 0) + 10,
    },
  });
  await audit({
    action: "image.attach",
    reportId: id,
    patientName: report.patientName,
    detail: `still attached (${Math.round((check.ok ? check.bytes : 0) / 1000)} KB)`,
  });
  return Response.json({ image });
}
