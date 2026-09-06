import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/usg/audit";
import { validateCommunicationInput, type CriticalCommunicationInput } from "@/lib/usg/criticalComm";

type Ctx = { params: Promise<{ id: string }> };

/** List all communication log entries for a report (oldest first). */
export async function GET(req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;
  const report = await db.usgReport.findUnique({ where: { id } });
  if (!report) return Response.json({ error: "Report not found" }, { status: 404 });
  const entries = await db.usgCriticalCommunication.findMany({
    where: { reportId: id },
    orderBy: { communicatedAt: "asc" },
  });
  return Response.json({ entries });
}

/** Add a communication log entry to a report. */
export async function POST(req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;
  const report = await db.usgReport.findUnique({ where: { id } });
  if (!report) return Response.json({ error: "Report not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Partial<CriticalCommunicationInput>;
  const errors = validateCommunicationInput({ ...body, reportId: id });
  if (errors.length) {
    return Response.json({ error: "Validation failed", errors }, { status: 400 });
  }

  const entry = await db.usgCriticalCommunication.create({
    data: {
      reportId: id,
      findingText: body.findingText!.trim(),
      communicatedTo: body.communicatedTo!.trim(),
      communicatedAt: new Date(body.communicatedAt!),
      method: body.method!,
      communicatedBy: (body.communicatedBy ?? "self").trim() || "self",
      notes: body.notes?.trim() || null,
    },
  });
  await audit({
    action: "critical.comm.log",
    reportId: id,
    patientName: report.patientName,
    detail: `Critical finding communicated to ${body.communicatedTo} via ${body.method} — logged`,
  });
  return Response.json({ entry });
}
