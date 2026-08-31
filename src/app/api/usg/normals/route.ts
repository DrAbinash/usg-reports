import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStudy } from "@/lib/usg/studies";
import { audit } from "@/lib/usg/audit";

/**
 * Normal-wording overrides (v5) — the doctor retunes any builtin organ
 * normal to her own phrasing. GET lists them, POST upserts one
 * (validated against the study/organ table), DELETE resets it to builtin.
 */
export async function GET() {
  const guard = await requireSession();
  if (guard) return guard;
  const rows = await db.usgNormalOverride.findMany({ orderBy: { updatedAt: "desc" } });
  return Response.json({ overrides: rows });
}

export async function POST(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const body = await req.json().catch(() => ({}));

  const studyKey = String(body.studyKey ?? "").trim();
  const organKey = String(body.organKey ?? "").trim();
  const text = String(body.text ?? "").trim();

  const study = getStudy(studyKey);
  const organ = study?.organs.find((o) => o.key === organKey);
  if (!study || !organ) {
    return Response.json({ error: "Unknown study or organ" }, { status: 400 });
  }
  if (!text) {
    return Response.json({ error: "Wording cannot be empty — use Reset to go back to the builtin" }, { status: 400 });
  }

  const row = await db.usgNormalOverride.upsert({
    where: { studyKey_organKey: { studyKey, organKey } },
    create: { studyKey, organKey, text },
    update: { text },
  });
  await audit({
    action: "normals.override",
    detail: `${study.label} · ${organ.label} normal wording customised`,
  });
  return Response.json({ override: row });
}

export async function DELETE(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const url = new URL(req.url);
  const studyKey = url.searchParams.get("studyKey") ?? "";
  const organKey = url.searchParams.get("organKey") ?? "";

  const study = getStudy(studyKey);
  const organ = study?.organs.find((o) => o.key === organKey);
  if (!study || !organ) {
    return Response.json({ error: "Unknown study or organ" }, { status: 400 });
  }

  const existing = await db.usgNormalOverride.findUnique({
    where: { studyKey_organKey: { studyKey, organKey } },
  });
  if (existing) {
    await db.usgNormalOverride.delete({ where: { id: existing.id } });
    await audit({
      action: "normals.reset",
      detail: `${study.label} · ${organ.label} normal wording reset to builtin`,
    });
  }
  return Response.json({ ok: true });
}
