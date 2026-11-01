/**
 * A critical finding cannot be signed without the call being recorded.
 *
 * PCPNDT/NMC and ACR guidance is that the referring clinician is told about a
 * critical result and that the notification is documented. The studio already
 * had the log (the red banner's "Log call" button), and nothing ever checked it: a
 * report with ectopic pregnancy or acute appendicitis on it could be finalized,
 * printed, shared and closed without a single record that anyone was phoned —
 * which is the sentence the clinic would need in court, and the one nobody
 * wrote down.
 *
 * What these tests pin:
 *  - a `critical` finding with no logged call is refused, loudly, with the
 *    finding named and the report left as a draft;
 *  - one logged call releases it, and the register number is unaffected;
 *  - `urgent` / `significant` findings are never held up (a gate that cries
 *    wolf is worked around, not respected);
 *  - a clinic that switched the communication log off is not gated;
 *  - a refusal spends nothing: the draft is left without a register number, so
 *    the next signed report still gets the next one;
 *  - the composer opens the log form on that refusal instead of showing a
 *    dead-end error, and it forwards the server's sentence rather than
 *    replacing it with "Finalize failed".
 */
import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireSession: async () => null,
  getActiveClinicId: async () => "default",
}));

import { POST as finalize } from "@/app/api/usg/reports/[id]/finalize/route";
import { POST as logCall } from "@/app/api/usg/reports/[id]/critical-comm/route";
import { db } from "@/lib/db";
import { updateSettings } from "@/lib/settings";
import { needsCommunication, scanForCriticalFindings } from "@/lib/usg/criticalFindings";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function draftWith(organ: string, pathologyKey: string) {
  return db.usgReport.create({
    data: {
      clinicId: "default",
      patientName: "Sample Patientone",
      patientSex: "F",
      studyKey: "wa-male",
      stateJson: JSON.stringify({
        studyKey: "wa-male",
        organs: [{ organ, pathology: pathologyKey, pathologies: [pathologyKey], text: "" }],
      }),
    },
  });
}

const call = {
  findingText: "Acute appendicitis — surgical emergency",
  communicatedTo: "Dr S M Roy",
  communicatedAt: new Date().toISOString(),
  method: "phone",
};

async function finalizeOf(id: string) {
  const res = await finalize(new NextRequest(`http://localhost/api/usg/reports/${id}/finalize`, { method: "POST" }), ctx(id));
  return { status: res.status, body: await res.json() };
}

