/**
 * What one row of the register costs.
 *
 * `GET /api/usg/reports` is called on every mount of the studio, and the search
 * box calls it on every settled keystroke. It used to answer `SELECT *`, and
 * `UsgReport` carries `reportHtml` — the printed page, with the machine stills
 * embedded in it as base64 — plus `printSettingsJson`, the layout it was
 * printed with. Opening the register therefore transferred a large part of the
 * archive to draw a table of names, and one finalized report alone is bigger
 * than the whole list should be.
 *
 * The detail route (`/reports/[id]`) still returns the snapshot; printing a
 * signed report reads it from there.
 */
import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireSession: async () => null,
  getActiveClinicId: async () => "default",
}));

import { GET } from "@/app/api/usg/reports/route";
import { db } from "@/lib/db";

/** A frozen page the size of a report with a couple of stills on it. */
const FROZEN_HTML = `<html><body><img src="data:image/png;base64,${"A".repeat(200_000)}"/></body></html>`;

const ROUTE_SOURCE = readFileSync("src/app/api/usg/reports/route.ts", "utf8");

function listedColumns(): string[] {
  const block = /const LIST_COLUMNS = \[([\s\S]*?)\];/.exec(ROUTE_SOURCE)?.[1] ?? "";
  return [...block.matchAll(/"([A-Za-z_][A-Za-z0-9_]*)"/g)].map((m) => m[1]!);
}

/** Scalar fields of `model UsgReport`, read from the schema rather than copied. */
function schemaColumns(): string[] {
  const model = /model UsgReport \{([\s\S]*?)\n\}/.exec(readFileSync("prisma/schema.prisma", "utf8"))?.[1] ?? "";
  return model
    .split("\n")
    .map((l) => l.replace(/\/\*[\s\S]*?\*\//g, "").trim())
    .filter((l) => l && !l.startsWith("//") && !l.startsWith("@@") && !l.startsWith("/*"))
    .map((l) => /^([A-Za-z_][A-Za-z0-9_]*)\s+(String|Int|BigInt|Float|Boolean|DateTime|Bytes|Json)(\[\])?[?!]?(?:\s|$)/.exec(l))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => m[1]!);
}

async function seedReport(serial: number) {
  return db.usgReport.create({
    data: {
      clinicId: "default",
      patientName: `Sample Patientone ${serial}`,
      patientSex: "F",
      studyKey: "wa-female",
      studyTitle: "USG WHOLE ABDOMEN",
      stateJson: JSON.stringify({ studyKey: "wa-female", organs: [] }),
      status: "FINALIZED",
      reportHtml: FROZEN_HTML,
      printSettingsJson: JSON.stringify({ paperSize: "A4" }),
      serialNo: serial,
    },
  });
}

async function list(url: string): Promise<Record<string, unknown>[]> {
  const res = await GET(new NextRequest(`http://localhost${url}`));
  expect(res.status).toBe(200);
  const body = (await res.json()) as { reports?: Record<string, unknown>[] };
  return body.reports ?? [];
}

describe("the register list payload", () => {
  beforeEach(async () => {
    await db.usgCriticalCommunication.deleteMany();
    await db.usgReportImage.deleteMany();
    await db.usgReport.deleteMany();
  });

  it("carries no frozen printed page — plain listing", async () => {
    await seedReport(9001);
    const rows = await list("/api/usg/reports");
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty("reportHtml");
    expect(rows[0]).not.toHaveProperty("printSettingsJson");
  });

  it("carries none from the search branch either", async () => {
    await seedReport(9002);
    const rows = await list("/api/usg/reports?q=Patientone");
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty("reportHtml");
    expect(rows[0]).not.toHaveProperty("printSettingsJson");
    // The listing still says who and what and when, which is all a row shows.
    expect(rows[0]!.patientName).toBe("Sample Patientone 9002");
    expect(rows[0]!.status).toBe("FINALIZED");
    expect(rows[0]!.serialNo).toBe(9002);
  });

  it("keeps stateJson, which the composer's prior-study comparison reads here", async () => {
    await seedReport(9003);
    const rows = await list("/api/usg/reports?status=FINALIZED");
    expect(typeof rows[0]!.stateJson).toBe("string");
    // The search branch is raw SQL with an explicit column list, and the
    // comparison queries go through it, so check the same fact there.
    const searched = await list("/api/usg/reports?q=9003&status=FINALIZED");
    expect(typeof searched[0]!.stateJson).toBe("string");
  });

  it("sends less than one tenth of the row it is describing", async () => {
    await seedReport(9004);
    const res = await GET(new NextRequest("http://localhost/api/usg/reports"));
    const text = await res.text();
    const stored = await db.usgReport.findFirstOrThrow({ where: { serialNo: 9004 } });
    const storedBytes = (stored.reportHtml ?? "").length + (stored.stateJson ?? "").length;
    expect(storedBytes).toBeGreaterThan(200_000);
    expect(text.length).toBeLessThan(storedBytes / 10);
  });

  it("names every column the model has, except the two a list never shows", () => {
    const fields = schemaColumns();
    expect(fields.length).toBeGreaterThanOrEqual(20); // a parse that found nothing would pass vacuously
    expect(fields).toContain("reportHtml");
    const listed = listedColumns();
    const excluded = ["reportHtml", "printSettingsJson"];
    for (const field of fields) {
      if (excluded.includes(field)) continue;
      expect(listed, `column ${field} is missing from LIST_COLUMNS`).toContain(field);
    }
    for (const name of listed) expect(fields, `LIST_COLUMNS names ${name}, which the model has no such column`).toContain(name);
    for (const name of excluded) expect(listed, `${name} must stay out of the listing`).not.toContain(name);
  });

  it("still omits them when the listing goes through Prisma, not raw SQL", () => {
    const omit = /const LIST_OMIT = \{([^}]*)\}/.exec(ROUTE_SOURCE)?.[1] ?? "";
    expect(omit).toContain("reportHtml: true");
    expect(omit).toContain("printSettingsJson: true");
    const findMany = /db\.usgReport\.findMany\(\{[\s\S]*?\}\);/.exec(ROUTE_SOURCE)?.[0] ?? "";
    expect(findMany).toMatch(/omit:\s*\{\s*\.\.\.LIST_OMIT\s*\}/);
  });

  it("and opening the register never reads the stills either", () => {
    // The detail route used to include the images for every request it served,
    // so each autosave — one per keystroke pause — pulled every base64 still of
    // the report out of SQLite to compute a phone number it then wrote back.
    const detail = readFileSync("src/app/api/usg/reports/[id]/route.ts", "utf8");
    expect(detail).toMatch(/getReportForActiveClinic\(id, \{ withImages: true \}\)/);
    expect(detail.split("withImages: true").length - 1).toBe(1);
    expect(detail).toMatch(/\.\.\.\(opts\?\.withImages \?\s*\{ images:/);
  });
});
