import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/usg/audit";

type Ctx = { params: Promise<{ id: string; entryId: string }> };

/** Mark a communication log entry as acknowledged (or clear the ack). */
export async function PATCH(req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id, entryId } = await ctx.params;

  const entry = await db.usgCriticalCommunication.findFirst({
    where: { id: entryId, reportId: id },
  });
  if (!entry) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const acknowledged = !!body.acknowledged;
  const ackAt = acknowledged
    ? body.acknowledgedAt
      ? new Date(body.acknowledgedAt)
      : new Date()
    : null;
  const ackBy = acknowledged
    ? typeof body.acknowledgedBy === "string" && body.acknowledgedBy.trim()
      ? body.acknowledgedBy.trim()
      : entry.communicatedTo // default to whoever was called
    : null;

  const updated = await db.usgCriticalCommunication.update({
    where: { id: entryId },
    data: {
      acknowledged,
      acknowledgedAt: ackAt,
      acknowledgedBy: ackBy,
    },
  });
  await audit({
    action: acknowledged ? "critical.comm.ack" : "critical.comm.unack",
    reportId: id,
    detail: acknowledged
      ? `Acknowledged receipt confirmed by ${ackBy ?? "unknown"}`
      : `Acknowledgement cleared`,
  });
  return Response.json({ entry: updated });
}

/** Delete a communication log entry (mistaken entry only — the audit row stays). */
export async function DELETE(_req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id, entryId } = await ctx.params;

  const entry = await db.usgCriticalCommunication.findFirst({
    where: { id: entryId, reportId: id },
  });
  if (!entry) return Response.json({ error: "Not found" }, { status: 404 });
  await db.usgCriticalCommunication.delete({ where: { id: entryId } });
  await audit({
    action: "critical.comm.delete",
    reportId: id,
    detail: "Communication log entry removed",
  });
  return Response.json({ ok: true });
}
