import { requireSession, getActiveClinicId } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import type { Prisma } from "@prisma/client";

export type WorklistOrderDto = {
  id: string;
  /** null = the ERP never supplied one — the row identifies by
   *  careWorklistId (CARE order identity) and studyInstanceUid (imaging). */
  accessionNumber: string | null;
  careWorklistId: string | null;
  patientName: string;
  patientAge: string;
  patientSex: string;
  patientPhone: string;
  patientAddress: string;
  billNumber: string;
  referringDoctor: string;
  testName: string;
  modality: string;
  studyInstanceUid: string | null;
  billingStatus: string | null;
  status: string;
  ignored: boolean;
  studyDate: string | null;
  reportId: string | null;
  formFId: string | null;
  careSyncedAt: string | null;
};

/** Parse a yyyy-mm-dd string to a Date at midnight local time. */
function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

/** End of day (23:59:59) for the "to" date filter. */
function endOfDay(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s + "T23:59:59");
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const clinicId = await getActiveClinicId();
  const url = new URL(req.url);

  // v6.14: date range filter — ?from=YYYY-MM-DD&to=YYYY-MM-DD
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");

  const where: Prisma.UsgCareOrderWhereInput = { clinicId };

  if (fromParam || toParam) {
    const studyDateFilter: Prisma.DateTimeFilter = {};
    if (fromParam) {
      const from = parseDate(fromParam);
      if (from) studyDateFilter.gte = from;
    }
    if (toParam) {
      const to = endOfDay(toParam);
      if (to) studyDateFilter.lte = to;
    }
    where.studyDate = studyDateFilter;
  }

  const orders = await db.usgCareOrder.findMany({
    where,
    orderBy: { studyDate: "desc" },
    take: 500,
  });

  const items: WorklistOrderDto[] = orders.map((o) => ({
    id: o.id,
    accessionNumber: o.accessionNumber ?? null,
    careWorklistId: o.careWorklistId,
    patientName: o.patientName,
    patientAge: o.patientAge,
    patientSex: o.patientSex,
    patientPhone: o.patientPhone,
    patientAddress: o.patientAddress,
    billNumber: o.billNumber,
    referringDoctor: o.referringDoctor,
    testName: o.testName,
    modality: o.modality,
    studyInstanceUid: o.studyInstanceUid,
    billingStatus: o.billingStatus,
    status: o.status,
    ignored: o.ignored,
    studyDate: o.studyDate ? o.studyDate.toISOString() : null,
    reportId: o.reportId,
    formFId: o.formFId,
    careSyncedAt: o.careSyncedAt ? o.careSyncedAt.toISOString() : null,
  }));

  const sync = await db.usgSyncState.findUnique({ where: { clinicId } });
  const s = await getSettings();

  return Response.json({
    orders: items,
    syncedAt: sync?.lastSyncAt?.toISOString() ?? null,
    careOk: sync?.lastCareOk ?? false,
    orthancOk: sync?.lastOrthancOk ?? false,
    lastError: sync?.lastError ?? null,
    careConfigured: !!s.careApiBase, // v6.14: only base URL required,
    orthancConfigured: !!s.orthancUrl,
    // v6.14: echo the applied date range so the UI can show it
    dateRange: { from: fromParam, to: toParam },
  });
}
