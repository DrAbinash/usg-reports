import { NextRequest } from "next/server";
import { requireSession, getActiveClinicId } from "@/lib/auth";
import { runWorklistSync } from "@/lib/usg/runWorklistSync";

/**
 * Worklist sync — four fail-soft steps (v6.1 identity model + outage safety net):
 *   1. CARE bill-desk rows → import ultrasound orders by identity
 *      (careWorklistId first, legacy accession second, StudyInstanceUID
 *      bridge for a scan that reached the PACS before its bill row arrived,
 *      never names). Every cycle re-reads the last SYNC_LOOKBACK_DAYS days
 *      and upserts — there is no watermark and nothing to fall behind (see
 *      planWorklistPull for why one was removed). A row rejected this cycle
 *      is served again next cycle.
 *   2. Orthanc studies → attach by exact StudyInstanceUID, then exact
 *      single-hit AccessionNumber. Whatever the identifiers could not reach is
 *      then linked by demographics (patient name + the clinic's scanning day, the
 *      referring doctor's name and the scanning minute as tie-breakers, one day
 *      either side as a last resort). Each link writes the rule onto the row as
 *      `uidLinkedBy`, so the worklist can show which ones are inferences; the
 *      only refusal left is two scans for one name at the same minute. Orders
 *      with no study at all stay visible as "Awaiting images".
 *   3. Outage safety net (importOrthancOrphans): a study in the PACS that CARE
 *      has not served YET becomes a reportable row carrying only the patient's
 *      details, the referring doctor's name and the Study UID — never an
 *      accession, a worklist id or a test name. Every scanned patient at this
 *      clinic IS billed in CARE; the USG machine simply follows no Modality
 *      Worklist and writes no accession, so a study reaches the studio's list
 *      only when CARE's bridge hands its row over. This step exists for the
 *      hours CARE cannot answer, not as a second feed — and when CARE's row
 *      does arrive it adopts this one by UID, so the bill identity lands on the
 *      same row instead of making a twin.
 *   4. Billing badge refresh + retry pending finalizes
 *
 * Every decision is counted in the response; skips carry a safe reason
 * (worklistId + reason — never patient data, never secrets).
 *
 * The work itself lives in src/lib/usg/runWorklistSync.ts so the server timer can
 * run the same steps without a browser. This file is the authenticated door.
 */
export async function POST(req: NextRequest) {
  const guard = await requireSession();
  if (guard) return guard;
  const clinicId = await getActiveClinicId();
  const full =
    req.nextUrl.searchParams.get("full") === "1" ||
    req.nextUrl.searchParams.get("full") === "true";
  return Response.json(await runWorklistSync({ clinicId, fullRequested: full }));
}
