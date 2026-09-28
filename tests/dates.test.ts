import { describe, expect, it } from "vitest";
import {
  addCalendarDaysYmd,
  clinicTodayIST,
  toLocalDateString,
  toScanDateInput,
} from "@/lib/usg/dates";

describe("dates", () => {
  it("toLocalDateString uses local calendar day, not UTC", () => {
    // 2026-09-13 22:00 IST = 2026-09-13 16:30 UTC — UTC slice would still be 13th,
    // but 2026-09-13 20:00 UTC = 2026-09-14 01:30 IST where UTC slice wrongly says 13th.
    const istLateNight = new Date(2026, 8, 14, 1, 30, 0); // Sep 14 local
    expect(toLocalDateString(istLateNight)).toBe("2026-09-14");
    expect(toScanDateInput(istLateNight)).toBe("2026-09-14");
  });

  it("clinicTodayIST formats Asia/Kolkata as YYYY-MM-DD", () => {
    // 2026-09-28 00:30 IST = 2026-09-27 19:00 UTC
    const utc = new Date("2026-09-27T19:00:00.000Z");
    expect(clinicTodayIST(utc)).toBe("2026-09-28");
  });

  it("addCalendarDaysYmd steps whole calendar days without TZ drift", () => {
    expect(addCalendarDaysYmd("2026-09-28", -1)).toBe("2026-09-27");
    expect(addCalendarDaysYmd("2026-09-28", -7)).toBe("2026-09-21");
    expect(addCalendarDaysYmd("2026-03-01", -1)).toBe("2026-02-28");
  });
});
