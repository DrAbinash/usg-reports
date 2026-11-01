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

  /**
   * The worklist sync, with no browser involved.
   *
   * Until v6.25 the only caller of /api/usg/worklist/sync was the worklist view,
   * so a NAS reboot at 06:00 meant no CARE rows arrived until someone opened the
   * worklist at 08:30 — and during the 30 Oct outage the studio looked dead
   * partly because nothing was asking it to live. The route is a thin shell over
   * the same function now, and that function is what this calls: no session, no
   * HTTP, no bypass of the session check (there is nothing to bypass — nothing
   * crosses the network).
   *
   * First run 20 s after boot, then every 5 minutes, and never twice at once:
   * runWorklistSync shares one in-flight promise with the browser's tick.
   * Set USG_SYNC_LOOP=0 to stop it (tests, or a machine that must not poll).
   */
  if (/^(0|false|off|no)$/i.test(String(process.env.USG_SYNC_LOOP ?? ""))) return;
  const SYNC_INTERVAL_MS = 5 * 60 * 1000;
  const syncOnce = async (reason: string) => {
    try {
      const { db } = await import("@/lib/db");
      const { runWorklistSync } = await import("@/lib/usg/runWorklistSync");
      const clinics = await db.clinic.findMany({ where: { disabled: false }, select: { slug: true } });
      const ids = clinics.length ? clinics.map((c) => c.slug) : ["default"];
      for (const clinicId of ids) {
        const out = await runWorklistSync({ clinicId, fullRequested: false });
        if (reason === "boot") {
          console.log(`[usg-studio] boot sync for ${clinicId}: ${JSON.stringify(out?.stats ?? {})}`);
        }
      }
    } catch (e) {
      console.warn(`[usg-studio] scheduled sync (${reason}) failed:`, e);
    }
  };
  const boot = setTimeout(() => void syncOnce("boot"), 20_000);
  if (typeof boot === "object" && "unref" in boot) boot.unref();
  const syncTimer = setInterval(() => void syncOnce("tick"), SYNC_INTERVAL_MS);
  if (typeof syncTimer === "object" && "unref" in syncTimer) syncTimer.unref();
}
