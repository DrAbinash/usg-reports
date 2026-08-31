import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStudy } from "@/lib/usg/studies";
import { normaliseState } from "@/lib/usg/composer";
import { resolveColumns } from "@/lib/usg/server";
import { linkPatient } from "@/lib/usg/patients";
import { audit } from "@/lib/usg/audit";
import { guessStudyKey, isObStudyKey, orderSex, testSuggestsChild } from "@/lib/usg/orderStudy";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Start a report from a bill-desk order — the typist-less entry point.
 * Creates the DRAFT with every demographic the bill desk already knows
 * (name, age, sex, referral doctor, scan date) plus the guessed study, so
 * the doctor's first keystroke is a pathology chip, not a patient header.
 * Idempotent: a second call opens the SAME draft, never a duplicate.
 */
export async function POST(_req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;

  const order = await db.usgCareOrder.findUnique({ where: { id } });
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
  if (order.ignored) return Response.json({ error: "This order is ignored" }, { status: 400 });

  // Already started? Open the same draft.
  if (order.reportId) {
    const existing = await db.usgReport.findUnique({ where: { id: order.reportId } });
    if (existing) return Response.json({ report: existing, ob: isObStudyKey(existing.studyKey) });
  }

  const child = testSuggestsChild(order.testName);
  const studyKey = guessStudyKey(order.testName, order.patientSex === "M" ? "M" : "F", child);
  const study = getStudy(studyKey);
  if (!study) return Response.json({ error: "Unknown study" }, { status: 400 });

  const state = normaliseState({}, studyKey);
  const cols = await resolveColumns(JSON.stringify(state), study.technique);

  const patientId = await linkPatient(order.patientName, order.patientPhone);
  const report = await db.usgReport.create({
    data: {
      patientName: order.patientName,
      patientAge: order.patientAge,
      patientSex: orderSex(order.patientSex, child) === "M" ? "M" : orderSex(order.patientSex, child) === "CHILD" ? "CHILD" : "F",
      referredBy: order.referringDoctor,
      patientId,
      technique: study.technique,
      stateJson: JSON.stringify(state),
      scanDate: order.studyDate,
      ...cols,
    },
  });

  await db.usgCareOrder.update({
    where: { id: order.id },
    data: { reportId: report.id, status: "REPORTING" },
  });
  await audit({
    action: "report.create",
    reportId: report.id,
    patientName: report.patientName,
    detail: `started from bill-desk order ${order.accessionNumber} — ${study.label}`,
  });

  return Response.json({ report, ob: isObStudyKey(studyKey) });
}
