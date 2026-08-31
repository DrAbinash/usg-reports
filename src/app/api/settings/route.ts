import { requireSession } from "@/lib/auth";
import { getMaskedSettings, updateSettings } from "@/lib/settings";
import { ensureSeed } from "@/lib/seed";

export async function GET() {
  const guard = await requireSession();
  if (guard) return guard;
  await ensureSeed();
  return Response.json({ settings: await getMaskedSettings() });
}

export async function PUT(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const body = await req.json().catch(() => ({}));
  await updateSettings(body);
  return Response.json({ settings: await getMaskedSettings() });
}
