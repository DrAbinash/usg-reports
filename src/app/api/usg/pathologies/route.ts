import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/usg/audit";
import { loadAllPathologies } from "@/lib/usg/server";
import { USG_PATHOLOGIES } from "@/lib/usg/pathologies";

export async function GET() {
  const guard = await requireSession();
  if (guard) return guard;
  return Response.json({ pathologies: await loadAllPathologies() });
}

export async function POST(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const body = await req.json().catch(() => ({}));
  const organKey = String(body.organKey ?? "").trim();
  const label = String(body.label ?? "").trim();
  const findingText = String(body.findingText ?? "").trim();
  const impressionLines = Array.isArray(body.impressionLines)
    ? body.impressionLines.filter((l: unknown): l is string => typeof l === "string" && !!l.trim()).map((l: string) => l.trim())
    : [];
  const titleFragment = String(body.titleFragment ?? "").trim();
  const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 100;

  const validOrgans = new Set<string>();
  for (const study of (await import("@/lib/usg/studies")).USG_STUDIES) {
    study.organs.forEach((o) => {
      validOrgans.add(o.key);
      if (o.key === "kidney_rt" || o.key === "kidney_lt") validOrgans.add("kidney");
    });
  }
  if (!organKey || !validOrgans.has(organKey)) {
    return Response.json({ error: "Invalid organ" }, { status: 400 });
  }
  if (!label || !findingText) {
    return Response.json({ error: "Label and finding text are required" }, { status: 400 });
  }

  // Duplicate guard against builtins with the same label on the same organ.
  const organForCheck = organKey === "kidney" ? organKey : organKey;
  if (USG_PATHOLOGIES.some((p) => p.organ === organForCheck && p.label.toLowerCase() === label.toLowerCase())) {
    return Response.json({ error: "A builtin pathology with this label already exists" }, { status: 409 });
  }

  const existing = await db.usgPathology.findFirst({
    where: { organKey, label },
  });
  if (existing) {
    return Response.json({ error: "A custom pathology with this label already exists" }, { status: 409 });
  }

  const row = await db.usgPathology.create({
    data: {
      organKey,
      label,
      findingText,
      impressionLinesJson: JSON.stringify(impressionLines),
      titleFragment,
      sortOrder,
    },
  });
  await audit({ action: "pathology.add", detail: `custom finding added: ${row.label}` });
  return Response.json({
    pathology: {
      key: "custom:" + row.id,
      organ: row.organKey,
      label: row.label,
      text: row.findingText,
      impression: impressionLines,
      titleFragment: titleFragment || undefined,
      builtin: false,
    },
  });
}
