import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateAiDraft, isAiDraftEnabled, type AiDraftOrganInput } from "@/lib/usg/aiDraft";
import { audit } from "@/lib/usg/audit";
import { pathologiesForOrgan } from "@/lib/usg/composer";
import { USG_PATHOLOGIES_ALL } from "@/lib/usg/pathologies";
import { getStudy } from "@/lib/usg/studies";
import { isGridOrgan } from "@/lib/usg/gridOrgans";

/**
 * POST /api/usg/ai-draft — generate a full-report skeleton via Ollama.
 *
 * Body: { reportId: string, clinicalIndication?: string, technique?: string }
 *
 * Builds study organ list + allowed pathology keys, asks Ollama for strict
 * JSON (per-organ finding keys + impression/advice), returns AiDraftResult.
 * The radiologist reviews chips and applies via togglePathology — the AI
 * never writes to the report.
 *
 * Gated by the enableAiDraft feature toggle (per-clinic).
 */
export async function POST(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;

  if (!(await isAiDraftEnabled())) {
    return Response.json({ error: "AI Draft is disabled for this clinic" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const reportId = String(body.reportId ?? "").trim();
  if (!reportId) return Response.json({ error: "reportId is required" }, { status: 400 });

  const report = await db.usgReport.findUnique({ where: { id: reportId } });
  if (!report) return Response.json({ error: "Report not found" }, { status: 404 });

  const study = getStudy(report.studyKey);
  const organs: AiDraftOrganInput[] = (study?.organs ?? [])
    .filter((o) => !isGridOrgan(o) && !!o.normal?.trim())
    .map((o) => ({
      key: o.key,
      label: o.label,
      allowedKeys: pathologiesForOrgan(USG_PATHOLOGIES_ALL, o.key).map((p) => p.key),
    }));

  const clinicalIndication =
    typeof body.clinicalIndication === "string" ? body.clinicalIndication.trim() : "";
  const technique =
    (typeof body.technique === "string" && body.technique.trim()) ||
    report.technique ||
    study?.technique ||
    "";

  const result = await generateAiDraft({
    studyTitle: report.studyTitle || study?.title || report.studyKey,
    studyKey: report.studyKey,
    patientName: report.patientName,
    patientAge: report.patientAge,
    patientSex: report.patientSex,
    referredBy: report.referredBy,
    currentFindings: report.findings,
    clinicalIndication: clinicalIndication || undefined,
    technique: technique || undefined,
    organs,
  });

  await audit({
    action: "ai.draft",
    reportId,
    detail: result.ok
      ? `AI skeleton drafted (${result.ms}ms, ${result.model}, ${result.skeleton?.organs.length ?? 0} organs)`
      : `AI draft failed: ${result.error}`,
  });

  return Response.json(result);
}
