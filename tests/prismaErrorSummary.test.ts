/**
 * What a rejected write actually says.
 *
 * Production ran for four days with a generated Prisma client that lagged its
 * own schema. Every order insert failed with "Unknown argument `testCode`",
 * every other read worked, and the studio's log said `create failed ()` —
 * because the diagnostic read the FIRST line of a message that always starts
 * with a blank line.
 */
import { describe, expect, it } from "vitest";
import { prismaErrorSummary } from "@/lib/usg/careSync";

/** Verbatim shape of the Prisma validation error captured on the NAS. */
const UNKNOWN_ARGUMENT = [
  "",
  "Invalid `prisma.usgCareOrder.create()` invocation:",
  "",
  "{",
  "  data: {",
  '    patientName: "SINDHU KUMARI",',
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
    expect(prismaErrorSummary(new Error(UNKNOWN_ARGUMENT))).not.toContain("SINDHU KUMARI");
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
