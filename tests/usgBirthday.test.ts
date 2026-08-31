/**
 * v6.1 "Sonologist's Day" tests — the birthday greeting.
 *
 * The greeting must fire on the right LOCAL date and only then:
 *   - us / slash / dot separators all canonicalise to "MM-DD",
 *   - impossible dates (Feb 30, month 13) turn the greeting OFF, not dead,
 *   - Feb 29 is valid and matches only real Feb 29s,
 *   - the card greets the saved name with the right honorific,
 *   - Settings persists the field normalised (the real save path).
 */
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getSettings, updateSettings } from "@/lib/settings";
import {
  birthdayLabel, dismissalKey, greetingName, isBirthdayToday, normalizeBirthday,
} from "@/lib/usg/birthday";

describe("normalizeBirthday — humans type dates in many ways", () => {
  it("canonicalises the common separators", () => {
    expect(normalizeBirthday("09-01")).toBe("09-01");
    expect(normalizeBirthday("9/1")).toBe("09-01");
    expect(normalizeBirthday("07.09")).toBe("07-09");
    expect(normalizeBirthday("1-9")).toBe("01-09");
    expect(normalizeBirthday("  09-01  ")).toBe("09-01");
  });

  it("rejects impossible or unparseable values as empty (greeting off)", () => {
    for (const bad of ["", "   ", "Sept 1", "13-01", "00-10", "02-30", "04-31", "1", "09-0112", "xx-yy"]) {
      expect(normalizeBirthday(bad)).toBe("");
    }
  });

  it("accepts a leap-day birthday", () => {
    expect(normalizeBirthday("02-29")).toBe("02-29");
  });
});

describe("isBirthdayToday — local calendar match only", () => {
  const sept1 = new Date(2026, 8, 1, 9, 30, 0); // 1 Sept 2026, morning
  const sept2 = new Date(2026, 8, 2, 0, 0, 0);

  it("fires on the configured day, at any hour of that local day", () => {
    expect(isBirthdayToday("09-01", sept1)).toBe(true);
    expect(isBirthdayToday("09-01", new Date(2026, 8, 1, 23, 59, 59))).toBe(true);
    expect(isBirthdayToday("09-01", new Date(2026, 8, 1, 0, 0, 0))).toBe(true);
  });

  it("stays silent the day after (and on every other day of the year)", () => {
    expect(isBirthdayToday("09-01", sept2)).toBe(false);
    expect(isBirthdayToday("09-01", new Date(2026, 11, 1))).toBe(false);
    // same digits, different month: 01-09 is 9 January, not 1 September
    expect(isBirthdayToday("01-09", sept1)).toBe(false);
  });

  it("normalises input before matching and ignores garbage", () => {
    expect(isBirthdayToday("9/1", sept1)).toBe(true);
    expect(isBirthdayToday("", sept1)).toBe(false);
    expect(isBirthdayToday("nonsense", sept1)).toBe(false);
  });

  it("a leap-day birthday matches only real Feb 29s", () => {
    expect(isBirthdayToday("02-29", new Date(2028, 1, 29))).toBe(true);  // leap year
    expect(isBirthdayToday("02-29", new Date(2027, 1, 28))).toBe(false); // non-leap
    expect(isBirthdayToday("02-29", new Date(2027, 1, 29))).toBe(false); // Mar 1 rollover
  });
});

describe("greetingName — formal-warm, never headless", () => {
  it("keeps an existing honorific", () => {
    expect(greetingName("Dr. Sugandha Priyadarshini")).toBe("Dr. Sugandha Priyadarshini");
    expect(greetingName("Dr Sugandha")).toBe("Dr Sugandha");
  });
  it("adds one to a bare name", () => {
    expect(greetingName("Sugandha Priyadarshini")).toBe("Dr. Sugandha Priyadarshini");
  });
  it("falls back gracefully when nothing is saved", () => {
    expect(greetingName("")).toBe("Doctor");
    expect(greetingName("   ")).toBe("Doctor");
  });
});

describe("card copy helpers", () => {
  it("labels the date for the chip", () => {
    expect(birthdayLabel("09-01", new Date(2026, 0, 15))).toContain("September");
    expect(birthdayLabel("", new Date())).toBe("");
  });
  it("keys dismissal per year so it self-expires", () => {
    expect(dismissalKey(2026)).toBe("usg-birthday-greeted-2026");
    expect(dismissalKey(2027)).not.toBe(dismissalKey(2026));
  });
});

describe("settings persistence (the real save path)", () => {
  beforeEach(async () => { await db.hospitalSettings.deleteMany(); });
  afterEach(async () => { await db.hospitalSettings.deleteMany(); });

  it("ships with 01 September as the default — the card works on day one", async () => {
    expect((await getSettings()).usgDoctorBirthday).toBe("09-01");
  });

  it("normalises on save: 7/9 stores as 07-09", async () => {
    await updateSettings({ usgDoctorBirthday: "7/9" });
    expect((await getSettings()).usgDoctorBirthday).toBe("07-09");
  });

  it("an unparseable save turns the greeting off instead of dead-ending it", async () => {
    await updateSettings({ usgDoctorBirthday: "Sept 1" });
    expect((await getSettings()).usgDoctorBirthday).toBe("");
  });

  it("clearing is a valid update; re-arming works", async () => {
    await updateSettings({ usgDoctorBirthday: "" });
    expect((await getSettings()).usgDoctorBirthday).toBe("");
    await updateSettings({ usgDoctorBirthday: "09-01" });
    expect((await getSettings()).usgDoctorBirthday).toBe("09-01");
  });

  it("a saved value survives masked reads (client-safe view)", async () => {
    await updateSettings({ usgDoctorBirthday: "02-29" });
    const { getMaskedSettings } = await import("@/lib/settings");
    const m = await getMaskedSettings();
    expect((m as Record<string, unknown>).usgDoctorBirthday).toBe("02-29");
  });
});
