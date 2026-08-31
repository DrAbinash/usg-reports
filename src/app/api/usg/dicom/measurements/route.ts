import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { fetchInstanceMetadata, fetchRenderedInstance, listDicomInstances, listDicomSeries } from "@/lib/usg/orthancClient";
import { mapSrToStudy, parseDicomSr, type SrMeasurement } from "@/lib/usg/srExtract";
import { geminiUsgOcr, ocrToSrMeasurements } from "@/lib/usg/visionOcr";

/**
 * "Pull from machine" — measurements for one report, in fidelity order:
 *
 *   1. DICOM SR in Orthanc (typed numbers, confidence high)
 *   2. Gemini Vision OCR of the first rendered frames (optional, needs key)
 *
 * The response is already mapped onto the composer's organ var slots for
 * the report's study; `extras` carries everything unmatched so no machine
 * value is silently dropped.
 */
export async function POST(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const body = await req.json().catch(() => ({}));
  const reportId = String(body.reportId ?? "");

  const report = await db.usgReport.findUnique({ where: { id: reportId } });
  if (!report) return Response.json({ error: "Report not found" }, { status: 404 });

  const order = await db.usgCareOrder.findFirst({ where: { reportId } });
  const studyUid = order?.studyInstanceUid ?? null;
  if (!studyUid) {
    return Response.json({ error: "No PACS study linked to this report yet (sync the worklist, or the machine has not pushed it)" }, { status: 400 });
  }

  const seriesR = await listDicomSeries(studyUid);
  if (!seriesR.ok) return Response.json({ error: seriesR.error }, { status: 502 });

  // 1. SR instances — typed measurements straight from the machine.
  let sr: SrMeasurement[] = [];
  let srInstanceCount = 0;
  for (const s of seriesR.data) {
    if ((s.modality ?? "").toUpperCase() !== "SR") continue;
    const inst = await listDicomInstances(studyUid, s.uid);
    if (!inst.ok) continue;
    for (const i of inst.data.slice(0, 4)) {
      const meta = await fetchInstanceMetadata(studyUid, s.uid, i.sopUid);
      if (!meta.ok) continue;
      const found = parseDicomSr(JSON.stringify(meta.data));
      if (found.length) {
        srInstanceCount++;
        sr = sr.concat(found);
      }
    }
  }

  let source: "sr" | "ocr" | "none" = sr.length ? "sr" : "none";
  let ocrNote: string | null = null;

  // 2. OCR fallback — only when the machine stored no SR.
  if (!sr.length) {
    const settings = await getSettings();
    if (settings.geminiApiKey) {
      const imageSeries = seriesR.data.filter((s) => {
        const m = (s.modality ?? "").toUpperCase();
        return m === "US" || m === "" || m === "OT";
      });
      let frames = 0;
      for (const s of imageSeries) {
        if (frames >= 3) break; // the ERP caps at 3 frames for the same reason
        const inst = await listDicomInstances(studyUid, s.uid);
        if (!inst.ok) continue;
        for (const i of inst.data.slice(0, 3)) {
          if (frames >= 3) break;
          const rendered = await fetchRenderedInstance({ studyUid, seriesUid: s.uid, sopUid: i.sopUid, size: 1100 });
          if (!rendered.ok) continue;
          frames++;
          const b64 = rendered.data.slice(rendered.data.indexOf(",") + 1);
          const ocr = await geminiUsgOcr(b64, "image/jpeg");
          if (ocr.ok) {
            sr = sr.concat(ocrToSrMeasurements(ocr.data));
            if (ocr.data?.rawText) {
              ocrNote = `OCR read ${frames} frame(s)`;
            }
          } else {
            ocrNote = ocr.error;
          }
        }
      }
      if (sr.length) source = "ocr";
    } else {
      ocrNote = "This machine stored no DICOM SR — optional Vision OCR can read the burned-in values (Settings → Integrations)";
    }
  }

  const mapped = mapSrToStudy(sr, report.studyKey);

  return Response.json({
    ok: true,
    source,
    srInstanceCount,
    framesOcr: source === "ocr" ? (ocrNote?.match(/\d+/)?.[0] ?? null) : null,
    ocrNote,
    matchedCount: mapped.matchedCount,
    vars: mapped.vars,
    extras: mapped.extras,
  });
}
