import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Follow-up reminders (v6.9).
 *
 * GET /api/usg/follow-ups
 *   ?status=due        — finalized reports whose followUpDate is on/before
 *                        today and not yet cleared (the "call them back" list)
 *   ?status=upcoming   — finalized reports whose followUpDate is in the
 *                        next 14 days (the "schedule them" list)
 *   ?status=all        — every finalized report with a followUpDate set
 *
 * Sorted by followUpDate ascending. Returns the minimal projection the
 * studio home / Insights widget needs — no patient contact info leaked
 * beyond what's already in /api/usg/reports.
 */
export async function GET(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status") ?? "due";
  const daysWindow = 14;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // midnight local
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + daysWindow);

  const where: {
    status: string;
    followUpDate?: { not: null };
    AND?: Array<{ followUpDate?: { lte?: Date; gt?: Date; gte?: Date } }>;
  } = { status: "FINALIZED", followUpDate: { not: null } };

  if (statusParam === "due") {
    where.AND = [{ followUpDate: { lte: today } }];
  } else if (statusParam === "upcoming") {
    where.AND = [{ followUpDate: { gt: today } }, { followUpDate: { lte: horizon } }];
  }

  const reports = await db.usgReport.findMany({
    where,
    orderBy: { followUpDate: "asc" },
    take: 200,
    select: {
      id: true,
      patientName: true,
      studyKey: true,
      studyTitle: true,
      scanDate: true,
      followUpDate: true,
      followUpNote: true,
      serialNo: true,
      referredBy: true,
    },
  });

  return Response.json({
    status: statusParam,
    horizonDays: daysWindow,
    asOf: now.toISOString(),
    reports,
  });
}
