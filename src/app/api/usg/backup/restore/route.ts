import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateSettings } from "@/lib/settings";
import { parseBackup, type UsgBackupFile } from "@/lib/usg/backup";

/**
 * Restore a studio personalisation backup: settings go through the SAME
 * whitelist as the Settings screen (updateSettings — secrets and unknown
 * fields can never be injected from a backup file), and custom pathologies
 * are upserted by their (organKey, label) unique key so restoring the same
 * file twice is idempotent. Customs on this machine that are NOT in the
 * backup are left in place — a restore adds back what was saved, it never
 * silently deletes work done since.
 */
export async function POST(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;

  const body = await req.json().catch(() => null);
  let backup: UsgBackupFile;
  try {
    backup = parseBackup(body);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Invalid backup file" }, { status: 400 });
  }

  // Settings — string/boolean fields through the whitelist; booleans are
  // stringified because updateSettings' patch contract is string-valued
  // (checkboxes arrive as strings from the form).
  const patch: Record<string, string> = {};
  for (const [k, v] of Object.entries(backup.settings)) {
    if (typeof v === "string") patch[k] = v;
    else if (typeof v === "boolean") patch[k] = v ? "true" : "false";
  }
  if (Object.keys(patch).length) await updateSettings(patch);

  // Custom pathologies — upsert on the (organKey, label) unique key.
  let restored = 0;
  for (const c of backup.customPathologies) {
    await db.usgPathology.upsert({
      where: { organKey_label: { organKey: c.organKey, label: c.label } },
      create: {
        organKey: c.organKey,
        label: c.label,
        findingText: c.findingText,
        impressionLinesJson: JSON.stringify(c.impressionLines),
        titleFragment: c.titleFragment,
        sortOrder: c.sortOrder,
      },
      update: {
        findingText: c.findingText,
        impressionLinesJson: JSON.stringify(c.impressionLines),
        titleFragment: c.titleFragment,
        sortOrder: c.sortOrder,
      },
    });
    restored++;
  }

  return Response.json({
    ok: true,
    settingsRestored: Object.keys(patch).length,
    customPathologiesRestored: restored,
    exportedAt: backup.exportedAt,
  });
}
