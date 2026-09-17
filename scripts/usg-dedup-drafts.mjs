import fs from "node:fs";
process.env.DATABASE_URL = "file:/app/data/db/studio.db";
const { PrismaClient } = await import("@prisma/client");
const p = new PrismaClient();
const apply = process.env.APPLY === "1";
const drafts = await p.usgReport.findMany({ where: { status: "DRAFT" }, include: { images: true }, orderBy: { updatedAt: "desc" } });
const groups = new Map();
for (const d of drafts) {
  const k = `${d.patientName.trim().toLowerCase()}|${d.studyKey}|${d.scanDate ?? ""}`;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(d);
}
const toDelete = [];
for (const [, rows] of groups) {
  if (rows.length < 2) continue;
  const keep = rows[0];
  for (const r of rows.slice(1)) {
    const identical = r.stateJson === keep.stateJson && r.impression === keep.impression;
    const noImages = (r.images ?? []).length === 0;
    if (identical && noImages) toDelete.push(r);
  }
}
console.log("true duplicate drafts found:", toDelete.length);
for (const r of toDelete) console.log("  -", r.patientName, "|", r.studyKey, "|", r.scanDate ?? "-", "|", r.id);
if (apply && toDelete.length) {
  for (const r of toDelete) {
    await p.usgCareOrder.updateMany({ where: { reportId: r.id }, data: { reportId: null } });
    await p.usgReport.delete({ where: { id: r.id } });
  }
  console.log("DELETED:", toDelete.length);
} else {
  console.log("DRY RUN — nothing deleted. Re-run with APPLY=1 to remove them.");
}
await p.$disconnect();
