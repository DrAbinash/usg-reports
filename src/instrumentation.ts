/**
 * USG Studio — server instrumentation (v5 phase 6).
 *
 * register() runs once per Node server start. When "Automatic nightly
 * backup" is enabled in Settings → Data, a 10-minute interval checks the
 * local date and (after 02:00) writes data/backups/usg-auto-YYYY-MM-DD.json
 * exactly once per day, keeping the newest 14. Everything is best-effort —
 * a backup failure must never take the clinical app down.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

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
