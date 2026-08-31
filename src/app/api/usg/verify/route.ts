import { db } from "@/lib/db";
import { getQrSecret } from "@/lib/usg/qrServer";
import { checkPayload } from "@/lib/usg/verify";

/**
 * PUBLIC report verification (v5): validate a signed payload from a printed
 * report's QR (or pasted text). No session — the payload holder already has
 * the sheet; this confirms the sheet came from this studio and the register
 * entry exists. Reveals only what the sheet itself shows.
 */
export async function GET(req: Request) {
  const d = new URL(req.url).searchParams.get("d") ?? "";
  if (!d.trim()) {
    return Response.json({ valid: false, reason: "no payload" });
  }
  const secret = await getQrSecret();
  const result = checkPayload(decodeURIComponent(d), secret);
  if (!result.valid) {
    return Response.json({ valid: false, reason: "signature mismatch" });
  }

  // The signed fields must also match a live register row.
  const report = await db.usgReport.findFirst({
    where: { serialNo: result.serialNo, status: "FINALIZED" },
  });
  if (!report) {
    return Response.json({ valid: false, reason: "no such register entry" });
  }
  const normName = (n: string) => n.trim().toLowerCase().replace(/\s+/g, " ");
  if (normName(report.patientName) !== result.patientName) {
    return Response.json({ valid: false, reason: "patient does not match the register" });
  }

  return Response.json({
    valid: true,
    serial: `USG-${String(result.serialNo).padStart(4, "0")}`,
    patientName: report.patientName,
    study: report.studyTitle,
    finalizedOn: report.finalizedAt?.toISOString() ?? null,
  });
}
