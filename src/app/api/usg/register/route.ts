import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { registerCsv, registerHtml, type RegisterRow } from "@/lib/usg/register";
import { audit } from "@/lib/usg/audit";

/**
 * The sequential USG register as an export:
 *   ?format=csv  (default) — CSV download for records / spreadsheets
 *   ?format=html — a standalone printable register page
 * Finalized reports only, ordered by serial number.
 */
export async function GET(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;

  const rows: RegisterRow[] = (
    await db.usgReport.findMany({
      where: { status: "FINALIZED", serialNo: { not: null } },
      orderBy: { serialNo: "asc" },
      include: { patient: true },
    })
  ).map((r) => ({
    serialNo: r.serialNo ?? 0,
    scanDate: (r.scanDate ?? r.finalizedAt ?? r.createdAt).toISOString(),
    finalizedAt: r.finalizedAt?.toISOString() ?? r.createdAt.toISOString(),
    patientName: r.patientName,
    patientAge: r.patientAge,
    patientSex: r.patientSex,
    phone: r.patient?.phone ?? "",
    studyTitle: r.studyTitle,
    referredBy: r.referredBy,
  }));

  const format = new URL(req.url).searchParams.get("format") ?? "csv";
  const stamp = new Date().toISOString().slice(0, 10);
  await audit({ action: "backup.download", detail: `register export (${format}, ${rows.length} rows)` });

  if (format === "html") {
    const settings = await getSettings();
    return new Response(registerHtml(rows, settings), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return new Response(registerCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="usg-register-${stamp}.csv"`,
    },
  });
}
