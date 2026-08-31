import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { nextSortOrder } from "@/lib/compile";
import { sameSlot, normalizeLaterality, normalizeLevel } from "@/lib/slot";
import { recomputeReport } from "../route";

function render(text: string, vars: Record<string, string | null | undefined>): string {
  let out = text;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{${k}}`, String(v ?? "").trim());
  }
  out = out.replace(/\s+/g, " ").replace(/\s([.,])/g, "$1").trim();
  // Sentences start capitalized ("Left chronic infarct…", not "left…").
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/** POST add a finding row — slot replacement with explicit confirm. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if (guard) return guard;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const report = await db.report.findUnique({ where: { id }, include: { findingRows: true } });
  if (!report) return Response.json({ error: "Report not found" }, { status: 404 });
  if (report.status === "FINALIZED") return Response.json({ error: "Report is finalized" }, { status: 400 });

  const region = String(body.region ?? "Findings");
  const concept = String(body.concept ?? "note");
  const level = body.level ? normalizeLevel(String(body.level)) : null;
  const laterality = body.laterality ? normalizeLaterality(String(body.laterality)) : null;
  const severityRaw = body.severity ? String(body.severity) : null;
  const severity = severityRaw ? (/^[IVX]+$/i.test(severityRaw) ? severityRaw.toUpperCase() : severityRaw.toLowerCase()) : null;
  const text = render(String(body.text ?? ""), { level, laterality, severity });
  if (!text) return Response.json({ error: "Empty finding text" }, { status: 400 });

  const incoming = { region, concept, level, laterality };
  const existing = report.findingRows.find((r) => sameSlot(incoming, r));
  const confirmReplace = body.confirmReplace === true;

  if (existing && !confirmReplace && existing.concept !== "note") {
    return Response.json(
      { conflict: true, existingId: existing.id, existingText: existing.text },
      { status: 409 },
    );
  }

  if (existing && confirmReplace) {
    const updated = await db.findingRow.update({
      where: { id: existing.id },
      data: {
        text,
        severity,
        laterality,
        level,
        titleFragment: body.titleFragment ? String(body.titleFragment).trim() : null,
        // A replacement is impression-worthy by default (an abnormal finding
        // taking over a denial's slot must not inherit the denial's exclusion).
        inImpression: true,
        sortOrder: existing.sortOrder,
      },
    });
    await recomputeReport(id);
    return Response.json({ ok: true, replaced: true, row: updated });
  }

  const row = await db.findingRow.create({
    data: {
      reportId: id,
      region,
      concept,
      level,
      laterality,
      severity,
      text,
      titleFragment: body.titleFragment ? String(body.titleFragment).trim() : null,
      sortOrder: nextSortOrder(report.findingRows),
    },
  });
  await recomputeReport(id);
  return Response.json({ ok: true, row });
}
