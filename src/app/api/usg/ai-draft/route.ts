import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateAiDraft, isAiDraftEnabled } from "@/lib/usg/aiDraft";
import { audit } from "@/lib/usg/audit";

/**
 * POST /api/usg/ai-draft — generate a findings+impression draft via Ollama.
 *
 * Body: { reportId: string }
 *
 * Reads the report's current state (organ findings + impression), passes
 * it to the local Ollama server, and returns the AI's draft. The
 * radiologist reviews and edits — the AI never writes to the report.
 *
 * v6.10 — gated by the enableAiDraft feature toggle (per-clinic).
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

  const result = await generateAiDraft({
    studyTitle: report.studyTitle || report.studyKey,
    patientName: report.patientName,
    patientAge: report.patientAge,
    patientSex: report.patientSex,
    referredBy: report.referredBy,
    currentFindings: report.findings,
    clinicalIndication: body.clinicalIndication,
  });

  await audit({
    action: "ai.draft",
    reportId,
    detail: result.ok
      ? `AI draft generated (${result.ms}ms, ${result.model})`
      : `AI draft failed: ${result.error}`,
  });

  return Response.json(result);
}
