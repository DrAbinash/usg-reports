import fs from "node:fs";
const dir = "/app/data/db";
const f = fs.readdirSync(dir).find((n) => n.endsWith(".db"));
process.env.DATABASE_URL = `file:${dir}/${f}`;
const { PrismaClient } = await import("@prisma/client");
const p = new PrismaClient();
const sane = (s) => { const n = Number(String(s ?? "").replace(/[^0-9]/g, "")); return Number.isFinite(n) && n > 0 && n <= 110; };
let o = 0, r = 0;
for (const x of await p.usgCareOrder.findMany({ where: { status: { in: ["PENDING", "REPORTING"] } } })) {
  if (!sane(x.patientAge)) { await p.usgCareOrder.update({ where: { id: x.id }, data: { patientAge: "" } }); o++; }
}
for (const x of await p.usgReport.findMany({ where: { status: "DRAFT" } })) {
  if (!sane(x.patientAge)) { await p.usgReport.update({ where: { id: x.id }, data: { patientAge: "" } }); r++; }
}
console.log("cleaned orders:", o, "drafts:", r);
await p.$disconnect();
