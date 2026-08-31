import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { buildBackup } from "@/lib/usg/backup";
import { backupStatus, collectFullBackup } from "@/lib/usg/backupServer";
import { audit } from "@/lib/usg/audit";

/**
 * Download a backup as one JSON file.
 *
 *   default        — the studio personalisation (settings + custom findings;
 *                    patient reports are clinical records and stay behind).
 *   ?mode=full     — the whole clinic: personalisation + patients + every
 *                    report (state + frozen snapshots) + attached stills.
 *                    Single-file disaster recovery for the single-box install.
 *   ?mode=status   — JSON status of the nightly rotation (not a download).
 */
export async function GET(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const mode = new URL(req.url).searchParams.get("mode") ?? "";

  if (mode === "status") {
    return Response.json(await backupStatus());
  }

  if (mode === "full") {
    const payload = await collectFullBackup();
    const stamp = new Date().toISOString().slice(0, 10);
    await audit({
      action: "backup.download",
      detail: `full clinic backup (${payload.reports.length} reports, ${payload.patients.length} patients)`,
    });
    return new Response(JSON.stringify(payload), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="usg-clinic-backup-${stamp}.json"`,
      },
    });
  }

  const settings = await getSettings();
  const rows = await db.usgPathology.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });

  const backup = buildBackup(
    settings as unknown as Record<string, unknown>,
    rows.map((r) => ({
      organKey: r.organKey,
      label: r.label,
      findingText: r.findingText,
      impressionLines: safeJsonArray(r.impressionLinesJson),
      titleFragment: r.titleFragment,
      sortOrder: r.sortOrder,
    })),
  );
  await audit({ action: "backup.download", detail: "personalisation backup" });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="usg-studio-backup-${stamp}.json"`,
    },
  });
}

function safeJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
