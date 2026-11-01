/**
 * Amending a signed report keeps the text it replaces.
 *
 * Re-signing used to overwrite `reportHtml`, `findings` and `impression` in
 * place. The register number stayed (correctly — that is the whole point of a
 * register), but the words did not: the earlier signed page survived only in
 * whoever's file a printout had been put, and the record on screen looked as if
 * it had always said the new thing. For a report the referral doctor may have
 * already acted on, that is the property that matters.
 *
 * So the superseded text is written to `UsgReportVersion` in the same
 * transaction as its replacement, and the finalized view can open it.
 *
 * What these tests pin:
 *  - the first signature creates no version; the second keeps the first;
 *  - the version that is kept is the text that was signed, with its date, and
 *    the register number does not move;
 *  - it is caught on the path the studio really uses — Reopen, edit, sign again
 *    — where the status says DRAFT and only the saved page proves it was signed;
 *  - the list says what exists without shipping every printed page;
 *  - a page is retrievable by version number, and a number that does not exist
 *    is refused rather than answered with the current one;
 *  - deleting the report takes its history with it.
 */
import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireSession: async () => null,
  getActiveClinicId: async () => "default",
}));

import { POST as finalize } from "@/app/api/usg/reports/[id]/finalize/route";
import { POST as reopen } from "@/app/api/usg/reports/[id]/reopen/route";
import { PUT as saveDraft } from "@/app/api/usg/reports/[id]/route";
import { GET as versions } from "@/app/api/usg/reports/[id]/versions/route";
import { db } from "@/lib/db";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const call = async (fn: Function, id: string, path: string, init: { method?: string; headers?: Record<string, string>; body?: string } = { method: "POST" }) => {
  const res = await fn(new NextRequest(`http://localhost${path}`, init), ctx(id));
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

/** The edit path the composer really takes: reopen, then save the draft. */
const editDraft = (id: string, state: unknown) =>
  call(saveDraft, id, `/api/usg/reports/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      patientName: "Sample Patientone",
      patientAge: "34",
      patientSex: "M",
      referredBy: "Dr S M Roy",
      studyKey: "wa-male",
      state,
    }),
  });

async function draft(state: unknown) {
  return db.usgReport.create({
    data: {
      clinicId: "default",
      patientName: "Sample Patientone",
      patientSex: "M",
      studyKey: "wa-male",
      stateJson: JSON.stringify(state),
    },
  });
}

const NORMAL = { studyKey: "wa-male", organs: [] };
// An urgent (not critical) finding: the second signature must get through the
// critical-finding gate to reach the amendment path under test. Using
// rif-appendicitis here answers 409 "log the call" instead, which is the other
// feature working.
const WITH_FINDING = {
  studyKey: "wa-male",
  organs: [{ organ: "liver", pathology: "liver-abscess", pathologies: ["liver-abscess"], text: "" }],
};

describe("the amendment history of a signed report", () => {
  beforeEach(async () => {
    await db.usgReportVersion.deleteMany();
    await db.usgCriticalCommunication.deleteMany();
    await db.usgReportImage.deleteMany();
    await db.usgAudit.deleteMany();
    await db.usgCareOrder.deleteMany();
    await db.usgReport.deleteMany();
    await db.hospitalSettings.deleteMany();
  });

  it("creates no version for the first signature", async () => {
    const report = await draft(NORMAL);
    const first = await call(finalize, report.id, `/api/usg/reports/${report.id}/finalize`);
    expect(first.status).toBe(200);
    expect(first.body.amendedFrom).toBeNull();
    expect(await db.usgReportVersion.count({ where: { reportId: report.id } })).toBe(0);
  });

  it("keeps the signed text when the report is reopened, edited and signed again", async () => {
    const report = await draft(NORMAL);
    const first = await call(finalize, report.id, `/api/usg/reports/${report.id}/finalize`);
    const firstImpression = (await db.usgReport.findUnique({ where: { id: report.id } }))?.impression;
    const firstPage = first.body.html as string;

    const back = await call(reopen, report.id, `/api/usg/reports/${report.id}/reopen`);
    expect(back.status).toBe(200);
    // The status says draft again and the finalized timestamp is cleared — this is
    // exactly the case a `status === FINALIZED` test would have missed.
    const reopened = await db.usgReport.findUnique({ where: { id: report.id } });
    expect(reopened?.status).toBe("DRAFT");
    expect(reopened?.finalizedAt).toBeNull();
    expect(reopened?.reportHtml).not.toBeNull();

    const edited = await editDraft(report.id, WITH_FINDING);
    expect(edited.status).toBe(200);
    // The columns now hold the NEW words while the signed page is still the old
    // one. This is the trap the browser run fell into: keeping the columns as the
    // superseded version files the new text as the old, and the words that were
    // actually signed survive nowhere.
    expect(edited.body.report.impression).not.toBe(firstImpression);

    const second = await call(finalize, report.id, `/api/usg/reports/${report.id}/finalize`);
    expect(second.status).toBe(200);

    const kept = await db.usgReportVersion.findMany({ where: { reportId: report.id }, orderBy: { versionNo: "asc" } });
    expect(kept.length).toBe(1);
    expect(kept[0].versionNo).toBe(1);
    expect(kept[0].impression).toBe(firstImpression);
    expect(kept[0].impression).not.toBe(edited.body.report.impression);
    expect(kept[0].reportHtml).toBe(firstPage); // the page as printed then, not a re-render
    expect(kept[0].serialNo).toBe(first.body.serialNo);
    expect(kept[0].signedAt).not.toBeNull(); // taken from lastSignedAt, which reopen leaves alone

    // the register number never moved
    const now = await db.usgReport.findUnique({ where: { id: report.id } });
    expect(now?.serialNo).toBe(first.body.serialNo);
    expect(second.body.amendedFrom).toMatchObject({ versionNo: 1 });

    const audit = await db.usgAudit.findFirst({ where: { action: "report.amended", reportId: report.id } });
    expect(audit?.detail).toMatch(/version 1 of the earlier text kept/);
    expect(now?.impression).not.toBe(kept[0].impression); // the page on screen is the new one

    // The mirror moves with the new signature, so a third amendment keeps THIS
    // text rather than the one before it.
    expect(now?.signedImpression).toBe(now?.impression);
    expect(now?.signedFindings).toBe(now?.findings);
    expect(now?.lastSignedAt).not.toBeNull();
  });

  it("numbers each superseded text, newest holding the previous page", async () => {
    const report = await draft(NORMAL);
    await call(finalize, report.id, `/api/usg/reports/${report.id}/finalize`);
    await call(reopen, report.id, `/api/usg/reports/${report.id}/reopen`);
    await editDraft(report.id, WITH_FINDING);
    const second = await call(finalize, report.id, `/api/usg/reports/${report.id}/finalize`);
    await call(reopen, report.id, `/api/usg/reports/${report.id}/reopen`);
    await editDraft(report.id, { studyKey: "wa-male", organs: [{ organ: "liver", pathology: "liver-fatty-g2", pathologies: ["liver-fatty-g2"], text: "" }] });
    const third = await call(finalize, report.id, `/api/usg/reports/${report.id}/finalize`);

    expect(second.body.amendedFrom?.versionNo).toBe(1);
    expect(third.body.amendedFrom?.versionNo).toBe(2);
    const list = await call(
      versions, report.id, `/api/usg/reports/${report.id}/versions`, { method: "GET" },
    );
    expect(list.body.versions.map((v: { versionNo: number }) => v.versionNo)).toEqual([2, 1]);
    // v2 is the text signed second, v1 the text signed first — three different
    // words, three separate records, none of them the live draft.
    const live = await db.usgReport.findUnique({ where: { id: report.id } });
    const texts = [list.body.versions[0].impression, list.body.versions[1].impression, live?.impression];
    expect(new Set(texts).size).toBe(3);
  });

  it("lists what exists without shipping every printed page", async () => {
    const report = await draft(NORMAL);
    await call(finalize, report.id, `/api/usg/reports/${report.id}/finalize`);
    await call(reopen, report.id, `/api/usg/reports/${report.id}/reopen`);
    await editDraft(report.id, WITH_FINDING);
    await call(finalize, report.id, `/api/usg/reports/${report.id}/finalize`);

    const list = await call(versions, report.id, `/api/usg/reports/${report.id}/versions`, { method: "GET" });
    const row = list.body.versions[0];
    expect(row.hasPage).toBe(true);
    expect(row.reportHtml).toBeUndefined(); // the stills are inside it — hundreds of KB
    expect(typeof row.impression).toBe("string");
    expect(JSON.stringify(list.body).length).toBeLessThan(4000);
  });

  it("brings back the page of one version, and refuses a number it does not have", async () => {
    const report = await draft(NORMAL);
    const first = await call(finalize, report.id, `/api/usg/reports/${report.id}/finalize`);
    await call(reopen, report.id, `/api/usg/reports/${report.id}/reopen`);
    await editDraft(report.id, WITH_FINDING);
    const second = await call(finalize, report.id, `/api/usg/reports/${report.id}/finalize`);

    const page = await call(versions, report.id, `/api/usg/reports/${report.id}/versions?version=1&html=1`, { method: "GET" });
    expect(page.status).toBe(200);
    expect(page.body.version.reportHtml).toBe(first.body.html);
    expect(page.body.version.reportHtml).not.toBe(second.body.html);

    const meta = await call(versions, report.id, `/api/usg/reports/${report.id}/versions?version=1`, { method: "GET" });
    expect(meta.status).toBe(200);
    expect(meta.body.version.reportHtml).toBeNull();
    expect(meta.body.version.htmlBytes).toBeGreaterThan(1000);

    expect((await call(versions, report.id, `/api/usg/reports/${report.id}/versions?version=9`, { method: "GET" })).status).toBe(404);
    expect((await call(versions, report.id, `/api/usg/reports/${report.id}/versions?version=0`, { method: "GET" })).status).toBe(400);
  });

  it("takes the history with the report when the report goes", async () => {
    const report = await draft(NORMAL);
    await call(finalize, report.id, `/api/usg/reports/${report.id}/finalize`);
    await call(reopen, report.id, `/api/usg/reports/${report.id}/reopen`);
    await editDraft(report.id, WITH_FINDING);
    await call(finalize, report.id, `/api/usg/reports/${report.id}/finalize`);
    expect(await db.usgReportVersion.count({ where: { reportId: report.id } })).toBe(1);

    await db.usgReport.delete({ where: { id: report.id } });
    expect(await db.usgReportVersion.count()).toBe(0);
  });

  it("the composer says it amended, not that it saved again", () => {
    const src = readFileSync("src/components/studio/usg/composer/PreviewZone.tsx", "utf8");
    // The condition, not just the field name: the field is also read inside the
    // branch, so matching the word alone stays green when the test is dead.
    expect(src).toMatch(/if \(body\.amendedFrom\) \{/);
    expect(src).toMatch(/Report amended — the text signed on \$\{when\} is kept as version/);
    expect(src).toMatch(/Register no\. \$\{formatUsgSerial\(body\.serialNo \?\? 0\)\} unchanged/);
  });

  it("the finalized view can open the version it is standing on", () => {
    const src = readFileSync("src/components/studio/usg/UsgStudioView.tsx", "utf8");
    expect(src).toMatch(/\/versions\`\)/);
    expect(src).toMatch(/\/versions\?version=\$\{versionNo\}&html=1/);
    expect(src).toMatch(/versions\.map\(\(v\) => \(/); // the chips are rendered, not just fetched
    expect(src).toMatch(/onClick=\{\(\) => void openVersion\(v\.versionNo\)\}/);
    expect(src).toMatch(/srcDoc=\{shown\?\.html \?\? html\}/);
    expect(src).toMatch(/Back to the current page/);
    expect(src).toMatch(/amended —/);
  });

  it("reopen still leaves the page for the amendment to find", () => {
    const src = readFileSync("src/app/api/usg/reports/[id]/reopen/route.ts", "utf8");
    expect(src).toMatch(/status: "DRAFT"/);
    expect(src).not.toMatch(/reportHtml: null/);
    expect(src).not.toMatch(/lastSignedAt: null/);
  });
});
