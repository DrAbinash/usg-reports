import { requireSession } from "@/lib/auth";
import { getMaskedSettings, updateSettings } from "@/lib/settings";
import { audit } from "@/lib/usg/audit";
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
  await audit({ action: "settings.save", detail: "studio personalisation saved" });
  return Response.json({ settings: await getMaskedSettings() });
}
