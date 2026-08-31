import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { buildBackup } from "@/lib/usg/backup";

/**
 * Download the whole studio personalisation as one JSON file:
 * letterhead/identity settings + every custom quick-select finding.
 * Secrets (PIN, integration credentials) are structurally excluded, and
 * patient reports are clinical records — they never travel in a backup.
 */
export async function GET(_req: Request) {
  const guard = await requireSession();
  if (guard) return guard;

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
