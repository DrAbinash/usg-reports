import { requireSession, getActiveClinicId, setActiveClinicId } from "@/lib/auth";
import { listClinics, getClinic, isTrialExpired } from "@/lib/clinic";
import { audit } from "@/lib/usg/audit";

/**
 * GET /api/clinics/active — the currently selected clinic (from the cookie)
 * plus the full list for the switcher dropdown.
 */
export async function GET() {
  const guard = await requireSession();
  if (guard) return guard;
  const activeId = await getActiveClinicId();
  const clinics = await listClinics(false);
  const active = clinics.find((c) => c.id === activeId) ?? clinics[0] ?? null;
  return Response.json({
    active,
    clinics: clinics.map((c) => ({ ...c, trialExpired: isTrialExpired(c) })),
  });
}

/**
 * POST /api/clinics/active — switch the active clinic. Body: { clinicId }.
 * Sets the cookie; the next page reload / API call uses the new clinic.
 */
export async function POST(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const body = await req.json().catch(() => ({}));
  const clinicId = String(body.clinicId ?? "").trim();
  if (!clinicId) return Response.json({ error: "clinicId is required" }, { status: 400 });
  // Validate: clinic must exist and not be disabled.
  const clinic = await getClinic(clinicId, false);
  if (!clinic) return Response.json({ error: "Clinic not found or disabled" }, { status: 404 });
  await setActiveClinicId(clinicId);
  await audit({
    action: "clinic.switch",
    detail: `switched to clinic '${clinic.name}' (${clinic.slug})`,
    clinicId,
  });
  return Response.json({ active: clinic });
}
