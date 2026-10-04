import { requireSession, getActiveClinicId } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { clinicTodayIST } from "@/lib/usg/dates";
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
  testCode: string;
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
  // ?q= searches the order table itself. Until now search was a client-side
  // filter over whatever page the browser already held, so a patient outside
  // the 500 rows or the visible date range simply did not exist — and phone,
  // bill number and Study UID were never looked at at all.
  const q = (url.searchParams.get("q") ?? "").trim();
  const searching = q.length >= 2;
  // An active search drops the date filter: typing a name to find the man who
  // scanned yesterday must not be answered with an empty list because the
  // worklist defaults to "Today".
  const dateFiltered = !searching && !!(fromParam || toParam);

  const where: Prisma.UsgCareOrderWhereInput = { clinicId };

  if (searching) {
    where.OR = [
      { patientName: { contains: q } },
      { patientPhone: { contains: q } },
      { billNumber: { contains: q } },
      { accessionNumber: { contains: q } },
      { careWorklistId: { contains: q } },
      { studyInstanceUid: { contains: q } },
      { testName: { contains: q } },
      { testCode: { contains: q } },
      { referringDoctor: { contains: q } },
    ];
  }

  if (dateFiltered) {
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
    // A search is bounded by relevance, not by the browse page size.
    take: searching ? 200 : 500,
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
    testCode: o.testCode ?? "",
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

  // When a date filter hides open work, tell the UI so "Today" with a wrong
  // workstation clock (or studies dated yesterday) is not a silent empty list.
  let pendingOpenTotal = 0;
  let pendingOutsideFilter = 0;
  if (dateFiltered) {
    pendingOpenTotal = await db.usgCareOrder.count({
      where: {
        clinicId,
        ignored: false,
        status: { in: ["PENDING", "REPORTING"] },
      },
    });
    const pendingInFilter = items.filter(
      (o) => !o.ignored && (o.status === "PENDING" || o.status === "REPORTING"),
    ).length;
    pendingOutsideFilter = Math.max(0, pendingOpenTotal - pendingInFilter);
  }

  const sync = await db.usgSyncState.findUnique({ where: { clinicId } });
  const s = await getSettings();
  const clinicToday = clinicTodayIST();

  return Response.json({
    orders: items,
    syncedAt: sync?.lastSyncAt?.toISOString() ?? null,
    careOk: sync?.lastCareOk ?? false,
    orthancOk: sync?.lastOrthancOk ?? false,
    lastError: sync?.lastError ?? null,
    careConfigured: !!s.careApiBase, // v6.14: only base URL required,
    orthancConfigured: !!s.orthancUrl,
    usgFormFEnabled: !!s.usgFormFEnabled,
    // v6.14: echo the applied date range so the UI can show it
    dateRange: { from: fromParam, to: toParam },
    /** Set when ?q= was honoured server-side — the UI stops filtering locally
     *  and can say the search covered every date, not just the visible range. */
    search: searching ? { q, acrossAllDates: true } : null,
    /** Server/clinic calendar day in Asia/Kolkata — use for Today/Yesterday presets. */
    clinicToday,
    pendingOpenTotal,
    pendingOutsideFilter,
  });
}
