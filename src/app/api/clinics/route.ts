import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  listClinics,
  createClinic,
  updateClinic,
  validateClinicSlug,
  isTrialExpired,
  type Clinic,
} from "@/lib/clinic";
import { audit } from "@/lib/usg/audit";

/** GET /api/clinics — list all clinics for the switcher. */
export async function GET() {
  const guard = await requireSession();
  if (guard) return guard;
  const clinics = await listClinics(false);
  // Add a trialExpired flag for the UI badge.
  const withFlags = clinics.map((c) => ({
    ...c,
    trialExpired: isTrialExpired(c),
  }));
  return Response.json({ clinics: withFlags });
}

/** POST /api/clinics — create a new clinic (trial onboarding). */
export async function POST(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const body = await req.json().catch(() => ({}));
  const slug = String(body.slug ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim();
  const errs = validateClinicSlug(slug);
  if (errs.length) return Response.json({ error: errs.join("; ") }, { status: 400 });
  if (!name) return Response.json({ error: "Name is required" }, { status: 400 });
  // Slug uniqueness check.
  const existing = await db.clinic.findUnique({ where: { slug } }).catch(() => null);
  if (existing) return Response.json({ error: "Slug already in use" }, { status: 409 });
  const clinic = await createClinic({
    slug,
    name,
    brandColor: typeof body.brandColor === "string" ? body.brandColor : "",
    contactName: typeof body.contactName === "string" ? body.contactName : "",
    contactPhone: typeof body.contactPhone === "string" ? body.contactPhone : "",
    contactEmail: typeof body.contactEmail === "string" ? body.contactEmail : "",
  });
  await audit({
    action: "clinic.create",
    detail: `clinic '${clinic.name}' (${clinic.slug}) created`,
    clinicId: clinic.id,
  });
  return Response.json({ clinic });
}

/** PATCH /api/clinics — update an existing clinic. */
export async function PATCH(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "").trim();
  if (!id) return Response.json({ error: "id is required" }, { status: 400 });
  try {
    const clinic = await updateClinic(id, {
      name: typeof body.name === "string" ? body.name : undefined,
      brandColor: typeof body.brandColor === "string" ? body.brandColor : undefined,
      contactName: typeof body.contactName === "string" ? body.contactName : undefined,
      contactPhone: typeof body.contactPhone === "string" ? body.contactPhone : undefined,
      contactEmail: typeof body.contactEmail === "string" ? body.contactEmail : undefined,
      disabled: typeof body.disabled === "boolean" ? body.disabled : undefined,
      trialExpiresAt: body.trialExpiresAt === null ? null : typeof body.trialExpiresAt === "string" ? body.trialExpiresAt : undefined,
    });
    await audit({
      action: "clinic.update",
      detail: `clinic '${clinic?.name ?? id}' updated`,
      clinicId: id,
    });
    return Response.json({ clinic });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}

// Type re-export for the client.
export type { Clinic };
