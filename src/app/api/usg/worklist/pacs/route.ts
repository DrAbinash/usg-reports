import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export async function GET(req: NextRequest) {
  const guard = await requireSession();
  if (guard) return guard;
  
  const s = await getSettings();
  if (!s.orthancUrl) return NextResponse.json({ error: "Orthanc not configured", rows: [] }, { status: 400 });

  const baseUrl = s.orthancUrl.replace(/\/$/, "");
  const auth = s.orthancUsername && s.orthancPassword 
    ? "Basic " + Buffer.from(`${s.orthancUsername}:${s.orthancPassword}`).toString("base64") 
    : null;

  // Calculate date 72h ago (YYYYMMDD format)
  const d = new Date();
  d.setDate(d.getDate() - 3);
  const dateStr = d.toISOString().slice(0, 10).replace(/-/g, "");
  
  // Use DICOM-Web which sees the raw tags (including 00080061 ModalitiesInStudy)
  const url = `${baseUrl}/dicom-web/studies?00080020=${dateStr}-&includefield=00080061,00100010,00100020,00080050,00080090,00081030,0020000D,00100040&limit=200`;
  
  try {
    const headers: Record<string, string> = { "Accept": "application/dicom+json" };
    if (auth) headers["Authorization"] = auth;
    
    const r = await fetch(url, { headers, next: { revalidate: 0 } });
    if (!r.ok) {
      return NextResponse.json({ error: `Orthanc DICOM-Web returned ${r.status}`, rows: [] }, { status: 502 });
    }
    
    const studies = await r.json();
    const rows = [];
    
    for (const st of studies) {
      const mods = st["00080061"]?.Value || [];
      const isUs = mods.some((m: string) => ["US", "USG", "OB US", "OBUS", "DOPPLER"].includes(String(m).toUpperCase()));
      
      // Fallback: if modality is blank but description suggests US
      const desc = String(st["00081030"]?.Value?.[0] || "").toUpperCase();
      const isUsByDesc = /USG|ULTRASOUND|SONOGRAPH|DOPPLER|OBSTETRIC|ANTENATAL|FETAL|GROWTH/.test(desc);
      
      if (!isUs && !isUsByDesc) continue;
      
      const rawName = (pn: any): string => { const v = pn?.Value?.[0]; if (!v) return ""; return (typeof v === "string" ? v : v.Alphabetic || "").replace(/\^+/g, " ").trim(); };
      const getName = (pn: any) => {
        if (!pn?.Value?.[0]) return "UNKNOWN";
        const v = pn.Value[0];
        return (typeof v === "string" ? v : v.Alphabetic || "").replace(/\^+/g, " ").trim() || "UNKNOWN";
      };

      rows.push({
        worklistId: `PACS-${st["0020000D"]?.Value?.[0] || ""}`,
        accessionNumber: st["00080050"]?.Value?.[0] || st["00100020"]?.Value?.[0] || "",
        patientName: getName(st["00100010"]),
        patientAge: (st["00101010"]?.Value?.[0] || "").replace(/[^0-9]/g, ""), 
        patientSex: st["00100040"]?.Value?.[0] === "M" ? "M" : "F",
        referringDoctor: rawName(st["00080090"]) || "Self/Walk-in",
        testName: st["00081030"]?.Value?.[0] || "USG Study",
        modality: "US",
        studyDate: st["00080020"]?.Value?.[0] ? `${st["00080020"].Value[0].substring(0,4)}-${st["00080020"].Value[0].substring(4,6)}-${st["00080020"].Value[0].substring(6,8)}` : null,
        studyInstanceUid: st["0020000D"]?.Value?.[0] || "",
      });
    }
    
    return NextResponse.json({ rows, meta: { total: rows.length, source: "dicom-web" } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, rows: [] }, { status: 500 });
  }
}
