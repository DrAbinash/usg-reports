import { describe, expect, it } from "vitest";
import { clinicDisplayName, clinicFooterText, studioProductTitle } from "@/lib/usg/branding";

describe("white-label branding helpers", () => {
  it("prefers clinic (hospitalName) over app title", () => {
    expect(
      clinicDisplayName({ hospitalName: "Deoghar Ultrasound", appTitle: "USG Studio" }),
    ).toBe("Deoghar Ultrasound");
  });

  it("falls back to appTitle, then neutral USG Studio", () => {
    expect(clinicDisplayName({ hospitalName: "", appTitle: "My Studio" })).toBe("My Studio");
    expect(clinicDisplayName({})).toBe("USG Studio");
  });

  it("studioProductTitle prefers appTitle", () => {
    expect(
      studioProductTitle({ appTitle: "Sugandha USG", hospitalName: "CARE Clinic" }),
    ).toBe("Sugandha USG");
    expect(studioProductTitle({ hospitalName: "Only Clinic" })).toBe("Only Clinic");
  });

  it("footer prefers usgFooterLine then footerMessage", () => {
    expect(
      clinicFooterText({ usgFooterLine: "Correlate clinically.", footerMessage: "Thanks" }),
    ).toBe("Correlate clinically.");
    expect(clinicFooterText({ footerMessage: "Thanks" })).toBe("Thanks");
    expect(clinicFooterText({})).toBe("");
  });
});
