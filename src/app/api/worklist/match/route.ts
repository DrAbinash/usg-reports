import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

/** Manual match: attach an Orthanc study (accession or UID) to a CARE order. */
export async function POST(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const body = await req.json().catch(() => ({}));
  const orderId = String(body.orderId ?? "");
  const accession = String(body.accession ?? "").trim();
  const uid = String(body.uid ?? "").trim();

  const order = await db.careOrderLink.findUnique({ where: { id: orderId } });
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

  // Case A: order awaiting images ← user pastes the accession/UID found in Orthanc
  if (accession || uid) {
    let uidToSet = uid || null;
    let accessionToSet = accession || order.accessionNumber;
    // If the pasted value looks like a UID (dots, digits) map it through
    if (!uid && /^\d+(\.\d+)+$/.test(accession)) {
      uidToSet = accession;
      accessionToSet = order.accessionNumber;
    }
    await db.careOrderLink.update({
      where: { id: orderId },
      data: {
        accessionNumber: accessionToSet === order.accessionNumber ? order.accessionNumber : accessionToSet,
        studyInstanceUid: uidToSet ?? order.studyInstanceUid,
        status: order.status === "REPORTED" ? "REPORTED" : "TO_REPORT",
      },
    });
    return Response.json({ ok: true });
  }

  // Case B: unlinked Orthanc order ← user picks an awaiting-images CARE order to merge into
  const target = String(body.mergeIntoOrderId ?? "");
  if (target) {
    const careOrder = await db.careOrderLink.findUnique({ where: { id: target } });
    if (!careOrder) return Response.json({ error: "Target order not found" }, { status: 404 });
    await db.careOrderLink.update({
      where: { id: target },
      data: {
        studyInstanceUid: order.studyInstanceUid,
        status: "TO_REPORT",
      },
    });
    await db.careOrderLink.delete({ where: { id: order.id } });
    return Response.json({ ok: true, mergedInto: target });
  }

  return Response.json({ error: "Provide accession/uid or mergeIntoOrderId" }, { status: 400 });
}
