import { requireSession } from "@/lib/auth";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export async function GET() {
  const guard = await requireSession();
  if (guard) return guard;
  const indexPath = join(process.cwd(), "formats-usg/_index.json");
  if (!existsSync(indexPath)) return Response.json({ error: "Template index not found." }, { status: 404 });
  try {
    const raw = readFileSync(indexPath, "utf-8");
    return Response.json({ templates: JSON.parse(raw) });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
