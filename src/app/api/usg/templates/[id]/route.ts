import { requireSession } from "@/lib/auth";
import { deleteTemplate, toggleTemplatePin } from "@/lib/usg/reportTemplates";
import { audit } from "@/lib/usg/audit";

type Ctx = { params: Promise<{ id: string }> };

/** DELETE /api/usg/templates/:id — delete a template. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;
  try {
    await deleteTemplate(id);
    await audit({ action: "template.delete", detail: `template ${id} deleted` });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
}

/** PATCH /api/usg/templates/:id — toggle pin status. */
export async function PATCH(_req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;
  try {
    await toggleTemplatePin(id);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
}
