import { describe, expect, it } from "vitest";
import { toLocalDateString } from "../src/lib/usg/dates";

/**
 * Queue picker contract — patient key + today-default date range.
 * Mirrors the helpers in UsgQueuePicker (kept inline there to stay zero-dep).
 */
function patientKey(o: { patientName: string; patientPhone: string; patientSex: string }): string {
  const phone = (o.patientPhone || "").replace(/\D/g, "");
  const name = (o.patientName || "").trim().toLowerCase();
  return phone ? `p:${phone}` : `n:${name}|${o.patientSex || ""}`;
}

describe("UsgQueuePicker contracts", () => {
  it("defaults date range to local today", () => {
    const today = toLocalDateString();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Same calendar day as "now" in local TZ (not UTC-shifted).
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    expect(today).toBe(expected);
  });

  it("groups patients by phone when present, else name+sex", () => {
    expect(
      patientKey({ patientName: "Asha", patientPhone: "98765-43210", patientSex: "F" }),
    ).toBe("p:9876543210");
    expect(
      patientKey({ patientName: "Asha Devi", patientPhone: "", patientSex: "F" }),
    ).toBe("n:asha devi|F");
    expect(
      patientKey({ patientName: "Asha", patientPhone: "9876543210", patientSex: "F" }),
    ).toBe(
      patientKey({ patientName: "Different Name", patientPhone: "98765 43210", patientSex: "M" }),
    );
  });
});