describe("the critical-finding signing gate", () => {
  beforeEach(async () => {
    await db.usgCriticalCommunication.deleteMany();
    await db.usgAudit.deleteMany();
    await db.usgReportImage.deleteMany();
    await db.usgReport.deleteMany();
    await db.hospitalSettings.deleteMany();
  });

  it("holds a critical report until the call is in the log", async () => {
    const report = await draftWith("rif", "rif-appendicitis");
    const { status, body } = await finalizeOf(report.id);

    expect(status).toBe(409);
    expect(body.code).toBe("critical_comm_required");
    expect(body.error).toMatch(/Acute Appendicitis/);
    expect(body.error).toMatch(/Log the call/);
    expect(body.findings.map((f: { key: string }) => f.key)).toContain("rif-appendicitis");

    const after = await db.usgReport.findUnique({ where: { id: report.id } });
    expect(after?.status).toBe("DRAFT");
    expect(after?.serialNo).toBeNull(); // held, not renumbered later

    const blocked = await db.usgAudit.findFirst({ where: { action: "report.finalizeBlocked", reportId: report.id } });
    expect(blocked?.detail).toMatch(/Acute Appendicitis/);
  });

  it("signs the same report once the call is recorded, on the same register number", async () => {
    const report = await draftWith("rif", "rif-appendicitis");
    expect((await finalizeOf(report.id)).status).toBe(409);

    const logged = await logCall(
      new NextRequest(`http://localhost/api/usg/reports/${report.id}/critical-comm`, {
        method: "POST",
        body: JSON.stringify(call),
        headers: { "content-type": "application/json" },
      }),
      ctx(report.id),
    );
    expect(logged.status).toBe(200);

    const second = await finalizeOf(report.id);
    expect(second.status).toBe(200);
    expect(second.body.report.status).toBe("FINALIZED");
    expect(typeof second.body.serialNo).toBe("number");
    expect(second.body.report.serialNo).toBe(second.body.serialNo);
  });

  it("spends no register number on a signature that never happened", async () => {
    // `serialNo` is what the toolbar, the PDF filename, the PACS return and a
    // duplicate read as "this one was signed". The allocation transaction only
    // reads MAX(serialNo), so a refusal writes nothing today; the gate is also
    // ordered ahead of it, which the next test pins, so a number cannot end up
    // on an unsigned report even if the allocation ever stops being read-only.
    const held = await draftWith("rif", "rif-appendicitis");
    expect((await finalizeOf(held.id)).status).toBe(409);

    const next = await draftWith("liver", "liver-abscess"); // urgent — signs
    const { status, body } = await finalizeOf(next.id);
    expect(status).toBe(200);
    expect(body.serialNo).toBe(1); // the refusal took nothing off the register

    const after = await db.usgReport.findUnique({ where: { id: held.id } });
    expect(after?.status).toBe("DRAFT");
    expect(after?.serialNo).toBeNull();
  });

  it("the critical gate runs before the register number is taken", () => {
    const src = readFileSync("src/app/api/usg/reports/[id]/finalize/route.ts", "utf8");
    const gate = src.indexOf("if (criticalAlerts.length && settings.enableCriticalComm");
    const allocate = src.indexOf("let serialNo = report.serialNo;");
    const stamp = src.indexOf("status: \"FINALIZED\"");
    expect(gate).toBeGreaterThan(-1);
    expect(allocate).toBeGreaterThan(gate);
    expect(stamp).toBeGreaterThan(allocate);
  });

  it("does not hold an urgent finding — only the ones that can kill within hours", async () => {
    const report = await draftWith("liver", "liver-abscess"); // severity: urgent
    const { status, body } = await finalizeOf(report.id);
    expect(status).toBe(200);
    expect(body.code).toBeUndefined();
    expect(body.report.status).toBe("FINALIZED");
  });

  it("does not gate a clinic that switched the communication log off", async () => {
    await updateSettings({ enableCriticalComm: false });
    const report = await draftWith("rif", "rif-appendicitis");
    expect((await finalizeOf(report.id)).status).toBe(200);
  });

  it("refuses on the findings the registry calls critical, and only those", () => {
    const alerts = scanForCriticalFindings([
      { key: "rif-appendicitis", label: "Acute Appendicitis", organ: "rif" },
      { key: "liver-abscess", label: "Liver Abscess", organ: "liver" },
      { key: "liver-fatty-g1", label: "Fatty Gr I", organ: "liver" },
    ]);
    expect(needsCommunication(alerts).map((a) => a.pathologyKey)).toEqual(["rif-appendicitis"]);
  });

  it("the composer answers the refusal by opening the log, not by dead-ending", () => {
    const src = readFileSync("src/components/studio/usg/composer/PreviewZone.tsx", "utf8");
    expect(src).toMatch(/body\.code === "critical_comm_required"/);
    expect(src).toMatch(/deps\.setCommOpen\(true\)/);
    // The draft survives the refusal: it is returned as saved, and the report is
    // not marked finalized.
    expect(src).toMatch(/This draft is saved\. Finalize again once the call is logged\./);
    // and a refusal of any other kind keeps the server's own sentence.
    expect(src).toMatch(/throw new Error\(body\.error \?\? `Finalize failed \(\$\{res\.status\}\)`\)/);
    expect(src).not.toMatch(/if \(!res\.ok\) throw new Error\("Finalize failed"\);/);
  });

  it("the refusal never carries a patient name", async () => {
    // It is pasted into a bug report and shown on the screen the whole clinic
    // can see; the finding is enough to act on.
    const report = await draftWith("rif", "rif-appendicitis");
    const { body } = await finalizeOf(report.id);
    const text = JSON.stringify(body);
    expect(body.code).toBe("critical_comm_required");
    expect(text).not.toContain("Sample Patientone");
  });
});
