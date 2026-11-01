import { requireSession, getActiveClinicId } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/usg/audit";
import { ORTHANC_SWEEP_DAYS, samePatientName } from "@/lib/usg/careSync";
import { listRecentUltrasoundStudies, lookupStudyByUid } from "@/lib/usg/orthancClient";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Link, change or clear the study whose images a report shows.
 *
 * The sync joins a scan to a bill row by identifiers first and, at this clinic,
 * usually by the patient's name — a guess it records in `uidLinkedBy` and marks
 * with a chip. A chip that cannot be acted on is a confession, not a control:
 * these two handlers are the acting.
 *
 * What is refused: a study whose DICOM header names a different patient. The
 * name on the header and the name on the bill must agree token for token, in
 * either order, because "First Last" and "LAST^FIRST" are one person and "Rani
 * Devi" versus "Rani Kumari" are not.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;
  const clinicId = await getActiveClinicId();

  const order = await db.usgCareOrder.findFirst({
    where: { id, clinicId },
    select: { id: true, patientName: true, studyInstanceUid: true, uidLinkedBy: true, studyDate: true },
  });
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

  const us = await listRecentUltrasoundStudies(ORTHANC_SWEEP_DAYS, 500);
  if (!us.ok) {
    return Response.json({ ok: false, error: us.error, candidates: [], current: order.studyInstanceUid });
  }
  const candidates = us.data
    .filter((st) => samePatientName(st.patientName, order.patientName))
    .map((st) => ({
      studyInstanceUid: st.studyInstanceUid,
      studyDate: st.studyDate,
      studyTime: st.studyTime,
      testName: st.testName,
      referringDoctor: st.referringDoctor,
    }));
  return Response.json({ ok: true, candidates, current: order.studyInstanceUid, orthancOk: true });
}

export async function POST(req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;
  const clinicId = await getActiveClinicId();

  const body = (await req.json().catch(() => ({}))) as { studyInstanceUid?: string | null };
  const order = await db.usgCareOrder.findFirst({
    where: { id, clinicId },
    select: { id: true, patientName: true, studyInstanceUid: true, uidLinkedBy: true, careWorklistId: true },
  });
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

  // Clear it. Whatever the sync believes, this row now says the doctor took the
  // images away, and the demographic pass leaves it alone until he asks again.
  if (body.studyInstanceUid === null) {
    const updated = await db.usgCareOrder.update({
      where: { id: order.id },
      data: { studyInstanceUid: null, uidLinkedBy: "unlinked by doctor" },
    });
    await audit({
      action: "worklist.link",
      patientName: order.patientName,
      detail: `images unlinked from WL ${order.careWorklistId ?? order.id.slice(-8)}`,
    });
    return Response.json({ ok: true, order: updated });
  }

  const uid = (body.studyInstanceUid ?? "").trim();
  if (!/^[0-9.]{5,}$/.test(uid)) {
    return Response.json({ error: "Pick one of the studies listed, or clear the link." }, { status: 400 });
  }

  const look = await lookupStudyByUid(uid);
  if (!look.found) {
    return Response.json(
      { error: look.orthancOk ? "That study is not in the PACS." : `The PACS could not be asked: ${look.error}` },
      { status: 502 },
    );
  }

  if (!samePatientName(look.tags.PatientName, order.patientName)) {
    // The one thing a hand-pick must never be allowed to do.
    return Response.json(
      { error: "That study belongs to a different patient name — the link was refused." },
      { status: 409 },
    );
  }

  const updated = await db.usgCareOrder.update({
    where: { id: order.id },
    data: { studyInstanceUid: uid, uidLinkedBy: "chosen by doctor" },
  });
  await audit({
    action: "worklist.link",
    patientName: order.patientName,
    detail: `images linked by hand to study ..${uid.slice(-8)}`,
  });
  return Response.json({ ok: true, order: updated });
}
