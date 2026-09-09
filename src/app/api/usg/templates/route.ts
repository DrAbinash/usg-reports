import { requireSession } from "@/lib/auth";
import { listTemplates, saveTemplate } from "@/lib/usg/reportTemplates";
import { audit } from "@/lib/usg/audit";

/** GET /api/usg/templates — list all quick-report templates for the active clinic. */
export async function GET() {
  const guard = await requireSession();
  if (guard) return guard;
  const templates = await listTemplates();
  return Response.json({ templates });
}

/** POST /api/usg/templates — save a new template (or update by name). */
export async function POST(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const studyKey = String(body.studyKey ?? "").trim();
  const stateJson = String(body.stateJson ?? "{}");

  if (!name) return Response.json({ error: "Name is required" }, { status: 400 });
  if (!studyKey) return Response.json({ error: "Study key is required" }, { status: 400 });

  try {
    const template = await saveTemplate({ name, studyKey, stateJson });
    await audit({ action: "template.save", detail: `template '${name}' saved` });
    return Response.json({ template });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
