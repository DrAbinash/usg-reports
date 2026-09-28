import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { listRecentUltrasoundStudies } from "@/lib/usg/orthancClient";

export async function GET() {
  const guard = await requireSession();
  if (guard) return guard;

  // Shared DICOMweb helper (same source the sync orphan-import uses).
  const r = await listRecentUltrasoundStudies(3, 200);
  if (!r.ok) {
    const status = /not configured/i.test(r.error) ? 400 : /responded/i.test(r.error) ? 502 : 500;
    return NextResponse.json({ error: r.error, rows: [] }, { status });
  }

  const rows = r.data.map((st) => ({
    worklistId: `PACS-${st.studyInstanceUid}`,
    accessionNumber: st.accessionNumber || "",
    patientName: st.patientName,
    patientAge: st.patientAge,
    patientSex: st.patientSex || "F",
    referringDoctor: st.referringDoctor || "Self/Walk-in",
    testName: st.testName || "USG Study",
    modality: "US",
    studyDate: st.studyDate,
    studyInstanceUid: st.studyInstanceUid,
  }));

  return NextResponse.json({ rows, meta: { total: rows.length, source: "dicom-web" } });
}
