import { ensureSeed } from "@/lib/seed";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export async function GET() {
  await ensureSeed();
  const [authenticated, settings] = await Promise.all([
    getSession(),
    getSettings(),
  ]);
  return Response.json({
    needsSetup: !settings.pinHash,
    authenticated,
    // Pre-auth branding for the lock screen (no secrets)
    loginBranding: {
      theme: settings.loginTheme,
      bgUrl: settings.loginBgUrl,
      appTitle: settings.appTitle,
      hospitalName: settings.hospitalName,
    },
  });
}
