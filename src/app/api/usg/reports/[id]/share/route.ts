import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import {
  createShareToken,
  normalizeWhatsappRouting,
  planWhatsappShare,
  shareUrlForToken,
  type WhatsappRouting,
} from "@/lib/usg/secureShare";
import { normalizeDoctorName } from "@/lib/usg/doctors";

type Ctx = { params: Promise<{ id: string }> };

function originOf(req: Request): string {
  const env = (process.env.STUDIO_INTERNAL_URL ?? "").replace(/\/+$/, "");
  if (env) return env;
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

/**
 * POST /api/usg/reports/[id]/share — mint a 7-day secure share token +
 * WhatsApp deep-link plan for the finalized report.
 */
export async function POST(req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;

  const { id } = await ctx.params;
  const report = await db.usgReport.findUnique({
    where: { id },
    include: { patient: true },
  });
  if (!report) return Response.json({ error: "Not found" }, { status: 404 });
  if (report.status !== "FINALIZED") {
    return Response.json({ error: "Only finalized reports can be shared" }, { status: 400 });
  }

  const settings = await getSettings();
  const routing = normalizeWhatsappRouting(
    (settings as { whatsappRouting?: string }).whatsappRouting,
  ) as WhatsappRouting;

  const token = createShareToken(report.id);
  const shareUrl = shareUrlForToken(originOf(req), token);
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;

  const patientPhone = report.patient?.phone?.trim() || "";
  let doctorPhone = "";
  const ref = report.referredBy?.trim() || "";
  if (ref && !/^self$/i.test(ref)) {
    const name = ref.replace(/^Doctor:\s*/i, "").trim();
    if (name) {
      const doc = await db.usgDoctor.findFirst({
        where: {
          clinicId: report.clinicId,
          OR: [
            { normName: normalizeDoctorName(name) },
            { name: { contains: name } },
          ],
        },
      });
      doctorPhone = doc?.phone?.trim() || "";
    }
  }

  const plan = planWhatsappShare({
    routing,
    shareUrl,
    patientPhone,
    doctorPhone,
    hospitalName: settings.hospitalName || settings.appTitle || "USG Studio",
  });

  return Response.json({
    token,
    shareUrl,
    expiresAt: new Date(exp).toISOString(),
    routing: plan.routing,
    message: plan.message,
    primaryUrl: plan.primaryUrl,
    secondaryUrl: plan.secondaryUrl,
    copyFallback: plan.copyFallback,
  });
}
