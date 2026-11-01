/**
 * The same-patient-same-day key that keeps un-billed Orthanc scans from
 * duplicating a bill-desk order.
 *
 * This lives apart from the pull window on purpose: it is the rule that decides
 * whether a walk-in study becomes its own worklist row, and it is matched
 * against a name CARE writes in a different case and a different token order,
 * and against a study whose timestamp is UTC while the clinic counts IST days.
 */
import { describe, expect, it } from "vitest";
import { ORPHAN_MAX_AGE_DAYS, istDayOfDate, nameDayKey } from "@/lib/usg/careSync";

describe("same-patient-same-day key (the orphan dedup)", () => {
  it("ignores name token order, so CARE and DICOM agree", () => {
    const a = nameDayKey("Example Patientfour", "2026-10-06");
    const b = nameDayKey("PATIENTFOUR  example", "2026-10-06");
    expect(a).toBe(b);
    expect(a).toBe("example patientfour|2026-10-06");
  });

  it("separates days, so a repeat scan is not treated as a duplicate", () => {
    expect(nameDayKey("Example Patientfour", "2026-10-06")).not.toBe(nameDayKey("Example Patientfour", "2026-10-05"));
  });

  it("refuses a key without a real date or without a name", () => {
    expect(nameDayKey("Example Patientfour", null)).toBeNull();
    expect(nameDayKey("", "2026-10-06")).toBeNull();
  });

  it("reads the clinic's calendar day, not the UTC one", () => {
    // 23:30 IST on the 6th is 18:00 UTC on the 6th; 00:30 IST on the 7th is
    // 19:00 UTC on the 6th and must not read as the 6th.
    expect(istDayOfDate(new Date("2026-10-06T19:00:00Z"))).toBe("2026-10-07");
    expect(istDayOfDate(new Date("2026-10-06T18:00:00Z"))).toBe("2026-10-06");
    expect(istDayOfDate(null)).toBeNull();
  });

  it("bounds the fallback to a few days, not the archive", () => {
    expect(ORPHAN_MAX_AGE_DAYS).toBeLessThanOrEqual(7);
  });
});
