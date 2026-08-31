import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Follow-up drafts — one click duplicates any report as a fresh editable
 * DRAFT for a repeat scan: same patient, same study, same technique, the
 * full composer state (pathology selections + typed measurements) copied so
 * the doctor only updates what changed. The new draft gets NO register
 * number — its serial is stamped when it is finalized on its own merit, and
 * today's scan date so the follow-up is not accidentally back-dated to the
 * original visit.
 */
export async function POST(_req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;

  const source = await db.usgReport.findUnique({ where: { id } });
  if (!source) return Response.json({ error: "Not found" }, { status: 404 });

  const draft = await db.usgReport.create({
    data: {
      patientName: source.patientName,
      patientAge: source.patientAge,
      patientSex: source.patientSex,
      referredBy: source.referredBy,
      studyKey: source.studyKey,
      technique: source.technique,
      stateJson: source.stateJson,
      studyTitle: source.studyTitle,
      findings: source.findings,
      impression: source.impression,
      scanDate: new Date(), // follow-up scan happens today — back-date if needed
      status: "DRAFT", // editable; serial assigned at its own finalization
    },
  });
  return Response.json({ report: draft });
}
