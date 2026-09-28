import { requireSession, getActiveClinicId } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/usg/audit";
import { loadAllPathologies } from "@/lib/usg/server";
import { USG_PATHOLOGIES } from "@/lib/usg/pathologies";
import {
  isSnippetOrgan,
  SNIPPET_ORGAN_ADVICE,
  SNIPPET_ORGAN_IMPRESSION,
} from "@/lib/usg/addendum";

export async function GET() {
  const guard = await requireSession();
  if (guard) return guard;
  return Response.json({ pathologies: await loadAllPathologies() });
}

export async function POST(req: Request) {
  const guard = await requireSession();
  if (guard) return guard;
  const clinicId = await getActiveClinicId();
  const body = await req.json().catch(() => ({}));
  const organKey = String(body.organKey ?? "").trim();
  const label = String(body.label ?? "").trim();
  const findingText = String(body.findingText ?? "").trim();
  const impressionLines = Array.isArray(body.impressionLines)
    ? body.impressionLines.filter((l: unknown): l is string => typeof l === "string" && !!l.trim()).map((l: string) => l.trim())
    : [];
  const adviceLines = Array.isArray(body.adviceLines)
    ? body.adviceLines.filter((l: unknown): l is string => typeof l === "string" && !!l.trim()).map((l: string) => l.trim())
    : [];
  const titleFragment = String(body.titleFragment ?? "").trim();
  const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 100;

  const validOrgans = new Set<string>([SNIPPET_ORGAN_IMPRESSION, SNIPPET_ORGAN_ADVICE]);
  for (const study of (await import("@/lib/usg/studies")).USG_STUDIES) {
    study.organs.forEach((o) => {
      validOrgans.add(o.key);
      if (o.key === "kidney_rt" || o.key === "kidney_lt") validOrgans.add("kidney");
    });
  }
  if (!organKey || !validOrgans.has(organKey)) {
    return Response.json({ error: "Invalid organ" }, { status: 400 });
  }

  // Clinic impression/advice snippets: finding text may mirror the line.
  const isSnippet = isSnippetOrgan(organKey);
  if (!label) {
    return Response.json({ error: "Label is required" }, { status: 400 });
  }
  if (!isSnippet && !findingText) {
    return Response.json({ error: "Label and finding text are required" }, { status: 400 });
  }
  if (isSnippet && organKey === SNIPPET_ORGAN_IMPRESSION && !impressionLines.length && !findingText) {
    return Response.json({ error: "Impression text is required" }, { status: 400 });
  }
  if (isSnippet && organKey === SNIPPET_ORGAN_ADVICE && !adviceLines.length && !findingText) {
    return Response.json({ error: "Advice text is required" }, { status: 400 });
  }

  const resolvedFinding =
    findingText ||
    (organKey === SNIPPET_ORGAN_IMPRESSION
      ? impressionLines[0] ?? label
      : organKey === SNIPPET_ORGAN_ADVICE
        ? adviceLines[0] ?? label
        : "");
  const resolvedImpression =
    impressionLines.length > 0
      ? impressionLines
      : organKey === SNIPPET_ORGAN_IMPRESSION && resolvedFinding
        ? [resolvedFinding]
        : [];
  const resolvedAdvice =
    adviceLines.length > 0
      ? adviceLines
      : organKey === SNIPPET_ORGAN_ADVICE && resolvedFinding
        ? [resolvedFinding]
        : [];

  // Duplicate guard against builtins with the same label on the same organ.
  if (!isSnippet && USG_PATHOLOGIES.some((p) => p.organ === organKey && p.label.toLowerCase() === label.toLowerCase())) {
    return Response.json({ error: "A builtin pathology with this label already exists" }, { status: 409 });
  }

  const existing = await db.usgPathology.findFirst({
    where: { clinicId, organKey, label },
  });
  if (existing) {
    return Response.json({ error: "A custom pathology with this label already exists" }, { status: 409 });
  }

  const row = await db.usgPathology.create({
    data: {
      clinicId,
      organKey,
      label,
      findingText: resolvedFinding,
      impressionLinesJson: JSON.stringify(resolvedImpression),
      adviceLinesJson: JSON.stringify(resolvedAdvice),
      titleFragment,
      sortOrder,
    },
  });
  await audit({
    action: isSnippet ? "snippet.add" : "pathology.add",
    detail: `custom ${isSnippet ? organKey.slice(1) : "finding"} added: ${row.label}`,
  });
  return Response.json({
    pathology: {
      key: "custom:" + row.id,
      organ: row.organKey,
      label: row.label,
      text: row.findingText,
      impression: resolvedImpression,
      advice: resolvedAdvice,
      titleFragment: titleFragment || undefined,
      builtin: false,
    },
  });
}
