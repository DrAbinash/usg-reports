import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/usg/audit";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Follow-up reminder setter (v6.9) — PATCH /api/usg/reports/:id/follow-up.
 *
 * Body:
 *   { followUpDate: "2026-12-15" | null, followUpNote: "..." | "" }
 *
 * Works on FINALIZED reports too — the radiologist typically decides on the
 * follow-up after the report is signed. Setting followUpDate=null clears
 * the reminder. followUpNote is optional.
 */
export async function PATCH(req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;
  const report = await db.usgReport.findUnique({ where: { id } });
  if (!report) return Response.json({ error: "Report not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: { followUpDate: Date | null; followUpNote: string | null } = {
    followUpDate: null,
    followUpNote: null,
  };

  // followUpDate: "yyyy-mm-dd" → midnight local Date; null → clear.
  if (body.followUpDate === null || body.followUpDate === "") {
    data.followUpDate = null;
  } else if (typeof body.followUpDate === "string") {
    const iso = body.followUpDate.slice(0, 10);
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) {
      return Response.json({ error: "followUpDate must be a valid yyyy-mm-dd" }, { status: 400 });
    }
    data.followUpDate = d;
  }

  if (typeof body.followUpNote === "string") {
    data.followUpNote = body.followUpNote.trim().slice(0, 200) || null;
  } else {
    // Preserve existing note if not provided.
    data.followUpNote = report.followUpNote;
  }

  const updated = await db.usgReport.update({
    where: { id },
    data,
    select: { id: true, followUpDate: true, followUpNote: true },
  });

  await audit({
    action: "report.followup",
    reportId: id,
    patientName: report.patientName,
    detail: data.followUpDate
      ? `Follow-up set for ${data.followUpDate.toISOString().slice(0, 10)}${data.followUpNote ? ` — ${data.followUpNote}` : ""}`
      : "Follow-up cleared",
  });

  return Response.json({ followUp: updated });
}
