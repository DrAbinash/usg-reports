import { ensureSeed, DEMO_PIN } from "@/lib/seed";
import { getSession, verifyPin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

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
    // that as setup still being owed, not as a configured clinic.
    needsSetup: !settings.pinHash || verifyPin(DEMO_PIN, settings.pinHash),
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
