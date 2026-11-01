/**
 * What a rejected write actually says.
 *
 * Production ran for four days with a generated Prisma client that lagged its
 * own schema. Every order insert failed with "Unknown argument `testCode`",
 * every other read worked, and the studio's log said `create failed ()` —
 * because the diagnostic read the FIRST line of a message that always starts
 * with a blank line.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { prismaErrorSummary } from "@/lib/usg/careSync";
import { errorReason } from "@/lib/usg/runWorklistSync";

/** Verbatim shape of the Prisma validation error captured on the NAS. */
const UNKNOWN_ARGUMENT = [
  "",
  "Invalid `prisma.usgCareOrder.create()` invocation:",
  "",
  "{",
  "  data: {",
  '    patientName: "TWIN PATIENTNINE",',
  '    testName: "(unnamed study)",',
  "    ~~~~~~~~",
  "  }",
  "}",
  "",
  "Unknown argument `testCode`. Did you mean `testName`? Available options are marked with ?.",
].join("\n");

describe("prismaErrorSummary", () => {
  it("surfaces the reason instead of an empty string", () => {
    expect(prismaErrorSummary(new Error(UNKNOWN_ARGUMENT))).toContain("Unknown argument `testCode`");
  });

  it("never carries the echoed patient data into the log", () => {
    expect(prismaErrorSummary(new Error(UNKNOWN_ARGUMENT))).not.toContain("TWIN PATIENTNINE");
  });

  it("prefixes the Prisma code when there is one", () => {
    const e = Object.assign(new Error("Unique constraint failed on the fields: (`accessionNumber`)"), {
      code: "P2002",
    });
    expect(prismaErrorSummary(e)).toBe("P2002 · Unique constraint failed on the fields: (`accessionNumber`)");
  });

  it("stays short and never throws on junk", () => {
    expect(prismaErrorSummary(undefined)).toBe("unknown");
    expect(prismaErrorSummary("a string")).toBe("unknown");
    expect(prismaErrorSummary(new Error("x".repeat(500))).length).toBeLessThanOrEqual(120);
  });
});

describe("errorReason — what the sync stores in lastError", () => {
  it("keeps the reason and drops the echoed row", () => {
    const summary = errorReason(new Error(UNKNOWN_ARGUMENT));
    expect(summary).toContain("Unknown argument `testCode`");
    expect(summary).not.toContain("TWIN PATIENTNINE");
    expect(summary).not.toContain("patientName");
  });

  it("passes a one-line failure through unchanged", () => {
    expect(errorReason(new Error("fetch failed"))).toBe("fetch failed");
  });

  it("says unknown for junk instead of printing undefined", () => {
    expect(errorReason(undefined)).toBe("unknown");
    expect(errorReason({})).toBe("unknown");
    expect(errorReason("ECONNREFUSED")).toBe("ECONNREFUSED");
  });

  it("is what the sync writes, at every failure site", () => {
    const src = readFileSync("src/lib/usg/runWorklistSync.ts", "utf8");
    expect(src).not.toMatch(/\$\{e\?\.message/);
    expect(src.match(/lastError = .*errorReason\(e\)/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("is what the health probe prints — its output is meant to be pasted into a bug report", () => {
    const probe = readFileSync("scripts/usg-sync-health.mjs", "utf8");
    expect(probe).toMatch(/lastError\s+\$\{reason\(st\.lastError\)\}/);
    expect(probe).not.toMatch(/String\(st\.lastError\)/);
    // No query in the probe may fetch a whole patient-bearing row.
    for (const match of probe.matchAll(/db\.usgAudit\.findMany\(\{[\s\S]*?\}\)/g)) {
      expect(match[0]).toContain("select:");
      expect(match[0]).not.toMatch(/patientName:/);
    }
  });
});
