/**
 * USG Studio — server instrumentation (v5 phase 6).
 *
 * register() runs once per Node server start. When "Automatic nightly
 * backup" is enabled in Settings → Data, a 10-minute interval checks the
 * local date and (after 02:00) writes data/backups/usg-auto-YYYY-MM-DD.json
 * exactly once per day, keeping the newest 14. Everything is best-effort —
 * a backup failure must never take the clinical app down.
 *
 * v6.18: explicitly sets process.env.TZ to Asia/Kolkata (IST) if not already
 * set, so all Date operations use Indian Standard Time regardless of the
 * host OS timezone. Docker already sets TZ via docker-compose; this catches
 * the Windows standalone build and any non-Docker deployment.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // v6.18: Force IST if TZ is not set. This ensures new Date(), getHours(),
  // toLocaleDateString() etc. all use Asia/Kolkata. The Docker container
  // already sets TZ=Asia/Kolkata; this is for the Windows standalone and
  // any deployment that doesn't set TZ.
  if (!process.env.TZ) {
    process.env.TZ = "Asia/Kolkata";
    console.log("[usg-studio] TZ not set — defaulting to Asia/Kolkata (IST)");
  }

  const NIGHTLY_INTERVAL_MS = 10 * 60 * 1000;
  const timer = setInterval(() => {
    void (async () => {
      try {
        const { runNightlyBackupIfDue } = await import("@/lib/usg/backupServer");
        const { audit } = await import("@/lib/usg/audit");
        const file = await runNightlyBackupIfDue();
        if (file) {
          await audit({ action: "backup.nightly", detail: `data/backups/${file}` });
          console.log(`[usg-studio] nightly backup written: ${file}`);
        }
      } catch (e) {
        console.warn("[usg-studio] nightly backup check failed:", e);
      }
    })();
  }, NIGHTLY_INTERVAL_MS);
  // Never hold the process open just for the backup timer.
  if (typeof timer === "object" && "unref" in timer) timer.unref();
}
