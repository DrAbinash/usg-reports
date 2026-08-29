import { ensureSeed } from "@/lib/seed";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { db } from "@/lib/db";

export async function GET() {
  await ensureSeed();
  const [authenticated, settings, orders] = await Promise.all([
    getSession(),
    getSettings(),
    db.careOrderLink.count(),
  ]);
  return Response.json({
    needsSetup: !settings.pinHash,
    authenticated,
    demoOrders: orders,
  });
}
