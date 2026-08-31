import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizePhone, normalizeName } from "@/lib/usg/patients";

type Ctx = { params: Promise<{ id: string }> };

/** Patient detail + every report of theirs (the history view). */
export async function GET(_req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;
  const patient = await db.usgPatient.findUnique({
    where: { id },
    include: { reports: { orderBy: { createdAt: "desc" } } },
  });
  if (!patient) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ patient });
}

/** Edit a patient's contact details / notes (name edits relink nothing —
 *  the registry key changes with it, which is exactly what an edit means). */
export async function PATCH(req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;
  const patient = await db.usgPatient.findUnique({ where: { id } });
  if (!patient) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, string> = {};

  if (typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim();
    data.normName = normalizeName(body.name);
  }
  if (typeof body.phone === "string") {
    const norm = normalizePhone(body.phone);
    const clash = norm
      ? await db.usgPatient.findFirst({ where: { normName: data.normName ?? patient.normName, normPhone: norm, NOT: { id } } })
      : null;
    if (clash) return Response.json({ error: "Another patient with this name and phone exists" }, { status: 409 });
    data.phone = body.phone.trim();
    data.normPhone = norm;
  }
  if (typeof body.notes === "string") data.notes = body.notes.trim();

  if (!Object.keys(data).length) return Response.json({ patient });
  const updated = await db.usgPatient.update({ where: { id }, data });
  return Response.json({ patient: updated });
}
