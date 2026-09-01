import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/usg/audit";

/**
 * Form F records — list + save. The row keeps the patient-specific fields;
 * fixed clinic details are resolved from settings at print time so a change
 * of registration number never re-prints old forms differently on new ones.
 */
export async function GET(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const url = new URL(req.url);
  const accession = url.searchParams.get("accession") ?? "";
  const id = url.searchParams.get("id") ?? "";
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();

  const where: Record<string, unknown> = {};
  if (id) where.id = id;
  else if (accession) where.accessionNumber = accession;

  const rows = await db.usgFormF.findMany({ where, orderBy: { createdAt: "desc" }, take: 500 });
  const items = q
    ? rows.filter((r) => r.patientName.toLowerCase().includes(q) || r.accessionNumber.toLowerCase().includes(q))
    : rows;
  return Response.json({ forms: items });
}

type FormFPayload = {
  id?: string;
  accessionNumber?: string;
  /** UsgCareOrder id — the reliable order link when the accession is
   *  blank (v6.1: orders identify by worklistId, not accession). */
  careOrderId?: string | null;
  billNumber?: string;
  reportId?: string | null;
  patientName?: string;
  patientAge?: string;
  husbandFatherName?: string;
  address?: string;
  mobile?: string;
  childrenDetails?: string;
  referredBy?: string;
  lmpWeeks?: string;
  previousChildIssue?: string;
  indicationOther?: string;
  gestationalAgeWeeks?: string;
  gestationalAgeDays?: string;
  ultrasoundResult?: string;
  abnormality?: string;
  procedureDate?: string;
  consentDate?: string;
  idCardVerified?: boolean;
};

const str = (v: unknown, max = 300): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const body = (await req.json().catch(() => ({}))) as FormFPayload;

  const patientName = str(body.patientName);
  if (!patientName) return Response.json({ error: "Patient name is required" }, { status: 400 });

  const data = {
    accessionNumber: str(body.accessionNumber, 80),
    billNumber: str(body.billNumber, 80),
    patientName,
    patientAge: str(body.patientAge, 40),
    husbandFatherName: str(body.husbandFatherName),
    address: str(body.address, 400),
    mobile: str(body.mobile, 20),
    childrenDetails: str(body.childrenDetails, 80),
    referredBy: str(body.referredBy, 120) || "Self",
    lmpWeeks: str(body.lmpWeeks, 60),
    previousChildIssue: str(body.previousChildIssue, 200),
    indicationOther: str(body.indicationOther, 200),
    gestationalAgeWeeks: str(body.gestationalAgeWeeks, 10),
    gestationalAgeDays: str(body.gestationalAgeDays, 10),
    ultrasoundResult: str(body.ultrasoundResult, 400),
    abnormality: str(body.abnormality, 400),
    procedureDate: str(body.procedureDate, 20),
    consentDate: str(body.consentDate, 20),
    idCardVerified: body.idCardVerified === true,
    reportId: typeof body.reportId === "string" && body.reportId ? body.reportId : null,
  };

  let form;
  if (body.id) {
    form = await db.usgFormF.update({ where: { id: body.id }, data }).catch(() => null);
    if (!form) return Response.json({ error: "Form F not found" }, { status: 404 });
  } else {
    form = await db.usgFormF.create({ data });
  }

  // Link the order (if any) so the worklist shows its Form F badge.
  // v6.1: prefer the direct order id (blank-accession orders have no
  // accession to look up); the accession lookup remains for legacy rows.
  const careOrderId = str(body.careOrderId, 40);
  let order: { id: string; formFId: string | null } | null = null;
  if (careOrderId) {
    order = await db.usgCareOrder.findUnique({ where: { id: careOrderId }, select: { id: true, formFId: true } });
  }
  if (!order && form.accessionNumber) {
    order = await db.usgCareOrder.findUnique({
      where: { accessionNumber: form.accessionNumber },
      select: { id: true, formFId: true },
    });
  }
  if (order && order.formFId !== form.id) {
    await db.usgCareOrder.update({ where: { id: order.id }, data: { formFId: form.id } });
  }

  await audit({
    action: "formf.save",
    reportId: form.reportId ?? undefined,
    patientName: form.patientName,
    detail: `PC-PNDT Form F ${body.id ? "updated" : "recorded"}${form.accessionNumber ? ` (${form.accessionNumber})` : ""}`,
  });
  return Response.json({ form });
}
