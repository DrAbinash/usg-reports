import { ensureSeed } from "@/lib/seed";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { isDemoPin, isPinSetupOutstanding } from "@/lib/pinPolicy";

export async function GET() {
  await ensureSeed();
  const [authenticated, settings] = await Promise.all([
    getSession(),
    getSettings(),
  ]);
  return Response.json({
    // A fresh install is seeded with a demo PIN, so "no PIN set" was never true
    // and the setup screen could not be reached. Until the demo PIN is actually
    // replaced this studio is unlocked by a number anyone could guess — treat
    // that as setup still being owed, not as a configured clinic. The same
    // predicate gates /api/auth/setup, which must be allowed to write over it.
    needsSetup: isPinSetupOutstanding(settings.pinHash),
    demoPin: isDemoPin(settings.pinHash),
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
