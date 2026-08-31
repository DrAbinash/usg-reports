import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { USG_STUDIES } from "@/lib/usg/studies";
import { USG_PATHOLOGIES_ALL } from "@/lib/usg/pathologies";
import { computeAnalytics } from "@/lib/usg/analytics";

/** Practice analytics — monthly volume, study mix, pathology frequency, referrers. */
export async function GET(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;

  const months = Math.min(Math.max(Number(new URL(req.url).searchParams.get("months") ?? 12) || 12, 1), 60);
  const reports = await db.usgReport.findMany({
    select: {
      studyKey: true,
      status: true,
      scanDate: true,
      createdAt: true,
      referredBy: true,
      stateJson: true,
    },
  });
  const patientCount = await db.usgPatient.count();

  const labels: Record<string, string> = {};
  for (const s of USG_STUDIES) labels[s.key] = s.label;

  const pathologyLabels: Record<string, string> = {};
  for (const p of USG_PATHOLOGIES_ALL) pathologyLabels[p.key] = p.label;

  const analytics = computeAnalytics(
    reports.map((r) => ({
      studyKey: r.studyKey,
      status: r.status,
      scanDate: r.scanDate?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      referredBy: r.referredBy,
      stateJson: r.stateJson,
    })),
    patientCount,
    months,
    labels,
    pathologyLabels,
  );
  return Response.json({ analytics });
}
