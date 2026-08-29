import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSeed } from "@/lib/seed";

export type WorklistOrder = {
  id: string;
  accessionNumber: string;
  patientName: string;
  patientAge: string | null;
  patientGender: string | null;
  patientMrn: string | null;
  referringDoctor: string | null;
  testName: string | null;
  modality: string;
  bodyRegion: string;
  studyInstanceUid: string | null;
  billingStatus: string | null;
  status: string;
  ignored: boolean;
  studyDate: string | null;
  reportStatus: string | null;
  hasReport: boolean;
};

export async function GET() {
  const guard = await requireSession();
  if (guard) return guard;
  await ensureSeed();

  const orders = await db.careOrderLink.findMany({
    include: { report: { select: { status: true } } },
    orderBy: { studyDate: "desc" },
  });

  const items: WorklistOrder[] = orders.map((o) => ({
    id: o.id,
    accessionNumber: o.accessionNumber,
    patientName: o.patientName,
    patientAge: o.patientAge,
    patientGender: o.patientGender,
    patientMrn: o.patientMrn,
    referringDoctor: o.referringDoctor,
    testName: o.testName,
    modality: o.modality,
    bodyRegion: o.bodyRegion,
    studyInstanceUid: o.studyInstanceUid,
    billingStatus: o.billingStatus,
    status: o.status,
    ignored: o.ignored,
    studyDate: o.studyDate ? o.studyDate.toISOString() : null,
    reportStatus: o.report?.status ?? null,
    hasReport: !!o.report,
  }));

  const sync = await db.syncState.findUnique({ where: { id: "singleton" } });

  return Response.json({
    orders: items,
    syncedAt: sync?.lastSyncAt?.toISOString() ?? null,
    careOk: sync?.lastCareOk ?? false,
    orthancOk: sync?.lastOrthancOk ?? false,
    lastError: sync?.lastError ?? null,
  });
}
