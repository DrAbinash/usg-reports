import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStudy } from "@/lib/usg/studies";
import { normaliseState } from "@/lib/usg/composer";
import { resolveColumns } from "@/lib/usg/server";
import { parseScanDate } from "@/lib/usg/dates";
import { linkPatient } from "@/lib/usg/patients";

export async function GET(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const status = url.searchParams.get("status") ?? "";

  const where: Record<string, unknown> = {};
  if (status === "DRAFT" || status === "FINALIZED") where.status = status;

  if (q) {
    // SQLite contains() is case-sensitive; filter in memory for search.
    const rows = await db.usgReport.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
    const filtered = rows.filter(
      (r) =>
        (!where.status || r.status === where.status) &&
        (r.patientName.toLowerCase().includes(q) ||
          r.studyTitle.toLowerCase().includes(q) ||
          r.referredBy.toLowerCase().includes(q) ||
          r.impression.toLowerCase().includes(q)),
    );
    return Response.json({ reports: filtered });
  }

  const reports = await db.usgReport.findMany({ where, orderBy: { createdAt: "desc" }, take: 500 });
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
      patientSex: body.patientSex === "M" || body.patientSex === "CHILD" ? body.patientSex : "F",
      referredBy: String(body.referredBy ?? "").trim(),
      patientId,
      technique,
      stateJson: JSON.stringify(state),
      scanDate: parseScanDate(body.scanDate),
      ...cols,
    },
  });
  return Response.json({ report });
}

