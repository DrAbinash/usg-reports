import { Prisma } from "@prisma/client";
import { requireSession } from "@/lib/auth";
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

export async function GET(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status") ?? "";
  const statusFilter = status === "DRAFT" || status === "FINALIZED" ? status : null;

  if (q) {
    // Push the search into SQL so we only fetch rows that match — not the
    // prior "fetch 500 + include:patient + filter in JS" path. SQLite LIKE
    // is case-insensitive for ASCII by default. The search fields
    // (patientName, studyTitle, referredBy, impression) are denormalized
    // onto UsgReport itself — no JOIN, no `include: { patient: true }`.
    const token = `%${escapeLike(q)}%`;
    const rows = await db.$queryRaw<Array<Record<string, unknown>>>(
      statusFilter
        ? Prisma.sql`SELECT * FROM UsgReport
            WHERE (patientName LIKE ${token} ESCAPE '\\'
                OR studyTitle LIKE ${token} ESCAPE '\\'
                OR referredBy LIKE ${token} ESCAPE '\\'
                OR impression LIKE ${token} ESCAPE '\\')
              AND status = ${statusFilter}
            ORDER BY createdAt DESC
            LIMIT 500`
        : Prisma.sql`SELECT * FROM UsgReport
            WHERE patientName LIKE ${token} ESCAPE '\\'
               OR studyTitle LIKE ${token} ESCAPE '\\'
               OR referredBy LIKE ${token} ESCAPE '\\'
               OR impression LIKE ${token} ESCAPE '\\'
            ORDER BY createdAt DESC
            LIMIT 500`,
    );
    return Response.json({ reports: rows });
  }

  const where: Prisma.UsgReportWhereInput = {};
  if (statusFilter) where.status = statusFilter;
  const reports = await db.usgReport.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { patient: true },
  });
  return Response.json({ reports });
}

export async function POST(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
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
  const patientPhone = String(body.patientPhone ?? "").trim();
  const patientId = await linkPatient(patientName, patientPhone);

  const report = await db.usgReport.create({
    data: {
      patientName,
      patientAge: String(body.patientAge ?? "").trim(),
      patientSex: body.patientSex === "M" || body.patientSex === "CHILD" || body.patientSex === "F" ? body.patientSex : "F",
      referredBy: String(body.referredBy ?? "").trim(),
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

