import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { listStudies } from "@/lib/usg/orthancClient";

const US_MODALITIES = new Set(["US", "USG", "OB US", "OBUS", "DOPPLER", "US-DOPPLER", "ULTRASOUND", "SONOGRAPHY"]);

function isUsModality(mod: string | null | undefined): boolean {
  if (!mod) return false;
  const m = mod.trim().toUpperCase();
  if (US_MODALITIES.has(m)) return true;
  return m.includes("US") || m.includes("DOPPLER") || m.includes("ULTRASOUND") || m.includes("SONOGRAPH");
}

function extractAge(tags: any): string {
  const raw = String(tags?.PatientAge ?? "").trim();
  const n = Number(raw.replace(/[^0-9]/g, ""));
  if (Number.isFinite(n) && n >= 0 && n <= 110) return String(Math.round(n));
  return "";
}

export async function GET(req: NextRequest) {
  const guard = await requireSession();
  if (guard) return guard;
  
  const s = await getSettings();
  if (!s.orthancUrl) return NextResponse.json({ error: "Orthanc not configured" }, { status: 400 });

  const r = await listStudies();
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });

  const now = Date.now();
  const cutoff = now - (72 * 60 * 60 * 1000); // 72h window

  const rows = (r.data || [])
    .filter((st: any) => {
      const mod = st.MainDicomTags?.ModalitiesInStudy || st.MainDicomTags?.Modality;
      if (!isUsModality(mod)) return false;
      const dateStr = st.MainDicomTags?.StudyDate;
      if (!dateStr) return true;
      const y = parseInt(dateStr.substring(0, 4), 10);
      const m = parseInt(dateStr.substring(4, 6), 10) - 1;
      const d = parseInt(dateStr.substring(6, 8), 10);
      return new Date(y, m, d).getTime() >= cutoff;
    })
    .map((st: any) => ({
      worklistId: `PACS-${st.ID}`,
      accessionNumber: st.MainDicomTags?.AccessionNumber || "",
      patientName: (st.PatientMainDicomTags?.PatientName || "").replace(/\^+/g, " ").trim() || "UNKNOWN",
      patientAge: extractAge(st.PatientMainDicomTags),
      patientSex: String(st.PatientMainDicomTags?.PatientSex || "").toUpperCase().startsWith("M") ? "M" : "F",
      referringDoctor: (st.MainDicomTags?.ReferringPhysicianName || "").replace(/\^+/g, " ").trim() || "Self/Walk-in",
      testName: st.MainDicomTags?.StudyDescription || "USG Study",
      modality: "US",
      studyDate: st.MainDicomTags?.StudyDate ? `${st.MainDicomTags.StudyDate.substring(0,4)}-${st.MainDicomTags.StudyDate.substring(4,6)}-${st.MainDicomTags.StudyDate.substring(6,8)}` : null,
      studyInstanceUid: st.MainDicomTags?.StudyInstanceUID || st.ID,
      orthancId: st.ID,
    }));

  return NextResponse.json({ rows, meta: { total: rows.length, windowHours: 72 } });
}
