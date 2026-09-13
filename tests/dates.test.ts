import { describe, expect, it } from "vitest";
import { toLocalDateString, toScanDateInput } from "@/lib/usg/dates";

describe("dates", () => {
  it("toLocalDateString uses local calendar day, not UTC", () => {
    // 2026-09-13 22:00 IST = 2026-09-13 16:30 UTC — UTC slice would still be 13th,
    // but 2026-09-13 20:00 UTC = 2026-09-14 01:30 IST where UTC slice wrongly says 13th.
    const istLateNight = new Date(2026, 8, 14, 1, 30, 0); // Sep 14 local
    expect(toLocalDateString(istLateNight)).toBe("2026-09-14");
    expect(toScanDateInput(istLateNight)).toBe("2026-09-14");
  });
});
