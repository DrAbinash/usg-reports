import { Prisma } from "@prisma/client";
import { requireSession, getActiveClinicId } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStudy } from "@/lib/usg/studies";
import { normaliseState } from "@/lib/usg/composer";
import { resolveColumns } from "@/lib/usg/server";
import { parseScanDate } from "@/lib/usg/dates";
import { linkPatient } from "@/lib/usg/patients";
import { audit } from "@/lib/usg/audit";

// SQLite LIKE is case-insensitive for ASCII by default — exactly what we
// want for Latin patient/study names. Escape LIKE wildcards in the user's
// search token so a literal "%" or "_" doesn't match every row.
function escapeLike(token: string): string {
  return token.replace(/[%_\\]/g, (c) => `\\${c}`);
}

/**
 * The columns the register list and the search read — deliberately not `*`.
 *
 * `reportHtml` is the printed page with the machine stills embedded in it, and
 * `printSettingsJson` is the layout it was printed with. Both belong to one
 * signed document, not to a row in a list, and `SELECT *` used to ship them for
 * up to 500 reports: opening the register, or typing a single letter into the
 * search box, transferred a large part of the archive to redraw a table of
 * names. The detail route (`/reports/[id]`) still returns the snapshot, because
 * that is the screen that prints from it.
 *
 * `stateJson` stays: the composer's prior-study comparison parses the previous
 * report's findings out of this same endpoint, and a test pins that.
 *
 * `tests/reportListPayload.test.ts` compares this list against the model in
 * prisma/schema.prisma, so a column added to the schema is missing from the
 * register only until that test says so.
 */
const LIST_COLUMNS = [
  "id",
  "clinicId",
  "patientName",
  "patientAge",
  "patientSex",
  "referredBy",
  "patientId",
  "studyKey",
  "technique",
  "stateJson",
  "studyTitle",
  "findings",
  "impression",
  "status",
  "finalizedAt",
  "lastSignedAt",
  "shareRevokedAt",
  "followUpDate",
  "followUpNote",
  "serialNo",
  "scanDate",
  "createdAt",
  "updatedAt",
];

/** The two frozen-document columns no list row ever carries. */
const LIST_OMIT = {
  reportHtml: true,
  printSettingsJson: true,
  // The signed mirror: the text as it was at signature, kept so an amendment can
  // still show what was signed. Same reasoning as reportHtml — it belongs to one
  // document, not to a row in a list, and it is findings/impression-sized text.
  signedFindings: true,
  signedImpression: true,
  signedStateJson: true,
} as const;

export async function GET(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const clinicId = await getActiveClinicId();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status") ?? "";
  const statusFilter = status === "DRAFT" || status === "FINALIZED" ? status : null;
  const patientPhone = (url.searchParams.get("patientPhone") ?? "").trim();
  const patientName = (url.searchParams.get("patientName") ?? "").trim();
  const limitRaw = Number(url.searchParams.get("limit") ?? "500");
  const take = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 500) : 500;

  if (q) {
    // Push the search into SQL so we only fetch rows that match — not the
    // prior "fetch 500 + include:patient + filter in JS" path. SQLite LIKE
    // is case-insensitive for ASCII by default. The search fields
    // (patientName, studyTitle, referredBy, impression) are denormalized
    // onto UsgReport itself — no JOIN, no `include: { patient: true }`.
    // v6.10 — scoped by clinicId so a multi-clinic install never leaks
    // cross-clinic patient names in search.
    const token = `%${escapeLike(q)}%`;
    const cols = Prisma.raw(LIST_COLUMNS.join(", "));
    const rows = await db.$queryRaw<Array<Record<string, unknown>>>(
      statusFilter
        ? Prisma.sql`SELECT ${cols} FROM UsgReport
            WHERE clinicId = ${clinicId}
              AND (patientName LIKE ${token} ESCAPE '\\'
                OR studyTitle LIKE ${token} ESCAPE '\\'
                OR referredBy LIKE ${token} ESCAPE '\\'
                OR impression LIKE ${token} ESCAPE '\\')
              AND status = ${statusFilter}
            ORDER BY createdAt DESC
            LIMIT 500`
        : Prisma.sql`SELECT ${cols} FROM UsgReport
            WHERE clinicId = ${clinicId}
              AND (patientName LIKE ${token} ESCAPE '\\'
                OR studyTitle LIKE ${token} ESCAPE '\\'
                OR referredBy LIKE ${token} ESCAPE '\\'
                OR impression LIKE ${token} ESCAPE '\\')
            ORDER BY createdAt DESC
            LIMIT 500`,
    );
    return Response.json({ reports: rows });
  }

  const where: Prisma.UsgReportWhereInput = { clinicId };
  if (statusFilter) where.status = statusFilter;
  if (patientPhone) {
    where.OR = [
      { patient: { phone: patientPhone } },
      // Denormalized phone may live on linked patient only — also match name+phone via patient relation
    ];
  }
  if (patientName) {
    where.patientName = { contains: patientName };
  }
  const reports = await db.usgReport.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    include: { patient: true },
    omit: { ...LIST_OMIT },
  });
  return Response.json({ reports });
}

export async function POST(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const clinicId = await getActiveClinicId();
  const body = await req.json().catch(() => ({}));

  const patientName = String(body.patientName ?? "").trim();
  if (!patientName) return Response.json({ error: "Patient name is required" }, { status: 400 });

  const studyKey = String(body.studyKey ?? "wa-female");
  const study = getStudy(studyKey);
  if (!study) return Response.json({ error: "Unknown study" }, { status: 400 });

  const state = normaliseState(body.state ?? {}, studyKey);
  const technique = String(body.technique ?? study.technique);
  const cols = await resolveColumns(JSON.stringify(state), technique);

  // Registry: link (or create) the patient row so history connects.
  // v6.10 — linkPatient now scopes by clinicId (see patients.ts).
  const patientPhone = String(body.patientPhone ?? "").trim();
  const patientId = await linkPatient(patientName, patientPhone, clinicId);

  // v6.15 — demographics guard + fallback chain (body -> order -> patient's last report)
  const saneAge = (raw: string): string => {
    const n = Number((raw || "").replace(/[^0-9]/g, ""));
    return Number.isFinite(n) && n > 0 && n <= 110 ? String(n) : "";
  };
  const bodyAge = saneAge(String(body.patientAge ?? "").trim());
  const bodyRef = String(body.referredBy ?? "").trim();
  const orderRow = body.careOrderId ? await db.usgCareOrder.findUnique({ where: { id: String(body.careOrderId) } }) : null;
  const lastRep = (!bodyAge || !bodyRef)
    ? await db.usgReport.findFirst({ where: { clinicId, patient: { phone: patientPhone || undefined } }, orderBy: { createdAt: "desc" } })
    : null;
  const patientAge = bodyAge || saneAge(orderRow?.patientAge ?? "") || saneAge(lastRep?.patientAge ?? "");
  const referredBy = bodyRef || String(orderRow?.referringDoctor ?? "").trim() || String(lastRep?.referredBy ?? "").trim();

  const report = await db.usgReport.create({
    data: {
      clinicId,
      patientName,
      patientAge,
      patientSex: body.patientSex === "M" || body.patientSex === "CHILD" || body.patientSex === "F" ? body.patientSex : "F",
      referredBy,
      patientId,
      technique,
      stateJson: JSON.stringify(state),
      scanDate: parseScanDate(body.scanDate),
      ...cols,
    },
  });
  await audit({
    action: "report.create",
    reportId: report.id,
    patientName: report.patientName,
    detail: `${study.label} draft created`,
  });
  return Response.json({ report });
}

