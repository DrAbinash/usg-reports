import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";

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

export async function GET() {
  const guard = await requireSession();
  if (guard) return guard;

  const orders = await db.usgCareOrder.findMany({
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

  const sync = await db.usgSyncState.findUnique({ where: { id: "singleton" } });
  const s = await getSettings();

  return Response.json({
    orders: items,
    syncedAt: sync?.lastSyncAt?.toISOString() ?? null,
    careOk: sync?.lastCareOk ?? false,
    orthancOk: sync?.lastOrthancOk ?? false,
    lastError: sync?.lastError ?? null,
    careConfigured: !!(s.careApiBase && s.careApiKey),
    orthancConfigured: !!s.orthancUrl,
  });
}
