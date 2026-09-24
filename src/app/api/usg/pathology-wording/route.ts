import { requireSession, getActiveClinicId } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStudy } from "@/lib/usg/studies";
import { getPathologyAny } from "@/lib/usg/pathologies";
import { audit } from "@/lib/usg/audit";
import { pathologyOverrideKey } from "@/lib/usg/triad";

/**
 * Clinic-wide pathology impression / advice wording overrides.
 * GET lists them; POST upserts one; DELETE resets to catalog.
 */
export async function GET() {
  const guard = await requireSession();
  if (guard) return guard;
  const clinicId = await getActiveClinicId();
  const rows = await db.usgPathologyWordingOverride.findMany({
    where: { clinicId },
    orderBy: { updatedAt: "desc" },
  });
  const impressions: Record<string, string> = {};
  const advice: Record<string, string> = {};
  for (const r of rows) {
    const k = pathologyOverrideKey(r.studyKey, r.organKey, r.pathologyKey);
    if (r.kind === "advice") advice[k] = r.text;
    else impressions[k] = r.text;
  }
  return Response.json({ overrides: rows, impressions, advice });
}

export async function POST(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const clinicId = await getActiveClinicId();
  const body = await req.json().catch(() => ({}));

  const studyKey = String(body.studyKey ?? "").trim();
  const organKey = String(body.organKey ?? "").trim();
  const pathologyKey = String(body.pathologyKey ?? "").trim();
  const kind = String(body.kind ?? "").trim() === "advice" ? "advice" : "impression";
  const text = String(body.text ?? "").trim();

  const study = getStudy(studyKey);
  const organ = study?.organs.find((o) => o.key === organKey);
  const pathology = getPathologyAny(pathologyKey);
  if (!study || !organ || !pathology) {
    return Response.json({ error: "Unknown study, organ, or pathology" }, { status: 400 });
  }
  if (!text) {
    return Response.json({ error: "Wording cannot be empty — use Reset to clear" }, { status: 400 });
  }

  const row = await db.usgPathologyWordingOverride.upsert({
    where: {
      clinicId_studyKey_organKey_pathologyKey_kind: {
        clinicId,
        studyKey,
        organKey,
        pathologyKey,
        kind,
      },
    },
    create: { clinicId, studyKey, organKey, pathologyKey, kind, text },
    update: { text },
  });
  await audit({
    action: "normals.override",
    detail: `${study.label} · ${organ.label} · ${pathology.label} ${kind} wording customised`,
  });
  return Response.json({ override: row });
}

export async function DELETE(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const clinicId = await getActiveClinicId();
  const url = new URL(req.url);
  const studyKey = url.searchParams.get("studyKey") ?? "";
  const organKey = url.searchParams.get("organKey") ?? "";
  const pathologyKey = url.searchParams.get("pathologyKey") ?? "";
  const kind = url.searchParams.get("kind") === "advice" ? "advice" : "impression";

  const existing = await db.usgPathologyWordingOverride.findUnique({
    where: {
      clinicId_studyKey_organKey_pathologyKey_kind: {
        clinicId,
        studyKey,
        organKey,
        pathologyKey,
        kind,
      },
    },
  });
  if (existing) {
    await db.usgPathologyWordingOverride.delete({ where: { id: existing.id } });
    await audit({
      action: "normals.reset",
      detail: `${studyKey}:${organKey}:${pathologyKey} ${kind} wording reset`,
    });
  }
  return Response.json({ ok: true });
}
