import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateSettings } from "@/lib/settings";
import { parseBackup } from "@/lib/usg/backup";
import { applyFullRestore } from "@/lib/usg/backupServer";
import { audit } from "@/lib/usg/audit";

/**
 * Restore a backup — both kinds, auto-detected by the format marker:
 *
 *   usg-studio-backup  → personalisation only (settings through the SAME
 *                        whitelist as the Settings screen; custom findings
 *                        upserted by (organ, label) — idempotent).
 *   usg-clinic-backup  → full disaster recovery: patients and reports
 *                        upserted by id, images replaced per report, serial
 *                        clashes skipped (never corrupt the register).
 */
export async function POST(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;

  const body = await req.json().catch(() => null);
  if (body && typeof body === "object" && (body as Record<string, unknown>).format === "usg-clinic-backup") {
    const result = await applyFullRestore(body);
    await audit({
      action: "backup.restore",
      detail: `full clinic restore — ${result.reportsRestored} reports, ${result.patientsRestored} patients, ${result.imagesRestored} stills${result.reportsSkipped ? `, ${result.reportsSkipped} skipped (serial clash)` : ""}`,
    });
    return Response.json({ ok: true, mode: "full", ...result });
  }

  let backup;
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

  await audit({
    action: "backup.restore",
    detail: `personalisation restore — ${Object.keys(patch).length} settings, ${restored} custom findings`,
  });

  return Response.json({
    ok: true,
    mode: "personalisation",
    settingsRestored: Object.keys(patch).length,
    customPathologiesRestored: restored,
    exportedAt: backup.exportedAt,
  });
}
