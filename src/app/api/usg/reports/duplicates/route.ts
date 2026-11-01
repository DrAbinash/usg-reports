import { requireSession, getActiveClinicId } from "@/lib/auth";
import { db } from "@/lib/db";
import { duplicateLabel, istDayWindow, sameDaySiblings, type DuplicateCandidate } from "@/lib/usg/duplicates";

/**
 * "This patient already has a report for this study today."
 *
 * One bill per scan is what keeps a patient's record in one piece, and nothing
 * here enforces it: press New Report twice, or take a second bill for the same
 * name on the same morning, and the studio happily opens a second draft which
 * gets its own register number when it is signed. Afterwards the history shows
 * two reports for one scanning day and nobody can tell which one is the study.
 *
 * The answer is to tell the doctor while he is still writing, in the composer,
 * with a button that opens the other report — not to refuse the second scan,
 * because a repeat after a drain or a KUB added to an abdomen is legitimate and
 * only he knows which case he is in.
 *
 * Query: `patientName`, `studyKey`, `scanDate` (yyyy-mm-dd), `exclude` (this
 * draft's own id). Returns at most 20 candidates for that study on that clinic
 * day, narrowed to the same patient by the rule the image link already uses.
 */
export async function GET(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const clinicId = await getActiveClinicId();

  const url = new URL(req.url);
  const name = (url.searchParams.get("patientName") ?? "").trim();
  const studyKey = (url.searchParams.get("studyKey") ?? "").trim();
  const day = (url.searchParams.get("scanDate") ?? "").trim();
  const exclude = (url.searchParams.get("exclude") ?? "").trim() || null;
  const window = istDayWindow(day);
  if (!name || !studyKey || !window) return Response.json({ reports: [] });

  const rows = await db.usgReport.findMany({
    where: {
      clinicId,
      studyKey,
      OR: [
        { scanDate: { gte: window[0], lt: window[1] } },
        // A draft the doctor never dated is today's work until he says otherwise.
        { scanDate: null, createdAt: { gte: window[0], lt: window[1] } },
      ],
    },
    select: { id: true, patientName: true, studyKey: true, status: true, serialNo: true, scanDate: true, createdAt: true },
    take: 20,
  });

  const candidates: DuplicateCandidate[] = rows.map((r) => ({
    id: r.id,
    patientName: r.patientName,
    studyKey: r.studyKey,
    status: r.status,
    serialNo: r.serialNo ?? null,
    scanDate: r.scanDate ? r.scanDate.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }));

  return Response.json({
    reports: sameDaySiblings(candidates, { name, studyKey, day, excludeId: exclude }).map((r) => ({
      ...r,
      // Said once, server-side, so the banner and any later screen use the same
      // words for the same record instead of formatting it twice.
      label: duplicateLabel(r),
    })),
  });
}
