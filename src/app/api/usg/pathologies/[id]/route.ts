import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const existing = await db.usgPathology.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (typeof body.label === "string" && body.label.trim()) data.label = body.label.trim();
  if (typeof body.findingText === "string" && body.findingText.trim()) data.findingText = body.findingText.trim();
  if (Array.isArray(body.impressionLines)) {
    data.impressionLinesJson = JSON.stringify(
      body.impressionLines.filter((l: unknown): l is string => typeof l === "string" && !!l.trim()).map((l: string) => l.trim()),
    );
  }
  if (typeof body.titleFragment === "string") data.titleFragment = body.titleFragment.trim();
  if (Object.keys(data).length === 0) return Response.json({ error: "Nothing to update" }, { status: 400 });

  const row = await db.usgPathology.update({ where: { id }, data });
  return Response.json({ ok: true, label: row.label });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;
  const existing = await db.usgPathology.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
  await db.usgPathology.delete({ where: { id } });
  return Response.json({ ok: true });
}
