import { requireSession } from "@/lib/auth";
import { deleteDoctor } from "@/lib/usg/doctors";

type Ctx = { params: Promise<{ id: string }> };

/** DELETE /api/usg/doctors/:id — delete a doctor. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;
  try {
    await deleteDoctor(id);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
}
