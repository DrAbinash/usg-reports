/**
 * Saving a draft saves what the doctor selected.
 *
 * The composer PUTs its whole state on every Ctrl+S. The route normalised that
 * state, derived the findings/impression text from it, and stored the TEXT —
 * while `stateJson` kept whatever the row had when it was created. Finalize does
 * not print the text the save computed: it re-resolves the report from
 * `stateJson`, and the PDF, the share link and the reprint overlay all render
 * from that snapshot.
 *
 * So a draft started from a worklist order (all-normal), then given a chip,
 * signed this:
 *   on screen  — "Hepatomegaly with a well defined hypoechoic lesion … Liver
 *                abscess", the impression column agreed;
 *   on the paper — "No significant abnormality detected."
 * Measured in the running studio: a clicked `liver-abscess` chip reached the
 * impression column but not `stateJson`, and finalize answered 200 with an
 * all-normal page. The report PDF and the share page both render from that
 * frozen snapshot, so every report edited after its first save carried the
 * mismatch between what the studio displayed and what it signed.
 *
 * What these tests pin:
 *  - the saved state is the state that was sent, chips and typed text included;
 *  - what gets frozen at finalize is what the doctor was looking at;
 *  - removing a chip is remembered as well as adding one;
 *  - measurement variables survive the save (they live in the same column).
 */
import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireSession: async () => null,
  getActiveClinicId: async () => "default",
}));

import { POST as createReport } from "@/app/api/usg/reports/route";
import { PUT as saveDraft } from "@/app/api/usg/reports/[id]/route";
import { POST as finalize } from "@/app/api/usg/reports/[id]/finalize/route";
import { db } from "@/lib/db";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const json = (body: unknown) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

const BASE = {
  patientName: "Sample Patientone",
  patientAge: "34",
  patientSex: "M",
  referredBy: "Dr S M Roy",
  studyKey: "wa-male",
};

async function newDraft(state: unknown) {
  const res = await createReport(new NextRequest("http://localhost/api/usg/reports", json({ ...BASE, state })));
  const body = await res.json();
  return body.report.id as string;
}

async function save(id: string, state: unknown) {
  const res = await saveDraft(new NextRequest("http://localhost/api/usg/reports/x", json({ ...BASE, state })), ctx(id));
  return { status: res.status, body: await res.json() };
}

const read = (id: string) => db.usgReport.findUnique({ where: { id } });

async function sign(id: string) {
  const res = await finalize(new NextRequest(`http://localhost/api/usg/reports/${id}/finalize`, { method: "POST" }), ctx(id));
  return { status: res.status, body: await res.json() };
}

const NORMAL = { studyKey: "wa-male", organs: [] };
const ABSCESS = {
  studyKey: "wa-male",
  organs: [{ organ: "liver", pathology: "liver-abscess", pathologies: ["liver-abscess"], text: "" }],
};

describe("saving a draft keeps the selection, not only its text", () => {
  beforeEach(async () => {
    await db.usgReportVersion.deleteMany();
    await db.usgCriticalCommunication.deleteMany();
    await db.usgReportImage.deleteMany();
    await db.usgAudit.deleteMany();
    await db.usgCareOrder.deleteMany();
    await db.usgReport.deleteMany();
    await db.hospitalSettings.deleteMany();
  });

  it("stores the chips that were clicked after the first save", async () => {
    const id = await newDraft(NORMAL);
    const { status } = await save(id, ABSCESS);
    expect(status).toBe(200);

    const row = await read(id);
    expect(row?.stateJson).toContain("liver-abscess");
    expect(row?.impression).toMatch(/abscess/i); // the text and the state now agree
  });

  it("signs the page the doctor was looking at", async () => {
    const id = await newDraft(NORMAL);
    await save(id, ABSCESS);
    const signed = await sign(id);
    expect(signed.status).toBe(200);

    const frozen = String(signed.body.html ?? "");
    expect(frozen).toMatch(/abscess/i);
    expect(frozen).not.toMatch(/No significant abnormality detected/);
    expect(signed.body.report.impression).toMatch(/abscess/i);

    // and the stored snapshot is the same page, because the PDF and the share
    // link render from it rather than re-resolving anything
    const row = await read(id);
    expect(row?.reportHtml).toBe(frozen);
  });

  it("remembers a chip taken back off", async () => {
    const id = await newDraft(ABSCESS);
    await save(id, NORMAL);
    const row = await read(id);
    expect(row?.stateJson).not.toContain("liver-abscess");

    const signed = await sign(id);
    expect(String(signed.body.html)).toMatch(/No significant abnormality detected/);
  });

  it("keeps the words and measurements typed into an organ", async () => {
    const id = await newDraft(NORMAL);
    const withText = {
      studyKey: "wa-male",
      organs: [{ organ: "liver", pathology: null, pathologies: [], text: "Liver measures 16.5 cm.", vars: { span: "16.5" } }],
    };
    await save(id, withText);
    const row = await read(id);
    expect(row?.stateJson).toContain("Liver measures 16.5 cm.");
    expect(row?.stateJson).toContain("16.5");
  });

  it("leaves the stored state alone when a save carries none", async () => {
    // Demography-only edits (phone, referral, scan date) must not blank the
    // findings the doctor already saved.
    const id = await newDraft(ABSCESS);
    const res = await saveDraft(
      new NextRequest("http://localhost/api/usg/reports/x", json({ patientAge: "35", referredBy: "Dr R K Sinha" })),
      ctx(id),
    );
    expect(res.status).toBe(200);
    const row = await read(id);
    expect(row?.stateJson).toContain("liver-abscess");
    expect(row?.patientAge).toBe("35");
  });

  it("the route writes the state column, and cannot quietly stop", () => {
    const src = readFileSync("src/app/api/usg/reports/[id]/route.ts", "utf8");
    expect(src).toMatch(/data\.stateJson = stateJson;/);
  });
});
